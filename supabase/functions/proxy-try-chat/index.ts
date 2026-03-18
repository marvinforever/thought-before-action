import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  constructor(encoder: TextEncoder, controller: ReadableStreamDefaultController, sessionToken: string, supabase: any) {
    this.encoder = encoder;
    this.controller = controller;
    this.sessionToken = sessionToken;
    this.supabase = supabase;
  }

  /** Feed new content into the buffer, emit events + clean text */
  feed(content: string) {
    this.buffer += content;
    this.processBuffer();
  }

  /** Flush remaining buffer at end of stream */
  flush() {
    // If there's a partial marker that never closed, just emit it as text
    if (this.buffer.trim()) {
      const cleaned = this.buffer.replace(/<!--[\s\S]*$/g, '').trim();
      if (cleaned) {
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
        const textBefore = this.buffer.slice(0, partialIdx).trim();
        if (textBefore) {
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
          // Save to DB, don't send to client
          this.supabase
            .from('try_sessions')
            .update({ extracted_data: data, status: 'onboarding_complete' })
            .eq('session_token', this.sessionToken)
            .then(() => console.log('[proxy-try-chat] Extracted data saved'))
            .catch((e: any) => console.error('[proxy-try-chat] Extracted data save error:', e));

          // Only trigger account creation if we have an email
          if (!data.email) {
            console.warn('[proxy-try-chat] No email in extracted data, skipping onboard trigger');
            break;
          }

          // Trigger account creation + playbook
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          fetch(`${supabaseUrl}/functions/v1/try-jericho-onboard`, {
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
                  fetch(`${supabaseUrl}/functions/v1/generate-individual-playbook`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sessionToken: this.sessionToken,
                      profileId,
                      extractedData: data,
                    }),
                  }).catch(e => console.error('[proxy-try-chat] Playbook trigger error:', e));
                }
              }
            })
            .catch(e => console.error('[proxy-try-chat] Onboard trigger error:', e));
          break;
        }
        case 'ONBOARDING_COMPLETE': {
          // Legacy — just save
          this.supabase
            .from('try_sessions')
            .update({ extracted_data: data, status: 'onboarding_complete' })
            .eq('session_token', this.sessionToken)
            .then(() => {})
            .catch((e: any) => console.error('[proxy-try-chat] Legacy marker save error:', e));
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

        const openClawResponse = await fetch(openClawUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

    let accumulatedFallback = '';
    const encoder = new TextEncoder();
    const fbReader = fallbackResponse.body!.getReader();
    const fbDecoder = new TextDecoder();

    const fallbackStream = new ReadableStream({
      async start(controller) {
        const parser = new MarkerParser(encoder, controller, sessionId, supabase);
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
                parser.flush();
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
                continue;
              }
              try {
                const p = JSON.parse(d);
                const content = p.content ?? '';
                if (content) {
                  accumulatedFallback += content;
                  parser.feed(content);
                }
                if (p.done) {
                  parser.flush();
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
                }
                if (p.profile_id) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", profile_id: p.profile_id })}\n\n`));
                }
              } catch { /* skip */ }
            }
          }

          // Flush remaining buffered content
          parser.flush();
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
