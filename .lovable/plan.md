

## Fix: Strip HTML comment markers from /try chat display

### Problem

The OpenClaw model emits `<!--PROGRESS:...-->`, `<!--INTERACTIVE:...-->`, and other HTML comment markers inline in its text. The `proxy-try-chat` edge function is supposed to parse these and convert them into typed SSE events — but sometimes the markers leak through (partial streaming, malformed output, or the proxy's regex missing edge cases). When that happens, raw marker text like `<5,"label":"Getting to know you..."}-->` appears in the chat bubble.

### Root cause

Two layers need fixing:

1. **Frontend display (line 472 + line 810)**: The accumulated text is displayed with no marker stripping. Line 810 only strips `[INTERACTIVE:...]` brackets but not HTML comments.

2. **Streaming accumulation (line 472)**: Markers accumulate into the display text as they stream in, so even if the proxy later emits a proper typed event, the raw marker text is already visible.

### Fix (2 changes in TryJericho.tsx)

**Change 1 — Strip markers during streaming accumulation (line 472)**

Replace:
```typescript
const display = accumulated.trim();
```
With:
```typescript
const display = accumulated
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]*"label"\s*:\s*"[^"]*"[^>]*-->/g, '')
  .replace(/<\d+[^>]*-->/g, '')
  .trim();
```

This strips:
- Complete HTML comments (`<!--...-->`)
- Dangling/malformed marker fragments where the `<!--` prefix got cut by streaming

**Change 2 — Strip markers at render time (line 810)**

Replace:
```typescript
<ReactMarkdown>{msg.text.replace(/\[INTERACTIVE:[^\]]*\]/g, '').trim()}</ReactMarkdown>
```
With:
```typescript
<ReactMarkdown>{msg.text.replace(/<!--[\s\S]*?-->/g, '').replace(/\[INTERACTIVE:[^\]]*\]/g, '').replace(/<[^>]*"label"\s*:\s*"[^"]*"[^>]*-->/g, '').replace(/<\d+[^>]*-->/g, '').trim()}</ReactMarkdown>
```

**Change 3 — Same fix for the final flush path (line 566)**

Apply the same marker-stripping regex to the final flush `accumulated.trim()` on line 566.

### Files changed
- `src/pages/TryJericho.tsx` — Add marker-stripping regex at 3 locations

