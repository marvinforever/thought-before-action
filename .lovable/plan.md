

# PostHog Analytics Integration

## Overview
Install PostHog client-side SDK, initialize it globally, and fire custom events at key moments across the diagnostic funnel, /try coaching page, and conversion points. Also create 3 A/B feature flags client-side with localStorage persistence.

## Technical Plan

### 1. Install PostHog SDK
- Add `posthog-js` npm package

### 2. Secret: PostHog API Key
- The PostHog project API key is a **publishable** client-side key (like Stripe's publishable key) — safe to store in code
- Add it as a constant in a new `src/lib/posthog.ts` init file
- User will need to provide the API key after creating their PostHog account

### 3. Create `src/lib/posthog.ts` — Init + Helper
- Initialize `posthog.init(apiKey, { api_host })` 
- Export typed helper: `trackEvent(name, properties)`
- Export A/B flag helper that reads/sets localStorage variants

### 4. Load PostHog globally in `src/App.tsx`
- Import and call init from `src/lib/posthog.ts` at module level (runs once on app load)

### 5. A/B Feature Flags (localStorage-based)
In `src/lib/posthog.ts`:
- On init, check localStorage for `ph_landing_headline_variant`, `ph_cta_copy_variant`, `ph_try_opening_variant`
- If not set, randomly assign A/B/C and persist
- Export `getVariant(flagName)` helper
- Register variants as PostHog person properties via `posthog.register()`

### 6. Fire Custom Events — File Changes

| Event | File | Trigger |
|-------|------|---------|
| `landing_page_viewed` | `AIReadinessLanding.tsx` | useEffect on mount, read utm_source from URL params |
| `diagnostic_started` | `AIReadinessLanding.tsx` | When user clicks Start |
| `diagnostic_phase_completed` | `AIReadinessLanding.tsx` | After each phase transition |
| `diagnostic_abandoned` | `AIReadinessLanding.tsx` | beforeunload listener + cleanup |
| `diagnostic_completed` | `AIReadinessLanding.tsx` | Final phase completion |
| `report_viewed` | `AIReadinessReport.tsx` | useEffect on mount |
| `try_cta_clicked` | `AIReadinessReport.tsx` | CTA click handler |
| `coaching_conversation_started` | `TryJericho.tsx` | When handleStart fires |
| `buying_signal_expressed` | `TryJericho.tsx` | Detect pricing/team keywords in user messages |
| `meeting_booked` | Where meeting booking occurs (likely `RequestMeetingDialog.tsx`) | On successful booking |

### 7. Files Modified
- `index.html` — no changes needed (SDK loaded via JS import)
- `src/lib/posthog.ts` — **new file**
- `src/App.tsx` — import posthog init
- `src/pages/AIReadinessLanding.tsx` — 5 events
- `src/pages/AIReadinessReport.tsx` — 2 events
- `src/pages/TryJericho.tsx` — 2-3 events
- `src/components/RequestMeetingDialog.tsx` — meeting_booked event

### Prerequisites
- User needs to create a PostHog account and provide the project API key + API host URL before implementation

