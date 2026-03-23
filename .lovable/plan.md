

## Remove OpenClaw from /try — Gemini-Only

### Scope

OpenClaw is **only** referenced in `supabase/functions/proxy-try-chat/index.ts` (lines 286–521). The sales module (`sales-coach/index.ts`) has its own separate model routing — completely untouched by this change.

### Changes — Single File

**`supabase/functions/proxy-try-chat/index.ts`**

1. **Delete the entire OpenClaw primary path** (lines 286–521): the `USE_OPENCLAW_TRY` check, the 25-second timeout, the OpenClaw-specific system prompt construction, the fetch + stream handler, and the catch/fallback block.

2. **Promote the Gemini path** (currently the "FALLBACK" path starting around line 524) to be the only path. Remove the "FALLBACK" comment — it's now primary. No conditional wrapping needed.

3. **Remove OpenClaw-specific scratchpad filters** from `emitText` (lines 152–154) — the `Draft Response:`, `Refine Response:`, `Final Polish:`, `STOP HERE` regex lines. These only exist because of OpenClaw's reasoning leakage. Gemini doesn't emit them. Keep the malformed-marker strippers (lines 156–161) as safety net.

4. **Remove the `<think>` block stripper** if present — another OpenClaw-only artifact.

### What stays

- `TRY_SYSTEM_PROMPT` from `_shared/try-system-prompt.ts` — already the Gemini prompt, unchanged
- `MarkerParser` class — stays, just without OpenClaw-specific filters
- All session persistence logic — unchanged
- The `OPENCLAW_*` secrets stay dormant in the vault (no need to delete)

### Net result

~230 lines deleted. Function drops from ~711 to ~480 lines. Single model path, no timeouts, no fallback branching.

### Deployment

Redeploy `proxy-try-chat` edge function.

### Sales module

**Not affected.** `sales-coach/index.ts` has its own model routing and will continue using whatever model it's configured for (including OpenClaw/Opus via direct API). Zero changes needed there.

