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
  private insideThink = false;

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
    if (this.insideThink) {
      this.buffer = '';
      this.insideThink = false;
      return;
    }
    if (this.buffer.length) {
      const cleaned = this.buffer.replace(/<!--[\s\S]*$/g, '');
      if (cleaned.length) {
        this.emitText(cleaned);
      }
    }
    this.buffer = '';
  }

  private processBuffer() {
    while (true) {
      // ── Handle <think> blocks (may span multiple chunks) ──
      if (this.insideThink) {
        const closeIdx = this.buffer.indexOf('</think>');
        if (closeIdx !== -1) {
          this.buffer = this.buffer.slice(closeIdx + 8).replace(/^\s+/, '');
          this.insideThink = false;
          continue;
        }
        this.buffer = '';
        return;
      }

      // Check for <think> opening tag anywhere in buffer
      const thinkOpenIdx = this.buffer.indexOf('<think');
      if (thinkOpenIdx !== -1) {
        const textBefore = this.buffer.slice(0, thinkOpenIdx);
        if (textBefore.length) {
          this.emitText(textBefore);
        }
        const closeIdx = this.buffer.indexOf('</think>', thinkOpenIdx);
        if (closeIdx !== -1) {
          this.buffer = this.buffer.slice(closeIdx + 8).replace(/^\s+/, '');
          continue;
        }
        this.insideThink = true;
        this.buffer = '';
        return;
      }

      // Check for partial "<think" at end of buffer
      for (let i = 1; i < 7 && i <= this.buffer.length; i++) {
        const tail = this.buffer.slice(-i);
        if ('<think>'.startsWith(tail) && tail.length === i) {
          const textBefore = this.buffer.slice(0, this.buffer.length - i);
          if (textBefore.length) {
            this.emitText(textBefore);
          }
          this.buffer = tail;
          return;
        }
      }

      // Check for any complete marker <!--TYPE:...-->
      const markerMatch = this.buffer.match(/<!--(EXTRACTED_DATA|INTERACTIVE|PROGRESS|GENERATION|ONBOARDING_COMPLETE):([\s\S]*?)-->/);

      if (markerMatch) {
        const markerStart = markerMatch.index!;
        const markerEnd = markerStart + markerMatch[0].length;

        const textBefore = this.buffer.slice(0, markerStart);
        if (textBefore.length) {
          this.emitText(textBefore);
        }

        const markerType = markerMatch[1];
        const markerPayload = markerMatch[2];
        this.handleMarker(markerType, markerPayload);

        this.buffer = this.buffer.slice(markerEnd);
        continue;
      }

      // No complete marker found. Check if there's a partial marker starting
      const partialIdx = this.buffer.indexOf('<!--');
      if (partialIdx !== -1) {
        const textBefore = this.buffer.slice(0, partialIdx);
        if (textBefore.length) {
          this.emitText(textBefore);
        }
        this.buffer = this.buffer.slice(partialIdx);
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
    // Strip any complete <think>...</think> blocks
    text = text.replace(/<think[\s\S]*?<\/think>\s*/gi, '');
    // Strip leaked tags like </final>, <final>, </think>, <think>, <think ...>
    text = text.replace(/<\/?(?:think|final)\b[^>]*>/gi, '');
    // Strip standalone "think" remnant at start from partial tag splits
    text = text.replace(/^think\b[^<]*/i, '');
    // Strip "<think" at very end (partial open tag without closing >)
    text = text.replace(/<think\s*$/i, '');
    // Strip leaked marker fragments (belt-and-suspenders)
    text = text.replace(/<[,{].*?-->/g, '');
    text = text.replace(/[{"][\w":,.\s]*}-->/g, '');
    text = text.replace(/<!--[\s\S]*$/g, '');
    // Strip malformed/partial markers with JSON payloads
    text = text.replace(/<?,?\{[^}]*\}-->/g, '');
    text = text.replace(/\{[^{}]*"label"[^{}]*\}-->/g, '');
    if (!text.trim().length) return;
    this.controller.enqueue(
      this.encoder.encode(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`)
    );
  }

  private handleMarker(type: string, payload: string) {
    try {
      const data = JSON.parse(payload);

      switch (type) {
        case 'EXTRACTED_DATA': {
          // Determine if this is an initial extraction or a Stage 2 enrichment
          const isEnrichment = !data.email; // Initial extraction always has email

          if (isEnrichment) {
            // ── Stage 2 enrichment: MERGE into existing extracted_data ──
            const enrichPromise = (async () => {
              try {
                const { data: session } = await this.supabase
                  .from('try_sessions')
                  .select('extracted_data, profile_id, status')
                  .eq('session_token', this.sessionToken)
                  .single();

                const existingData = session?.extracted_data || {};
                const mergedData = { ...existingData, ...data };

                // Track enrichment count for playbook refresh triggers
                const enrichmentCount = (existingData._enrichment_count || 0) + 1;
                mergedData._enrichment_count = enrichmentCount;
                mergedData._last_enriched_at = new Date().toISOString();

                await this.supabase
                  .from('try_sessions')
                  .update({ extracted_data: mergedData })
                  .eq('session_token', this.sessionToken);

                console.log(`[proxy-try-chat] Stage 2 enrichment #${enrichmentCount} merged:`, Object.keys(data).join(', '));

                // If user has a profile, also enrich their active context
                const profileId = session?.profile_id;
                if (profileId) {
                  const { data: ctx } = await this.supabase
                    .from('user_active_context')
                    .select('onboarding_data, continuity_summary')
                    .eq('profile_id', profileId)
                    .maybeSingle();

                  const existingOnboarding = ctx?.onboarding_data || {};
                  const enrichedOnboarding = { ...existingOnboarding, ...data };

                  await this.supabase
                    .from('user_active_context')
                    .update({
                      onboarding_data: enrichedOnboarding,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('profile_id', profileId);

                  console.log(`[proxy-try-chat] Profile ${profileId} context enriched`);

                  // Every 5 enrichments, trigger a playbook refresh
                  if (enrichmentCount > 0 && enrichmentCount % 5 === 0) {
                    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                    console.log(`[proxy-try-chat] Triggering playbook refresh after ${enrichmentCount} enrichments`);
                    await fetch(`${supabaseUrl}/functions/v1/generate-individual-playbook`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        profileId,
                        extractedData: mergedData,
                        isRefresh: true,
                      }),
                    }).catch(e => console.error('[proxy-try-chat] Playbook refresh error:', e));
                  }
                }
              } catch (e) {
                console.error('[proxy-try-chat] Enrichment merge error:', e);
              }
            })();
            this.pendingPromises.push(enrichPromise);
            break;
          }

          // ── Initial extraction (has email) — original logic ──
          // Save to DB — push as tracked promise
          const savePromise = this.supabase
            .from('try_sessions')
            .update({ extracted_data: data, status: 'onboarding_complete' })
            .eq('session_token', this.sessionToken)
            .then(() => console.log('[proxy-try-chat] Extracted data saved'))
            .catch((e: any) => console.error('[proxy-try-chat] Extracted data save error:', e));
          this.pendingPromises.push(savePromise);

          // Handle book_call request — send email to team
          if (data.book_call) {
            const bookCallPromise = (async () => {
              try {
                // Get the session's full extracted data for user context
                const { data: session } = await this.supabase
                  .from('try_sessions')
                  .select('extracted_data')
                  .eq('session_token', this.sessionToken)
                  .single();

                const userData = session?.extracted_data || data;
                const userName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Unknown';
                const userEmail = userData.email || 'Not provided';
                const userRole = userData.role || 'Not provided';
                const userIndustry = userData.industry || 'Not provided';
                const meetingTimes = data.meeting_times || [];

                const resendKey = Deno.env.get('RESEND_API_KEY');
                if (!resendKey) {
                  console.error('[proxy-try-chat] RESEND_API_KEY not set, cannot send booking email');
                  return;
                }

                const timesHtml = meetingTimes.length > 0
                  ? `<ul>${meetingTimes.map((t: string) => `<li>${t}</li>`).join('')}</ul>`
                  : '<p><em>No specific times provided</em></p>';

                const emailBody = `
                  <h2>🔥 New Call Request from Jericho Try Flow</h2>
                  <p><strong>Name:</strong> ${userName}</p>
                  <p><strong>Email:</strong> ${userEmail}</p>
                  <p><strong>Role:</strong> ${userRole}</p>
                  <p><strong>Industry:</strong> ${userIndustry}</p>
                  <h3>Preferred Meeting Times:</h3>
                  ${timesHtml}
                  <p style="margin-top:20px;color:#666;">This person completed the Jericho onboarding flow and wants to book a call. Please send them a calendar invite at one of their preferred times.</p>
                `;

                const resp = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    from: Deno.env.get('RESEND_FROM') || 'Jericho <jericho@sender.askjericho.com>',
                    to: ['marvin@themomentumcompany.com'],
                    cc: ['mark@themomentumcompany.com'],
                    subject: `📞 Call Request: ${userName} wants to book a demo`,
                    html: emailBody,
                    reply_to: userEmail !== 'Not provided' ? userEmail : undefined,
                  }),
                });

                if (resp.ok) {
                  console.log(`[proxy-try-chat] Booking email sent for ${userName}`);
                } else {
                  const errText = await resp.text().catch(() => '');
                  console.error(`[proxy-try-chat] Booking email failed ${resp.status}: ${errText}`);
                }
              } catch (e) {
                console.error('[proxy-try-chat] Booking email error:', e);
              }
            })();
            this.pendingPromises.push(bookCallPromise);
          }

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

    // ── Gemini via Lovable AI Gateway ──
    console.log(`[proxy-try-chat] Using Gemini for session ${sessionId}`);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI gateway not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Stuck detection: check if the same phase appeared 2+ times in recent assistant messages ──
    const incomingMessages = messages || [];
    let stuckNudge = '';
    
    // Extract phase numbers from recent PROGRESS markers in assistant messages
    const recentPhases: number[] = [];
    for (let i = incomingMessages.length - 1; i >= 0 && recentPhases.length < 4; i--) {
      const msg = incomingMessages[i];
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        const progressMatch = msg.content.match(/<!--PROGRESS:\s*\{[^}]*"percent"\s*:\s*(\d+)/);
        if (progressMatch) {
          recentPhases.unshift(Number(progressMatch[1]));
        }
      }
    }
    
    // If we have 2+ consecutive identical phase percentages, the user is stuck
    if (recentPhases.length >= 2) {
      const last = recentPhases[recentPhases.length - 1];
      const prev = recentPhases[recentPhases.length - 2];
      if (last === prev && last > 0) {
        stuckNudge = `\n\n[SYSTEM OVERRIDE] The user has been on the same phase (${last}%) for multiple turns. They have answered sufficiently. Accept their response as-is and IMMEDIATELY advance to the next phase. Do not ask the same question again or rephrase it. Move forward.`;
        console.log(`[proxy-try-chat] Stuck detected at ${last}% — injecting advance nudge`);
      }
    }

    const aiMessages = [
      { role: 'system', content: TRY_SYSTEM_PROMPT },
      {
        role: 'system',
        content: `CRITICAL RULES FOR THIS WEBCHAT SESSION:
- Keep every response under 60 words. The user is on a small screen.
- Ask exactly ONE question per message. Never ask compound or follow-up questions in the same turn.
- Do not repeat or summarize what the user just said back to them. Move forward.
- Be warm but brief. Think text message, not email.${stuckNudge}`
      },
      ...incomingMessages,
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

    let accumulatedResponse = '';
    const encoder = new TextEncoder();
    const reader = geminiResponse.body.getReader();
    const decoder = new TextDecoder();

    const responseStream = new ReadableStream({
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
                  accumulatedResponse += content;
                  parser.feed(content);
                }
              } catch { /* skip invalid JSON */ }
            }
          }

          parser.flush();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
        } catch (e) {
          console.error('[proxy-try-chat] Stream error:', e);
        } finally {
          controller.close();
          // Await side-effects (onboard, playbook) BEFORE worker shuts down
          await parser.awaitPending();
          await saveToTrySession(supabase, sessionId, message, accumulatedResponse, messages).catch(
            (e) => console.error('[proxy-try-chat] Session save error:', e)
          );
        }
      },
    });

    return new Response(responseStream, {
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
