
# Sales Page Rewrite: "Systems > Goals" Hero Concept

## Overview

Rewrite the askjericho.com home page (`src/pages/Sales.tsx`) with the new hero hook that positions Jericho as the system that catches you when motivation fails.

---

## New Hero Section

### Headline Structure
```
"You don't rise to your goals.
You fall to your systems."

Welcome to Jericho.
```

### Supporting Copy
The AI-powered system that shows up for your team every single day—with personalized coaching, daily audio briefs, and the accountability that actually sticks.

### Visual Treatment
- Keep the navy background with gold accent blurs
- Remove current "For Growth minded leaders looking to..." pill badge
- Add a new subtle badge: "The System That Shows Up Daily"
- Animate "Welcome to Jericho." with a slight delay for dramatic effect
- Keep single "Book a Demo" CTA button

---

## Page Flow Updates

### Section 2: "Who This Is For" (Keep + Minor Update)
Keep the current structure but update opening to connect to the hook:

**Before:** "This Is For Leaders Who Are..."
**After:** "This Is For Leaders Who Know Goals Aren't Enough"

Update the 4 bullet points to reference systems thinking:
- "Have ambitious goals but inconsistent follow-through across the team"
- "Know that motivation fades—and need something that doesn't"
- "Want their people to grow without carrying the development load"
- "Ready to install a daily system that builds momentum over time"

### Section 3: "The Real Problem" (Keep Structure)
Keep current content—it flows well from "goals aren't enough" into "talent on paper, chaos in reality"

### Section 4: "The Transformation" (Update From/To)
Update to emphasize systems vs goals:

**From:**
- Goal-setting without follow-through
- Motivation that fades by February
- Training that's forgotten in a week
- Development that depends on leader bandwidth

**To:**
- Daily coaching that never misses a day
- Personalized audio briefs every morning
- Habit tracking that builds real momentum
- An AI that knows your goals and helps you hit them

### Section 5: "How It Works" (Major Update - AI Features)
Restructure around the NEW capabilities:

| # | Feature | Description |
|---|---------|-------------|
| 1 | Daily Growth Podcast | Wake up to a personalized audio brief about YOUR wins, YOUR goals, and YOUR next move |
| 2 | Conversational Coaching | Chat or talk to Jericho anytime—it knows your pipeline, your habits, and your history |
| 3 | Habit & Streak Tracking | Daily behaviors drive results. Watch your streaks grow and your momentum compound |
| 4 | AI-Powered 1:1 Prep | Data-backed agendas replace guesswork. Know exactly what to discuss |
| 5 | Career Path Intelligence | See where you are, where you're going, and exactly how to get there |
| 6 | Sales Intelligence (if applicable) | Customer history, call prep, and proposals—all from a conversation |

### Section 6: "For Leaders" (Keep + Update Copy)
Update the "More of this" list:
- Daily accountability without daily effort
- A system that remembers everything
- Team development on autopilot
- Your leadership capacity back

### Section 7: "Why It Works" (Update to Systems Theme)
Update the 4 proof points:
- "Systems beat willpower—Jericho shows up every day, even when motivation doesn't"
- "Personalization beats generic—every podcast, every nudge is tailored to the individual"
- "AI beats bandwidth—your team gets coaching without draining your time"
- "Data beats subjectivity—progress is visible, objective, and trackable"

### Section 8: "The Product" (Update Feature List)
Update to reflect current capabilities:
- Personalized daily audio coaching
- Conversational AI with voice support
- Habit tracking with streak gamification
- Career path and capability mapping
- 1:1 meeting preparation
- Sales intelligence and customer history

### Section 9: Final CTA (Update Headline)
**Current:** "Ready to Stop Carrying Everything?"
**New:** "Ready to Build a System That Never Stops?"

Update supporting copy:
"Your goals inspire. Your system delivers. Let Jericho be the daily engine that moves your team forward—one day, one habit, one win at a time."

---

## Technical Implementation

### Files to Modify
- `src/pages/Sales.tsx` - Complete rewrite of content sections

### Changes Summary

1. **Lines 281-326 (Hero Section)**
   - Replace headline with systems quote
   - Add "Welcome to Jericho." with animation delay
   - Update supporting copy
   - Update badge text

2. **Lines 328-363 (Who This Is For)**
   - Update section title
   - Update 4 bullet points to systems theme

3. **Lines 433-462 (From/To Transformation)**
   - Update both columns with new content

4. **Lines 475-535 (How It Works)**
   - Replace 6 feature cards with AI-native features
   - Add new icons: Headphones, Mic, Flame (streaks), etc.

5. **Lines 539-587 (For Leaders)**
   - Update "More of this" list

6. **Lines 591-640 (Why It Works)**
   - Update 4 proof points to systems theme

7. **Lines 644-684 (The Product)**
   - Update 6 feature items

8. **Lines 687-734 (Final CTA)**
   - Update headline and supporting copy

### New Imports Needed
```typescript
import { Headphones, Mic, Flame } from "lucide-react";
```

---

## Visual Enhancements

- Keep existing animation system (fadeIn, staggerContainer)
- Keep FlowArrow transitions between sections
- Keep SideFlowArrows for visual movement
- Keep client logos section unchanged
- Keep Demo Form Dialog unchanged

---

## Copy Summary

### Key Phrases to Thread Throughout
- "The system that shows up daily"
- "Your goals inspire. Your system delivers."
- "Accountability that actually sticks"
- "Personalized coaching, every single day"
- "An AI that knows your business"

### Tone
- Confident but not arrogant
- Systems-focused, not feature-focused
- Emphasize daily consistency over one-time training
- Position Jericho as infrastructure, not just software
