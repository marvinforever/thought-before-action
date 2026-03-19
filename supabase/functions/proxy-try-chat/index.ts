import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TRY_SYSTEM_PROMPT } from "../_shared/try-system-prompt.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// Buffered marker parser — accumulates content and extracts complete markers
// ============================================================================
class MarkerParser {
  private buffer = '';
  private encoder: TextEncoder;
  private controller: ReadableStreamDefaultController;
  private sessionToken: string;
  private supabase: any;
  private pendingPromises: Promise<void>[] = [];

  constructor(encoder: TextEncoder, controller: ReadableStreamDefaultController, sessionToken: string, supabase: any) {
    this.encoder = encoder;
    this.controller = controller;
    this.sessionToken = sessionToken;
    this.supabase = supabase;
  }

  /** Await all pending side-effect promises (DB saves, onboard triggers) */
  async awaitPending() {
    if (this.pendingPromises.length > 0) {
      console.log(`[proxy-try-chat] Awaiting ${this.pendingPromises.length} pending side-effect(s)…`);
      await Promise.allSettled(this.pendingPromises);
      this.pendingPromises = [];
    }
  }

  /** Feed new content into the buffer, emit events + clean text */
  feed(content: string) {
    this.buffer += content;
    this.processBuffer();
  }

  /** Flush remaining buffer at end of stream */
  flush() {
    // If there's a partial marker that never closed, just emit it as text
    if (this.buffer.length) {
      const cleaned = this.buffer.replace(/<!--[\s\S]*$/g, '');
      if (cleaned.length) {
        this.emitText(cleaned);
      }
    }
    this.buffer = '';
  }

  private processBuffer() {
    // Keep processing as long as we find complete markers
    while (true) {
      // Check for any complete marker <!--TYPE:...-->
      const markerMatch = this.buffer.match(/<!--(EXTRACTED_DATA|INTERACTIVE|PROGRESS|GENERATION|ONBOARDING_COMPLETE):([\s\S]*?)-->/);

      if (markerMatch) {
        const markerStart = markerMatch.index!;
        const markerEnd = markerStart + markerMatch[0].length;

        // Emit any text BEFORE this marker
        const textBefore = this.buffer.slice(0, markerStart);
        if (textBefore.length) {
          this.emitText(textBefore);
        }

        // Process the marker itself
        const markerType = markerMatch[1];
        const markerPayload = markerMatch[2];
        this.handleMarker(markerType, markerPayload);

        // Remove everything up to and including the marker
        this.buffer = this.buffer.slice(markerEnd);
        continue;
      }

      // No complete marker found. Check if there's a partial marker starting
      const partialIdx = this.buffer.indexOf('<!--');
      if (partialIdx !== -1) {
        // Emit text before the partial marker, hold the rest
        const textBefore = this.buffer.slice(0, partialIdx);
        if (textBefore.length) {
          this.emitText(textBefore);
        }
        this.buffer = this.buffer.slice(partialIdx);
        // Wait for more data to complete the marker
        return;
      }

      // No markers at all — emit everything
      if (this.buffer.length) {
        this.emitText(this.buffer);
      }
      this.buffer = '';
      return;
    }
  }

  private emitText(text: string) {
    this.controller.enqueue(
      this.encoder.encode(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`)
    );
  }

  private handleMarker(type: string, payload: string) {
    try {
      const data = JSON.parse(payload);

      switch (type) {
        case 'EXTRACTED_DATA': {
          // Save to DB — push as tracked promise
          const savePromise = this.supabase
            .from('try_sessions')
            .update({ extracted_data: data, status: 'onboarding_complete' })
            .eq('session_token', this.sessionToken)
            .then(() => console.log('[proxy-try-chat] Extracted data saved'))
            .catch((e: any) => console.error('[proxy-try-chat] Extracted data save error:', e));
          this.pendingPromises.push(savePromise);

          // Only trigger account creation if we have an email
          if (!data.email) {
            console.warn('[proxy-try-chat] No email in extracted data, skipping onboard trigger');
            break;
          }

          // Trigger account creation + playbook — push as tracked promise
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const onboardPromise = fetch(`${supabaseUrl}/functions/v1/try-jericho-onboard`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: data.email,
              fullName: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
              role: data.role,
              diagnosticData: data,
            }),
          })
            .then(async (resp) => {
              if (resp.ok) {
                const result = await resp.json().catch(() => ({}));
                const profileId = result.userId;
                if (profileId) {
                  console.log(`[proxy-try-chat] Triggering Playbook generation for ${profileId}`);
                  await fetch(`${supabaseUrl}/functions/v1/generate-individual-playbook`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sessionToken: this.sessionToken,
                      profileId,
                      extractedData: data,
                    }),
                  }).catch(e => console.error('[proxy-try-chat] Playbook trigger error:', e));
                }
              } else {
                const errText = await resp.text().catch(() => '');
                console.error(`[proxy-try-chat] Onboard returned ${resp.status}: ${errText}`);
              }
            })
            .catch(e => console.error('[proxy-try-chat] Onboard trigger error:', e));
          this.pendingPromises.push(onboardPromise);
          break;
        }
        case 'ONBOARDING_COMPLETE': {
          // Legacy — just save
          const legacyPromise = this.supabase
            .from('try_sessions')
            .update({ extracted_data: data, status: 'onboarding_complete' })
            .eq('session_token', this.sessionToken)
            .then(() => {})
            .catch((e: any) => console.error('[proxy-try-chat] Legacy marker save error:', e));
          this.pendingPromises.push(legacyPromise);
          break;
        }
        case 'INTERACTIVE': {
          this.controller.enqueue(
            this.encoder.encode(`data: ${JSON.stringify({ type: "interactive", ...data })}\n\n`)
          );
          break;
        }
        case 'PROGRESS': {
          this.controller.enqueue(
            this.encoder.encode(`data: ${JSON.stringify({ type: "progress", ...data })}\n\n`)
          );
          break;
        }
        case 'GENERATION': {
          this.controller.enqueue(
            this.encoder.encode(`data: ${JSON.stringify({ type: "generation", ...data })}\n\n`)
          );
          break;
        }
      }
    } catch (e) {
      console.error(`[proxy-try-chat] Failed to parse ${type} marker:`, e);
    }
  }
}

// ============================================================================
// Main handler
// ============================================================================
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
        
        const openClawController = new AbortController();
        const openClawTimeout = setTimeout(() => openClawController.abort(), 10000);

        const gatewayToken = Deno.env.get('OPENCLAW_GATEWAY_TOKEN') || '';
        const openClawHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (gatewayToken) {
          openClawHeaders['Authorization'] = `Bearer ${gatewayToken}`;
        }

        const openClawResponse = await fetch(openClawUrl, {
          method: 'POST',
          headers: openClawHeaders,
          body: JSON.stringify({
            session_id: sessionId,
            messages,
            message,
            stream: stream ?? true,
          }),
          signal: openClawController.signal,
        });

        clearTimeout(openClawTimeout);

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
            const parser = new MarkerParser(encoder, controller, sessionId, supabase);
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
                      parser.flush();
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
                      continue;
                    }
                    try {
                      const parsed = JSON.parse(data);
                      const content = parsed.choices?.[0]?.delta?.content ?? parsed.content ?? '';
                      if (content) {
                        accumulatedAssistant += content;
                        parser.feed(content);
                      }
                      if (parsed.done) {
                        parser.flush();
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
                      }
                    } catch { /* skip invalid JSON lines */ }
                  } else {
                    controller.enqueue(encoder.encode(line + '\n'));
                  }
                }
              }

              // Flush any remaining buffered content
              parser.flush();

              if (buffer.trim()) {
                controller.enqueue(encoder.encode(buffer));
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
            } catch (error) {
              console.error('[proxy-try-chat] Stream error:', error);
            } finally {
              controller.close();
              // Await side-effects (onboard, playbook) BEFORE worker shuts down
              await parser.awaitPending();
              await saveToTrySession(supabase, sessionId, message, accumulatedAssistant, messages).catch(
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

    // ── FALLBACK PATH: Direct Gemini call (NOT through chat-with-jericho) ──
    console.log(`[proxy-try-chat] Using direct Gemini fallback for session ${sessionId}`);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI gateway not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiMessages = [
      { role: 'system', content: TRY_SYSTEM_PROMPT },
      ...(messages || []),
    ];

    const geminiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: aiMessages,
        stream: true,
        temperature: 0.9,
      }),
    });

    if (!geminiResponse.ok) {
      if (geminiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (geminiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await geminiResponse.text();
      console.error('[proxy-try-chat] Gemini error:', geminiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!geminiResponse.body) {
      return new Response(
        JSON.stringify({ error: 'No response body from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accumulatedFallback = '';
    const encoder = new TextEncoder();
    const fbReader = geminiResponse.body.getReader();
    const fbDecoder = new TextDecoder();

    const fallbackStream = new ReadableStream({
      async start(controller) {
        const parser = new MarkerParser(encoder, controller, sessionId, supabase);
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await fbReader.read();
            if (done) break;
            buffer += fbDecoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const d = line.slice(6).trim();
              if (!d || d === '[DONE]') {
                if (d === '[DONE]') {
                  parser.flush();
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
                }
                continue;
              }
              try {
                const parsed = JSON.parse(d);
                const content = parsed.choices?.[0]?.delta?.content ?? '';
                if (content) {
                  accumulatedFallback += content;
                  parser.feed(content);
                }
              } catch { /* skip invalid JSON */ }
            }
          }

          parser.flush();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
        } catch (e) {
          console.error('[proxy-try-chat] Gemini stream error:', e);
        } finally {
          controller.close();
          // Await side-effects (onboard, playbook) BEFORE worker shuts down
          await parser.awaitPending();
          await saveToTrySession(supabase, sessionId, message, accumulatedFallback, messages).catch(
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
