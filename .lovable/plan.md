

# Switch Sales Coach from Opus to Gemini 3.1 Pro

## Why This Makes Sense

The sales coach currently routes through **Claude Opus 4.6** (Anthropic direct API), which is the slowest and most expensive model in the stack ($5/$25 per 1M tokens). Switching to **Gemini 3.1 Pro** via the Lovable AI Gateway would:

- **Significantly faster response times** — Gemini Pro is "medium" latency vs Opus's "slow"
- **No external API key dependency** — routes through Lovable AI Gateway instead of requiring ANTHROPIC_API_KEY
- **Lower cost** — ~$1.25/$5 vs $5/$25 per 1M tokens
- **Great for demos** — snappier responses make a better impression

## What Changes

**One file: `supabase/functions/_shared/ai-router.ts`**

1. Add a new model entry for Gemini 3.1 Pro:
   ```
   'gemini-3-pro': {
     id: 'google/gemini-3.1-pro-preview',
     provider: 'lovable',
     maxTokens: 65536,
     latency: 'medium',
     strengths: ['reasoning', 'sales coaching', 'complex analysis'],
     supportsStreaming: true,
   }
   ```

2. Update the routing table to point `sales-coaching` and `sales-coaching-main` to `gemini-3-pro` instead of `opus`.

3. Update the auto-upgrade threshold (line 228-231) to upgrade to `gemini-3-pro` instead of `opus` for high-token tasks, keeping everything on the Lovable gateway.

## Rollback Plan

If quality isn't where it needs to be after testing, it's a single routing table change back to `opus`. The Anthropic fallback logic already exists if needed.

## Risk

- Gemini 3.1 Pro is a "preview" model — quality may differ from Opus on nuanced multi-step reasoning
- The existing Anthropic fallback (lines 437-444) would need updating since the primary would no longer be Anthropic

This is a low-risk, easily reversible change — perfect for a demo trial run.

