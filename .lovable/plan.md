

# Playbook Interactive Onboarding — Implementation Plan

## Overview

This is a 3-layer update that transforms the `/try` page from a plain text chat into a rich interactive coaching conversation with progress tracking, inline micro-moments (sliders, quick-selects, yes/no), and a playbook generation animation. The AI (OpenClaw primary, Gemini fallback) drives everything via an expanded SSE protocol.

---

## What Changes

### 1. Edge Function: `proxy-try-chat/index.ts` — Marker-to-SSE Conversion

The proxy currently strips all HTML comments (line 88). Instead, it needs to **intercept and convert** them into typed SSE events.

**Changes:**
- Replace the blanket `content.replace(/<!--.*?-->/g, '')` with targeted regex parsing for 4 marker types:
  - `<!--INTERACTIVE:{json}-->` → emit `{ type: "interactive", ...parsed }`
  - `<!--PROGRESS:{json}-->` → emit `{ type: "progress", ...parsed }`
  - `<!--GENERATION:{json}-->` → emit `{ type: "generation", ...parsed }`
  - `<!--EXTRACTED_DATA:{json}-->` → **do not send to client**; save to `try_sessions.extracted_data` and fire `try-jericho-onboard`
- Clean text content still emits as `{ type: "text", content: "..." }`
- Replace the old `<!--ONBOARDING_COMPLETE:...-->` parsing in `saveToTrySession` with the new `EXTRACTED_DATA` marker
- Apply same marker parsing to the **fallback path** (currently just passes through raw — needs the same intercept logic)

### 2. Edge Function: `chat-with-jericho/index.ts` — New Fallback System Prompt

Replace the current `trySystemPrompt` (lines 106–138) with the full 8-turn Playbook coaching prompt from Layer 3A. This is a large string replacement — the new prompt includes:
- 8 structured conversation turns with specific interactive element emissions
- 10 extraction rules
- Interactive element format documentation
- Personality/tone guidelines

No structural code changes needed — just swap the prompt string.

### 3. Frontend: `src/pages/TryJericho.tsx` — Full Interactive UI

This is the largest change. The page evolves from a text-only chat to support 5 SSE message types and 3 new interactive components.

**New state variables:**
- `progressPercent` / `progressLabel` — driven by `progress` SSE events
- `generating` / `playbookReady` — driven by `generation` SSE events

**Expanded message type:**
```
type Message = {
  id: string;
  role: "jericho" | "user" | "interactive";
  text: string;
  interactiveData?: InteractiveElement;
  interactiveResponse?: string | number;
};
```

**SSE parsing loop update:** Switch on `parsed.type` to handle `text`, `interactive`, `progress`, `generation`, `done`. Unknown/missing type defaults to `text` for backward compat.

**New inline components (built directly in the file or as small sub-components):**

- **`PlaybookProgressBar`** — thin animated bar below header, driven by `progress` events. Uses framer-motion spring animation. Shows phase label with AnimatePresence crossfade.

- **`ScaleInput`** — row of 10 tappable circles for 1-10 ratings. Single-tap selects and sends `[INTERACTIVE:{id}:{value}]`. Locks after selection. 40px min tap targets for mobile.

- **`QuickSelect`** — stacked pill buttons for 2-4 options. Tap selects, others fade. Sends `[INTERACTIVE:{id}:{key}]`.

- **`YesNoInput`** — two side-by-side pills. Sends `[INTERACTIVE:{id}:yes/no]`.

- **`PlaybookGenerating`** — replaces chat input when `generation.started`. Pulsing animation, cycling status text ("Analyzing your strengths…", "Mapping your growth edge…", etc.). On `generation.complete`, resolves to "Your Playbook is ready!" with CTA to `/auth`.

**Interactive response rendering:** When user selects a value, it's shown as a styled user bubble (e.g., "8/10" with a mini gauge for scales, option text for quick-selects).

**Landing page copy updates:**
- "Takes about 3 minutes." → "Just a conversation."
- "Growth Map" → "Growth Playbook" throughout
- Feature pills: `["Growth Playbook", "Career Clarity", "Strengths Map", "Development Edge", "Quick Win"]`
- Meta description updated accordingly

### 4. Edge Function: `try-jericho-onboard/index.ts` — Accept Full Payload

Update to accept the expanded `diagnosticData` object with all 21 conversational + 8 interactive data points. The current function already accepts `diagnosticData` as a flexible object, so this is mostly ensuring the coaching insights generation uses the new field names (e.g., `challenge_severity`, `energy_score`, `engagement_score` etc.).

---

## Implementation Order

1. **`proxy-try-chat`** — marker parsing (enables the protocol regardless of frontend state)
2. **`chat-with-jericho`** — new fallback system prompt
3. **`TryJericho.tsx`** — progress bar, interactive components, generation animation, copy updates
4. **`try-jericho-onboard`** — expanded payload handling

---

## Technical Notes

- **Backward compatibility:** If SSE event has no `type` field, treat as `text`. This means the existing OpenClaw responses work during migration before OpenClaw's prompt is updated.
- **Marker parsing happens on accumulated content per-chunk**, not per-line. HTML comments may span token boundaries, so the proxy buffers and checks after each content accumulation.
- **No database migrations needed.** `try_sessions.extracted_data` is already a JSONB column that accepts arbitrary structure. `user_active_context.onboarding_data` is also JSONB.
- **framer-motion** is already installed and used extensively in the current `TryJericho.tsx`.
- **react-markdown** is already installed and used for rendering AI messages.

---

## Open Questions (for you to decide)

1. **Fallback model:** Currently `gemini-2.5-flash`. The 8-turn + interactive timing requires strong instruction following. Should it stay flash or upgrade to `gemini-2.5-pro`? Cost difference is significant but this is the conversion funnel.

2. **Playbook generation trigger:** When `GENERATION:started` fires, what actually builds the Playbook? Should we call `generate-leadership-report` or does OpenClaw handle it? For now I'll trigger `try-jericho-onboard` with the extracted data (which already exists) — the actual Playbook generation can be wired separately.

3. **Phone collection:** The new prompt doesn't include phone. Keep it cut for v1?

