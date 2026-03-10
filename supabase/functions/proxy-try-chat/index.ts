import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

        // Stream through: intercept to accumulate content for session save
        const encoder = new TextEncoder();
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

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
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                      continue;
                    }
                    try {
                      const parsed = JSON.parse(data);
                      // Handle both OpenAI-style and simple {content} format
                      const content = parsed.choices?.[0]?.delta?.content ?? parsed.content ?? '';
                      if (content) {
                        accumulatedAssistant += content;
                        // Strip any hidden markers before sending to client
                        const clean = content.replace(/<!--.*?-->/g, '');
                        if (clean) {
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: clean })}\n\n`));
                        }
                      }
                      if (parsed.done) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                      }
                    } catch { /* skip invalid JSON lines */ }
                  } else {
                    // Pass through non-data lines
                    controller.enqueue(encoder.encode(line + '\n'));
                  }
                }
              }

              // Flush remaining buffer
              if (buffer.trim()) {
                controller.enqueue(encoder.encode(buffer));
              }

              // Final done
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            } catch (error) {
              console.error('[proxy-try-chat] Stream error:', error);
            } finally {
              controller.close();

              // Save conversation to try_sessions after stream completes
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
        // Fall through to fallback
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

    // Stream fallback response through, also saving to session
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
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

            // Pass through directly (chat-with-jericho already formats SSE)
            controller.enqueue(value);

            // Also accumulate for session save
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const d = line.slice(6).trim();
              if (!d || d === '[DONE]') continue;
              try {
                const p = JSON.parse(d);
                if (p.content) accumulatedFallback += p.content;
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
    // Check if session exists
    const { data: existing } = await supabase
      .from('try_sessions')
      .select('id, conversation_history, messages_count')
      .eq('session_token', sessionToken)
      .single();

    const newEntries: any[] = [];
    if (userMessage && userMessage.trim()) {
      newEntries.push({ role: 'user', content: userMessage, ts: new Date().toISOString() });
    }
    if (assistantMessage.trim()) {
      newEntries.push({ role: 'assistant', content: assistantMessage, ts: new Date().toISOString() });
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
      // Create new session
      const referrer = ''; // Could be passed from client in future
      await supabase.from('try_sessions').insert({
        session_token: sessionToken,
        conversation_history: newEntries,
        messages_count: newEntries.length,
        status: 'active',
      });
    }

    // Extract data markers from assistant message
    const markerMatch = assistantMessage.match(/<!--ONBOARDING_COMPLETE:(.*?)-->/);
    if (markerMatch) {
      try {
        const extractedData = JSON.parse(markerMatch[1]);
        await supabase
          .from('try_sessions')
          .update({ extracted_data: extractedData, status: 'onboarding_complete' })
          .eq('session_token', sessionToken);
      } catch { /* skip parse error */ }
    }
  } catch (e) {
    console.error('[proxy-try-chat] saveToTrySession error:', e);
  }
}
