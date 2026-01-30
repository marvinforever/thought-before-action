

# Fix: Product Catalog Upload Failing - RLS Policy Issue

## Problem Identified

Your product catalog upload is failing with:
```
StorageApiError: new row violates row-level security policy
```

**Root Cause:** The storage bucket `company-documents` only allows uploads from users with `is_admin = true`. Your profile shows:
- Email: `jake.heitshusen@agpartners.net`
- `is_admin: false`

The current policy:
```sql
-- Only admins can upload
(bucket_id = 'company-documents') 
  AND folder = company_id 
  AND is_admin = true  ← This blocks you
```

---

## Solution

Add an RLS policy that allows **all authenticated users** to upload documents to their company's folder in `company-documents`. Sales reps need this ability to add product catalogs and other sales materials.

---

## Database Changes Required

### New Storage Policy: "Users can upload company documents"

```sql
CREATE POLICY "Users can upload company documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);
```

This allows any authenticated user to upload to their own company's folder (matching the existing view policy pattern).

---

## Files Changed

| File | Change |
|------|--------|
| Database migration | Add new storage INSERT policy for authenticated users |

---

## What This Fixes

After this change:
- Any logged-in user can upload files to their company's folder
- Product catalogs from Streamline will save successfully
- The existing admin-only policy remains (admins get upload rights via both policies)
- View access remains unchanged (users can only see their company's documents)

---

## Security Consideration

This is safe because:
1. Users can only upload to their own company's folder (`company_id` check)
2. Files are private (bucket is not public)
3. View policy already restricts access to same-company users
4. Matches the intended use case for Sales Knowledge Base

