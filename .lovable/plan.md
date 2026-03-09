

## Update PostHog API Key

Simple update to `src/lib/posthog.ts` — replace the placeholder API key with the real one and add the `person_profiles` setting.

### Changes
**`src/lib/posthog.ts`** (lines 4-5, 12-17):
- Replace `'YOUR_POSTHOG_API_KEY'` with `'phc_y8c83PLLFVIXjda71000PKruHbWRdXcqWMYNI8tfMhB'`
- Add `person_profiles: 'identified_only'` to the init config

