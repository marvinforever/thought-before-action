import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// Parse HTML comment markers from AI stream and convert to typed SSE events
// ============================================================================
function parseMarkers(content: string, encoder: TextEncoder, controller: ReadableStreamDefaultController, sessionToken: string, supabase: any) {
  let remaining = content;
  const events: string[] = [];

  // EXTRACTED_DATA — save to DB, don't send to client
  const extractedMatch = remaining.match(/<!--EXTRACTED_DATA:([\s\S]*?)-->/);
  if (extractedMatch) {
    remaining = remaining.replace(extractedMatch[0], '');
    try {
      const extractedData = JSON.parse(extractedMatch[1]);
      // Save to try_sessions
      supabase
        .from('try_sessions')
        .update({ extracted_data: extractedData, status: 'onboarding_complete' })
        .eq('session_token', sessionToken)
        .then(() => console.log('[proxy-try-chat] Extracted data saved'))
        .catch((e: any) => console.error('[proxy-try-chat] Extracted data save error:', e));

      // Trigger account creation
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      fetch(`${supabaseUrl}/functions/v1/try-jericho-onboard`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: extractedData.email,
          fullName: `${extractedData.first_name || ''} ${extractedData.last_name || ''}`.trim(),
          role: extractedData.role,
          diagnosticData: extractedData,
        }),
      }).catch(e => console.error('[proxy-try-chat] Onboard trigger error:', e));
    } catch (e) {
      console.error('[proxy-try-chat] Failed to parse EXTRACTED_DATA:', e);
    }
  }

  // Legacy ONBOARDING_COMPLETE marker (backward compat)
  const legacyMatch = remaining.match(/<!--ONBOARDING_COMPLETE:([\s\S]*?)-->/);
  if (legacyMatch) {
    remaining = remaining.replace(legacyMatch[0], '');
    try {
      const extractedData = JSON.parse(legacyMatch[1]);
      supabase
        .from('try_sessions')
        .update({ extracted_data: extractedData, status: 'onboarding_complete' })
        .eq('session_token', sessionToken)
        .then(() => {})
        .catch((e: any) => console.error('[proxy-try-chat] Legacy marker save error:', e));
    } catch { /* skip */ }
  }

  // INTERACTIVE
  const interactiveRegex = /<!--INTERACTIVE:([\s\S]*?)-->/g;
  let match;
  while ((match = interactiveRegex.exec(remaining)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      events.push(`data: ${JSON.stringify({ type: "interactive", ...data })}\n\n`);
    } catch { /* skip bad JSON */ }
  }
  remaining = remaining.replace(/<!--INTERACTIVE:[\s\S]*?-->/g, '');

  // PROGRESS
  const progressRegex = /<!--PROGRESS:([\s\S]*?)-->/g;
  while ((match = progressRegex.exec(remaining)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      events.push(`data: ${JSON.stringify({ type: "progress", ...data })}\n\n`);
    } catch { /* skip */ }
  }
  remaining = remaining.replace(/<!--PROGRESS:[\s\S]*?-->/g, '');

  // GENERATION
  const generationRegex = /<!--GENERATION:([\s\S]*?)-->/g;
  while ((match = generationRegex.exec(remaining)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      events.push(`data: ${JSON.stringify({ type: "generation", ...data })}\n\n`);
    } catch { /* skip */ }
  }
  remaining = remaining.replace(/<!--GENERATION:[\s\S]*?-->/g, '');

  // Strip any other HTML comments
  remaining = remaining.replace(/<!--[\s\S]*?-->/g, '');

  // Emit structured events first
  for (const evt of events) {
    controller.enqueue(encoder.encode(evt));
  }

  // Return clean text
  return remaining;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { sessionId, messages, message, stream, tryMode } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const useOpenClaw = Deno.env.get('USE_OPENCLAW_TRY') === 'true';
    const openClawUrl = Deno.env.get('OPENCLAW_TRY_URL');

    // ── PRIMARY PATH: OpenClaw Agent ──
    if (useOpenClaw && openClawUrl) {
      try {
        console.log(`[proxy-try-chat] Forwarding to OpenClaw for session ${sessionId}`);
        
        const openClawResponse = await fetch(openClawUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            messages,
            message,
            stream: stream ?? true,
          }),
        });

        if (!openClawResponse.ok) {
          console.error(`[proxy-try-chat] OpenClaw returned ${openClawResponse.status}`);
          throw new Error(`OpenClaw error: ${openClawResponse.status}`);
        }

        if (!openClawResponse.body) {
          throw new Error('No response body from OpenClaw');
        }

        const encoder = new TextEncoder();
        let accumulatedAssistant = '';
        const reader = openClawResponse.body.getReader();
        const decoder = new TextDecoder();

        const proxyStream = new ReadableStream({
          async start(controller) {
            let buffer = '';
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
                      continue;
                    }
                    try {
                      const parsed = JSON.parse(data);
                      const content = parsed.choices?.[0]?.delta?.content ?? parsed.content ?? '';
                      if (content) {
                        accumulatedAssistant += content;
                        // Parse markers and emit structured events
                        const clean = parseMarkers(content, encoder, controller, sessionId, supabase);
                        if (clean.trim()) {
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: clean })}\n\n`));
                        }
                      }
                      if (parsed.done) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
                      }
                    } catch { /* skip invalid JSON lines */ }
                  } else {
                    controller.enqueue(encoder.encode(line + '\n'));
                  }
                }
              }

              if (buffer.trim()) {
                controller.enqueue(encoder.encode(buffer));
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
            } catch (error) {
              console.error('[proxy-try-chat] Stream error:', error);
            } finally {
              controller.close();
              saveToTrySession(supabase, sessionId, message, accumulatedAssistant, messages).catch(
                (e) => console.error('[proxy-try-chat] Session save error:', e)
              );
            }
          },
        });

        return new Response(proxyStream, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        });
      } catch (openClawError: any) {
        console.error('[proxy-try-chat] OpenClaw failed, falling back to Gemini:', openClawError.message);
      }
    }

    // ── FALLBACK PATH: Forward to chat-with-jericho tryMode ──
    console.log(`[proxy-try-chat] Using fallback (chat-with-jericho) for session ${sessionId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const fallbackResponse = await fetch(`${supabaseUrl}/functions/v1/chat-with-jericho`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tryMode: true,
        sessionId,
        messages,
        message,
        stream: true,
      }),
    });

    if (!fallbackResponse.ok) {
      const errText = await fallbackResponse.text();
      console.error('[proxy-try-chat] Fallback error:', fallbackResponse.status, errText);
      return new Response(JSON.stringify({ error: 'AI service temporarily unavailable' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stream fallback response through with marker parsing
    let accumulatedFallback = '';
    const encoder = new TextEncoder();
    const fbReader = fallbackResponse.body!.getReader();
    const fbDecoder = new TextDecoder();

    const fallbackStream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await fbReader.read();
            if (done) break;
            const chunk = fbDecoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) {
                controller.enqueue(encoder.encode(line + '\n'));
                continue;
              }
              const d = line.slice(6).trim();
              if (!d || d === '[DONE]') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
                continue;
              }
              try {
                const p = JSON.parse(d);
                const content = p.content ?? '';
                if (content) {
                  accumulatedFallback += content;
                  // Parse markers from fallback too
                  const clean = parseMarkers(content, encoder, controller, sessionId, supabase);
                  if (clean.trim()) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: clean })}\n\n`));
                  }
                }
                if (p.done) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
                }
                if (p.profile_id) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", profile_id: p.profile_id })}\n\n`));
                }
              } catch { /* skip */ }
            }
          }
        } catch (e) {
          console.error('[proxy-try-chat] Fallback stream error:', e);
        } finally {
          controller.close();
          saveToTrySession(supabase, sessionId, message, accumulatedFallback, messages).catch(
            (e) => console.error('[proxy-try-chat] Session save error:', e)
          );
        }
      },
    });

    return new Response(fallbackStream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });

  } catch (error: any) {
    console.error('[proxy-try-chat] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================================================
// Save conversation turn to try_sessions
// ============================================================================
async function saveToTrySession(
  supabase: any,
  sessionToken: string,
  userMessage: string | undefined,
  assistantMessage: string,
  fullHistory: any[] | undefined,
) {
  try {
    const { data: existing } = await supabase
      .from('try_sessions')
      .select('id, conversation_history, messages_count')
      .eq('session_token', sessionToken)
      .single();

    const newEntries: any[] = [];
    if (userMessage && userMessage.trim()) {
      newEntries.push({ role: 'user', content: userMessage, ts: new Date().toISOString() });
    }
    // Strip markers from saved assistant message
    const cleanAssistant = assistantMessage
      .replace(/<!--INTERACTIVE:[\s\S]*?-->/g, '')
      .replace(/<!--PROGRESS:[\s\S]*?-->/g, '')
      .replace(/<!--GENERATION:[\s\S]*?-->/g, '')
      .replace(/<!--EXTRACTED_DATA:[\s\S]*?-->/g, '')
      .replace(/<!--ONBOARDING_COMPLETE:[\s\S]*?-->/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    if (cleanAssistant) {
      newEntries.push({ role: 'assistant', content: cleanAssistant, ts: new Date().toISOString() });
    }

    if (existing) {
      const history = Array.isArray(existing.conversation_history) ? existing.conversation_history : [];
      await supabase
        .from('try_sessions')
        .update({
          conversation_history: [...history, ...newEntries],
          messages_count: (existing.messages_count || 0) + newEntries.length,
          last_activity: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('try_sessions').insert({
        session_token: sessionToken,
        conversation_history: newEntries,
        messages_count: newEntries.length,
        status: 'active',
      });
    }
  } catch (e) {
    console.error('[proxy-try-chat] saveToTrySession error:', e);
  }
}
