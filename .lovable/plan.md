

# Phase 1 + Phase 5: Personality Overhaul + Database Migration

## Phase 5: Database Migration (no dependencies, do first)

### Table: `telegram_outreach_preferences`
```sql
CREATE TABLE public.telegram_outreach_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  proactive_enabled boolean NOT NULL DEFAULT true,
  max_daily_messages integer NOT NULL DEFAULT 3,
  paused_until timestamptz,
  quiet_hours_start time NOT NULL DEFAULT '20:00',
  quiet_hours_end time NOT NULL DEFAULT '07:00',
  last_engagement_at timestamptz,
  consecutive_ignored integer NOT NULL DEFAULT 0,
  preferred_response_format text NOT NULL DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_outreach_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON public.telegram_outreach_preferences FOR ALL USING (auth.uid() = user_id);
```

### Table: `telegram_outreach_log`
```sql
CREATE TABLE public.telegram_outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  message_text text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  was_engaged boolean DEFAULT false
);
CREATE INDEX idx_outreach_log_user_sent ON public.telegram_outreach_log(user_id, sent_at DESC);
ALTER TABLE public.telegram_outreach_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own outreach" ON public.telegram_outreach_log FOR SELECT USING (auth.uid() = user_id);
```

---

## Phase 1A: `jericho-config.ts` — Add Three Constants

Add after line 207 (after `buildJerichoIntro`):

1. **`JERICHO_PERSONALITY`** — the full unified personality prompt verbatim from spec (HOW YOU SPEAK, HOW YOU COACH, HOW YOU ACT, WHAT YOU NEVER DO). Approximately 40 lines.

2. **`TELEGRAM_ADDENDUM`** — mobile formatting rules:
   - Short paragraphs (2-3 sentences max)
   - Line breaks liberally
   - If answer > ~300 words, give key insight first, ask if they want details
   - Emoji sparingly — one or two for emphasis, not decoration

3. **`SALES_INTELLIGENCE_FRAMEWORK`** — the **FULL** content from the spec. This is NOT 250 lines compressed. It includes ALL of:
   - House methodology (Thrive Today)
   - SPIN Selling
   - Challenger Sale
   - MEDDIC/MEDDPICC
   - Sandler Selling System
   - Gap Selling
   - Integrity Selling (Ron Willingham)
   - Miller Heiman Strategic Selling
   - Synthesized Objection Handling Framework
   - Negotiation Principles (Chris Voss)
   - Ag-Specific Selling Intelligence
   - **Full Agronomic Product Intelligence section** (advisor role, product recommendation framework, program building, package building, seasonal awareness, scenario-based coaching)
   - Application rules and situational routing table
   - "What you never do" sales ethics section

Mark existing `COACHING_PHILOSOPHY`, `COACHING_STYLE`, `MISSING_PLAN_GUIDANCE` with `// @deprecated — use JERICHO_PERSONALITY` comments. Keep them exported.

---

## Phase 1B: `sales-coach/index.ts` — Inject Personality + Framework

**Import** (line 3 area): Add `JERICHO_PERSONALITY, SALES_INTELLIGENCE_FRAMEWORK` from `../_shared/jericho-config.ts`.

**Delete** `methodologyReference` constant (lines 1208-1214). It is fully replaced by `SALES_INTELLIGENCE_FRAMEWORK`.

**Replace lines 1230-1255** (the `systemPrompt` construction):

- **Rec mode** (was lines 1231-1241):
```
${JERICHO_PERSONALITY}

[REC MODE OVERRIDE: Be direct, data-first, 2-3 sentences max. No teaching moments. Peer-to-peer energy.]

${SALES_INTELLIGENCE_FRAMEWORK}
${formattingRules}
${productValidationRules}
${knowledgeContext}
${repDataBlock}
...existing context blocks unchanged...
```

- **Coach mode** (was lines 1243-1255):
```
${JERICHO_PERSONALITY}

${SALES_INTELLIGENCE_FRAMEWORK}
${formattingRules}
${productValidationRules}

AGENTIC BEHAVIOR: After surfacing data or insights, suggest 2-3 contextual actions using → format. These must be specific to what the data shows, not generic. Examples:
→ Draft a pre-call plan for their upcoming meeting
→ Pull last year's purchase comparison
→ Create a deal to track this opportunity

${knowledgeContext}
${repDataBlock}
...existing context blocks unchanged...
```

---

## Phase 1C: `chat-with-jericho/index.ts` — Inject Personality (Growth Only)

**Import** (line 3): Add `JERICHO_PERSONALITY` from `../_shared/jericho-config.ts`. Do NOT import `SALES_INTELLIGENCE_FRAMEWORK` — this is growth coaching.

**Replace lines 564-575** (role intro + philosophy block) with:
```
let systemPrompt = `${JERICHO_PERSONALITY}
```

**Keep lines 577-589** (role context: "YOU ARE A WORLD-CLASS CAREER COACH", core mission, manager context). These define WHAT Jericho does in growth mode, not how it sounds. Trim only if redundant with personality (e.g., line 578 "Direct, honest" is covered by personality — remove that line but keep 584 about tools and 586-589 about core mission).

**Delete lines 611-621** (COACHING STYLE block) — fully replaced by personality.

**Keep lines 622-625** (missing benchmarks guidance) — growth-specific, not in personality.

**Keep lines 627+** (all tool instructions) — unchanged.

---

## Phase 1D: `telegram-webhook/index.ts` — Inject Personality + Addendum

**Import** (line 3): Add `JERICHO_PERSONALITY, TELEGRAM_ADDENDUM, SALES_INTELLIGENCE_FRAMEWORK` from `../_shared/jericho-config.ts`.

**Growth path** (replace lines 676-693):
```typescript
const systemPrompt = `${JERICHO_PERSONALITY}

${TELEGRAM_ADDENDUM}

${jerichoContext.context}
${managerContext || ''}

Recent conversation:
${conversationHistory || 'No previous messages.'}

Intent: ${messageType}
${managerContext ? '- Mention team insights when relevant' : ''}`;
```

**Sales path** (replace lines 715-722): Replace `telegramPrefix` with just `TELEGRAM_ADDENDUM`. Personality and sales framework flow through the sales-coach proxy automatically:
```typescript
const salesResponse = await callSalesCoach(userId, companyId, TELEGRAM_ADDENDUM + '\n\n' + text, conversationHistory);
```

**Onboarding message** (replace lines 504-516): Replace the current linking success message with the richer onboarding welcome from the spec, and auto-insert a `telegram_outreach_preferences` row:
```typescript
// After the upsert into telegram_links succeeds (line 497):
await supabase.from('telegram_outreach_preferences').upsert({
  user_id: linkCode.user_id,
}, { onConflict: 'user_id' });

await sendTelegramMessage(chatId,
  "Welcome to Jericho on Telegram! 🎯\n\n" +
  "I'm your AI performance coach. Think of me as the teammate who always has your numbers ready, never forgets a customer detail, and helps you sell smarter.\n\n" +
  "A few things I can do right now:\n" +
  "- Prep you for customer calls with real data\n" +
  "- Track your pipeline and goals\n" +
  "- Answer product questions instantly\n" +
  "- Coach you on sales techniques\n\n" +
  "Want to try one? Tell me about your next customer meeting and I'll build you a pre-call plan.\n\n" +
  "(Or just start chatting — I'm here whenever you need me.)",
  botToken
);
```

---

## Implementation Order

1. Database migration (both tables)
2. `jericho-config.ts` (add 3 constants, deprecation comments)
3. `sales-coach/index.ts` (import, delete `methodologyReference`, replace system prompts)
4. `chat-with-jericho/index.ts` (import, replace philosophy/style blocks, keep role context)
5. `telegram-webhook/index.ts` (import, replace growth/sales prompts, upgrade onboarding, auto-create preferences row)

All edge functions auto-deploy after edit.

