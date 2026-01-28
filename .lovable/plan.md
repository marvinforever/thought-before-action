

# Daily Brief Podcast Improvements

## Summary
This plan addresses four key improvements to the Daily Growth Brief:
1. **Economy of Language** - Make the podcast more concise and direct
2. **Streak Challenges** - Add dynamic coaching that calls out streak patterns and challenges users
3. **Feedback System** - Add thumbs up/down with text feedback for self-learning
4. **1-Minute Version** - Add a new ultra-quick duration option
5. **Remove Diagnostic Scores** - Stop reading out engagement/burnout scores since not everyone has access

---

## Part 1: Economy of Language + Streak Challenges

### What Changes
The podcast script generation prompts will be updated to:
- Use fewer words with more impact
- Detect when users keep "capping out" at certain streak lengths (e.g., 2 days, 3 days repeatedly)
- Challenge them directly: *"2-day streak again? Seems like you keep capping out there... Let's make it 7 this time and earn yourself a consistency key."*

### Database Changes
A new column will be added to track streak history:
- Add `streak_history` jsonb column to `leading_indicators` table
- This stores the last 10 streak lengths so Jericho can detect patterns like "keeps hitting 2 days then resetting"

### Script Generation Updates
The system prompt and user context will be enhanced to:
- Pass streak pattern data (e.g., "last 5 streaks: 2, 2, 1, 3, 2")
- Include specific coaching instructions to call out repeated cap-outs
- Reduce word counts by ~15% across all duration configs
- Add stronger variety rules to prevent repetitive praise

---

## Part 2: User Feedback System

### New Database Table
Create `podcast_feedback` table:
- `id` (uuid)
- `profile_id` (uuid, references profiles)
- `episode_id` (uuid, references podcast_episodes)
- `rating` (text: "up" or "down")
- `feedback_text` (text, optional)
- `created_at` (timestamp)

### New UI Component
Add a `PodcastFeedback` component that appears after the episode is played:
- Thumbs up / Thumbs down buttons (same pattern as `MessageFeedback` in Sales Coach)
- When thumbs down is clicked, show a text input: "What could be better?"
- Store feedback with context (episode script preview, topics covered)

### Learning Aggregation
Create `podcast_learning` table (mirrors `sales_coach_learning`):
- `pattern_type` (e.g., "pacing", "too_wordy", "challenge_quality")
- `pattern_key` (specific issue)
- `learned_response` (what to do differently)
- `confidence_score` / `feedback_count`

This feedback will be incorporated into the system prompt for future episodes.

---

## Part 3: 1-Minute Version

### Settings Update
Add new duration option in Settings page:
- "Power Brief (1 min)" - *Ultra-quick hit: one win, one insight, one challenge.*

### Script Generation Config
Add new duration configuration for 1 minute:
```
1: {
  words: '180-220 words',
  structure: `Structure (~180-220 words for 1 minute):
  1. Opening (10 sec, ~20 words): Quick, energetic greeting
  2. One Big Win (15 sec, ~30 words): Single most important achievement or progress
  3. Power Insight (20 sec, ~40 words): One punchy growth insight
  4. Daily Challenge (10 sec, ~20 words): Ultra-short, specific challenge
  5. Closing (5 sec, ~10 words): Quick, warm sign-off`,
  maxTokens: 600
}
```

---

## Part 4: Remove Diagnostic Scores

### What Changes
- Remove the "Pulse Check" section from the podcast script prompts
- Remove all references to engagement, burnout, clarity, career, manager, and retention scores
- Update the user prompt to exclude the `DIAGNOSTIC PULSE` section entirely

---

## Implementation Files

| File | Changes |
|------|---------|
| `supabase/functions/generate-podcast-script/index.ts` | Update prompts, add 1-min config, remove diagnostics, add streak challenge logic |
| `src/components/DailyPodcastPlayer.tsx` | Add PodcastFeedback component after playback |
| `src/components/PodcastFeedback.tsx` | New component (based on MessageFeedback pattern) |
| `src/pages/Settings.tsx` | Add 1-minute duration option |
| Database migration | Add `podcast_feedback`, `podcast_learning` tables, add `streak_history` column |

---

## Technical Details

### Streak Pattern Detection Logic
When fetching habit data, the system will:
1. Query the last 10 completed streaks from `streak_history`
2. Detect "cap out" patterns (3+ similar low numbers)
3. Pass this to the AI: *"Streak pattern: 2, 2, 1, 3, 2 - user keeps capping at 2-3 days"*
4. AI generates a challenge: *"Let's break that ceiling and hit 7 this time"*

### Feedback Learning Loop
1. User provides feedback after listening
2. Feedback stored with episode context
3. Aggregation job (or inline logic) identifies patterns:
   - "too wordy" feedback → increase conciseness instructions
   - "loved the challenge" → reinforce challenge style
4. Learnings injected into system prompt for future episodes

### Duration Word Counts (Updated)
| Duration | Current Words | New Words | Sections |
|----------|--------------|-----------|----------|
| 1 min | N/A | 180-220 | 5 sections |
| 2 min | 400-480 | 340-400 | 6 sections (no pulse check) |
| 5 min | 550-650 | 480-560 | 7 sections (no pulse check) |
| 10 min | 1700-2000 | 1400-1600 | 10 sections (no pulse check) |

