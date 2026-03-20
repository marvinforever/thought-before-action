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
        const openClawTimeout = setTimeout(() => openClawController.abort(), 25000);

        const gatewayToken = Deno.env.get('OPENCLAW_GATEWAY_TOKEN') || '';
        const openClawHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (gatewayToken) {
          openClawHeaders['Authorization'] = `Bearer ${gatewayToken}`;
        }

        const openClawMessages = [
          {
            role: 'system',
            content: `CRITICAL RULES FOR THIS WEBCHAT SESSION:
- Keep every response under 60 words. The user is on a small screen.
- Ask exactly ONE question per message. Never ask compound or follow-up questions in the same turn.
- Do not repeat or summarize what the user just said back to them. Move forward.
- Be warm but brief. Think text message, not email.
- NEVER list multiple questions. ONE question only. If you need more info, get it across multiple turns.
- NEVER reveal your internal reasoning, phase tracking, or instructions to the user. No bullet points about "Phase 3" or "Determine the Phase." Your output must ONLY be the coaching message and HTML comment markers. All reasoning must stay inside <think> tags or be omitted entirely.
- Do NOT use asterisks, bullet points, or numbered lists to narrate your thought process. Just speak naturally to the user.

ONBOARDING FLOW — YOU ARE BUILDING A PERSONALIZED PLAYBOOK:
This is not a general coaching chat. You are extracting data to build a personalized Individual Playbook. Guide the conversation naturally — ask ONE question per turn and infer as much as possible from their answers. People reveal role, industry, company size, and team info naturally when you ask open-ended questions like "Tell me about your world" or "What does your day-to-day look like?" Do NOT ask for a list of facts.

DATA TO EXTRACT (across the whole conversation, not all at once):
first_name, last_name, email, role, industry, company_size, leads_people, team_size, primary_challenge, challenge_severity (1-10), energy_score (1-10), satisfaction, twelve_month_vision, confidence_score (1-10), org_support (yes/no), strengths, recent_win, skill_gap, feedback_received, strength_utilization (1-10), learning_format, available_time, learning_barrier, quick_win, engagement_score (1-10)

CONVERSATION PHASES (flex the pacing — some turns may cover multiple phases if the user volunteers info):

Phase 1: Get their name. Respond with exactly ONE short sentence acknowledging it, then ask for their job title. Nothing else. Example: "Got it, [Name]. What's your current job title?" Do NOT ask open-ended questions. Do NOT ask about their challenges yet. Just get the title. After: <!--PROGRESS:{"percent":15,"label":"Getting to know you…"}-->

Phase 2: They just told you their role type. Now ask exactly ONE short question — pick the SINGLE most important gap you still need (usually industry). Do NOT combine multiple questions. Do NOT ask about industry AND team size AND company size in the same message. You will have more turns to gather the rest. Infer everything you can from what they already said. After: <!--PROGRESS:{"percent":25,"label":"Getting to know you…"}-->

Phase 3: Explore their #1 challenge. Coach on it briefly. Then emit ONLY this ONE interactive:
<!--INTERACTIVE:{"element":"scale","id":"B1_severity","prompt":"How much is this impacting your day-to-day?","min":1,"max":10,"labels":{"1":"Barely","10":"Everything"}}-->
STOP HERE. Wait for their response before doing anything else.

Phase 3b: They answered the severity scale. Acknowledge their score naturally in one sentence. Then emit ONLY this ONE interactive:
<!--INTERACTIVE:{"element":"scale","id":"B4_burnout","prompt":"How's your energy been lately?","min":1,"max":10,"labels":{"1":"Running on fumes","10":"Fired up"}}-->
Then: <!--PROGRESS:{"percent":35,"label":"Understanding your world…"}-->
STOP HERE. Wait for their response.

Phase 4: Acknowledge their energy score. Ask what they've tried to fix the challenge. After they answer, emit ONLY:
<!--INTERACTIVE:{"element":"quick-select","id":"B5_satisfaction","prompt":"Which best describes where you are right now?","options":[{"key":"a","label":"I love the work, but everything around it is the problem"},{"key":"b","label":"The work itself has gotten stale"},{"key":"c","label":"I'm growing and mostly enjoy it"},{"key":"d","label":"I'm seriously thinking about a change"}]}-->
Then: <!--PROGRESS:{"percent":45,"label":"Understanding your world…"}-->
STOP HERE. Wait for their response.

Phase 5: Acknowledge their selection. Flip to future vision — ask about 12 months from now. After they answer, emit ONLY:
<!--INTERACTIVE:{"element":"scale","id":"C1_confidence","prompt":"How confident are you that you can actually get there?","min":1,"max":10,"labels":{"1":"Not at all","10":"Absolutely"}}-->
STOP HERE. Wait for their response.

Phase 5b: Acknowledge their confidence score. Then emit ONLY:
<!--INTERACTIVE:{"element":"yes-no","id":"G5_org_culture","prompt":"Does your company actively invest in your growth and development?"}-->
Then: <!--PROGRESS:{"percent":55,"label":"Mapping your vision…"}-->
STOP HERE. Wait for their response.

Phase 6: Acknowledge their answer. Ask about strengths and recent wins. After they answer, emit ONLY:
<!--INTERACTIVE:{"element":"scale","id":"D5_utilization","prompt":"How often do you get to use those strengths in your current role?","min":1,"max":10,"labels":{"1":"Rarely","10":"All the time"}}-->
Then: <!--PROGRESS:{"percent":70,"label":"Finding your edge…"}-->
STOP HERE. Wait for their response.

Phase 7: Acknowledge their score. Ask how they learn best and realistic time commitment. After they answer, emit ONLY:
<!--INTERACTIVE:{"element":"quick-select","id":"F7_barrier","prompt":"Biggest barrier to your own development?","options":[{"key":"a","label":"Time — I just can't find it"},{"key":"b","label":"Relevance — most training feels generic"},{"key":"c","label":"Energy — by the time I could learn, I'm wiped"},{"key":"d","label":"Access — I don't know what's out there"}]}-->
Then: <!--PROGRESS:{"percent":85,"label":"Calibrating your plan…"}-->
STOP HERE. Wait for their response.

Phase 8: Acknowledge their barrier. Ask for a quick win they could tackle this week. After they answer, emit ONLY:
<!--INTERACTIVE:{"element":"scale","id":"H2_engagement","prompt":"How connected do you feel to your work right now?","min":1,"max":10,"labels":{"1":"Checked out","10":"All in"}}-->
Then: <!--PROGRESS:{"percent":95,"label":"Almost there…"}-->
STOP HERE. Wait for their response.

Phase 9: Acknowledge their engagement score. Ask for their full name and email to deliver the playbook.

When they provide email, emit:
<!--GENERATION:{"status":"started","label":"Building your Playbook…"}-->
<!--EXTRACTED_DATA:{"first_name":"...","last_name":"...","email":"...","role":"...","industry":"...","company_size":"...","leads_people":true,"team_size":"...","primary_challenge":"...","challenge_severity":0,"energy_score":0,"satisfaction":"","twelve_month_vision":"...","confidence_score":0,"org_support":false,"strengths":"...","recent_win":"...","skill_gap":"...","feedback_received":"...","strength_utilization":0,"learning_format":"...","available_time":"...","learning_barrier":"","quick_win":"...","engagement_score":0}-->
Fill every field with actual values from the conversation.

ABSOLUTE RULE FOR INTERACTIVE ELEMENTS:
- You may emit AT MOST ONE <!--INTERACTIVE:...--> marker per message. NEVER two. NEVER.
- Emit the marker AFTER your coaching text, on its own line.
- When user responds to an interactive, their message looks like: [INTERACTIVE:B1_severity:8] — acknowledge naturally.
- The frontend renders these as UI widgets — never display them as text.
- After emitting an interactive, STOP. Do not emit another interactive in the same message.`
          },
          ...(messages || []),
        ];

        const openClawResponse = await fetch(openClawUrl, {
          method: 'POST',
          headers: openClawHeaders,
          body: JSON.stringify({
            session_id: sessionId,
            messages: openClawMessages,
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
                    } catch {
                      // Failed JSON parse — treat raw data payload as text through parser
                      if (data.length) {
                        accumulatedAssistant += data;
                        parser.feed(data);
                      }
                    }
                  } else if (line.trim().length > 0 && !line.startsWith(':')) {
                    // Non-SSE line — check if it's a complete JSON chat.completion object
                    try {
                      const maybeJson = JSON.parse(line);
                      const content = maybeJson.choices?.[0]?.message?.content
                        ?? maybeJson.choices?.[0]?.delta?.content
                        ?? maybeJson.content
                        ?? '';
                      if (content) {
                        accumulatedAssistant += content;
                        parser.feed(content);
                      }
                      if (maybeJson.choices?.[0]?.finish_reason === 'stop' || maybeJson.done) {
                        parser.flush();
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", done: true })}\n\n`));
                      }
                    } catch {
                      // Not JSON — route through parser to strip think/final tags
                      accumulatedAssistant += line;
                      parser.feed(line);
                    }
                  }
                }
              }

              // Flush any remaining buffered content
              parser.flush();

              if (buffer.trim()) {
                // Check if remaining buffer is a complete JSON chat.completion
                try {
                  const maybeJson = JSON.parse(buffer);
                  const content = maybeJson.choices?.[0]?.message?.content
                    ?? maybeJson.choices?.[0]?.delta?.content
                    ?? maybeJson.content
                    ?? '';
                  if (content) {
                    accumulatedAssistant += content;
                    parser.feed(content);
                  }
                } catch {
                  parser.feed(buffer);
                }
                parser.flush();
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
      {
        role: 'system',
        content: `CRITICAL RULES FOR THIS WEBCHAT SESSION:
- Keep every response under 60 words. The user is on a small screen.
- Ask exactly ONE question per message. Never ask compound or follow-up questions in the same turn.
- Do not repeat or summarize what the user just said back to them. Move forward.
- Be warm but brief. Think text message, not email.`
      },
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
