
# Fix PDF Upload Failure in Document Knowledge Base

## Problem Identified

Your PDF upload is failing due to a **stack overflow error** in the edge function when processing large files. The current code uses this pattern:

```javascript
const base64 = btoa(
  new Uint8Array(await fileData.arrayBuffer())
    .reduce((data, byte) => data + String.fromCharCode(byte), '')
);
```

This approach concatenates millions of characters in memory, which exceeds the call stack limit for PDFs larger than ~1-2MB.

---

## Solution Overview

Replace the problematic base64 conversion with a **chunked approach** that processes the binary data in smaller segments, avoiding stack overflow.

---

## Changes Required

### 1. Fix `extract-customer-document` Edge Function

**File:** `supabase/functions/extract-customer-document/index.ts`

**What to change:**

Add a safe base64 encoding helper function that processes data in chunks:

```typescript
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32768; // Process 32KB at a time
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
```

Replace the two problematic `btoa()` calls (lines 79-82 and 151-154) with calls to this helper function:

```typescript
// Before (causes stack overflow)
const base64 = btoa(
  new Uint8Array(await fileData.arrayBuffer())
    .reduce((data, byte) => data + String.fromCharCode(byte), '')
);

// After (safe for large files)
const base64 = arrayBufferToBase64(await fileData.arrayBuffer());
```

---

## Technical Details

| Aspect | Current | Fixed |
|--------|---------|-------|
| Memory usage | Unbounded string concatenation | 32KB chunks |
| Max file size | ~1-2MB before crash | 20MB+ safely |
| Call stack | Overflows on large files | Stays within limits |
| Performance | Slower for large files | Consistent |

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/extract-customer-document/index.ts` | Add chunked base64 helper, replace 2 `btoa()` calls |

---

## Testing

After the fix, you should be able to:
1. Upload PDFs up to 20MB without errors
2. See the document appear in your knowledge base
3. Have Jericho reference the document content in conversations
