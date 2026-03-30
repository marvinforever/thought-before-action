

# Plan: Native Playbook Viewer + Stuck Fix (Layer 1)

## Scope
Two deliverables only. No activation workflows, no playbook regeneration — those come later.

## Step 1: Fix Stuck Onboarding

**File:** `supabase/functions/proxy-try-chat/index.ts`

- Track the phase number from `<!--PROGRESS:` markers across turns
- If the same phase appears in 2+ consecutive assistant messages, append a system instruction: "The user has answered sufficiently. Accept their response and advance to the next phase immediately."
- Store phase history in the conversation context already being passed

**File:** `src/pages/TryJericho.tsx`

- Add a subtle "Skip this question →" button that appears after 2 user messages on the same phase
- On click, send a system-level message like "[user skipped]" to trigger advance

## Step 2: Native Playbook Viewer

**New file:** `src/components/PlaybookViewer.tsx`

Replace the iframe-based display with a native React component that reads structured data from `leadership_reports`:

- `report_content.narrative` — north star, snapshot, superpower, growth edge, quick win, learning resources
- `report_content.engagement_scores` — composite score, burnout risk, role strain, etc.
- `capability_matrix` — 7 capabilities with levels, priorities, reasoning

Sections to render natively:
1. **Score Overview** — engagement scores as visual gauges/rings
2. **North Star Card** — prominent display with the user's north star text
3. **Intro paragraph** — "This Playbook was built from a single conversation..." with gold accent on "this document breathes"
4. **Snapshot** — key paragraphs with metric indicators
5. **Superpower + Growth Edge** — side-by-side cards
6. **Capability Map** — 7 capabilities with level badges and priority indicators
7. **Quick Win** — checklist-style card with steps
8. **Learning Resources** — resource cards
9. **Diagnostic Grid** — score breakdown

Each section includes an action link to the relevant in-app feature (capabilities page, 90-day tracker, resources).

Keep a "View full report" fallback link that opens the HTML version in a new tab.

**File:** `src/components/GrowthPlaybookBanner.tsx`

- Replace the iframe dialog with `PlaybookViewer`
- Keep the banner detection logic (query `leadership_reports` for `individual_playbook`)
- Change banner text for users who have already viewed it: "Your Growth Playbook" (no urgency)

## Technical Details

**Data source** (no new tables or migrations):
```
leadership_reports table:
  report_content -> { html, narrative: { north_star_text, snapshot_paragraphs, 
    superpower_paragraphs, growth_edge_quote, priorities[], quick_win_title, 
    quick_win_steps[], learning_resources[], diagnostic_commentary }, 
    engagement_scores: { composite, burnoutRisk, roleStrain, ... } }
  capability_matrix -> [{ capability_name, category, current_level, 
    target_level, is_priority, reasoning }]
```

**Deployment:** Redeploy `proxy-try-chat` edge function after stuck-fix changes.

## What This Sets Up for Later
- Layer 2: Playbook Activation wizard plugs into the same `PlaybookViewer` component
- Layer 3: Playbook regeneration writes updated data to the same `leadership_reports` row, and the viewer automatically reflects changes

