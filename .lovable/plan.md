

# Plan: Post-Playbook Engagement — "Stage 2" Conversation Flow

## What We're Building

After the user provides their email and the playbook generation is triggered, Jericho doesn't stop. It transitions into a **Stage 2** flow that keeps the user engaged, enriches their data, and teaches them about Jericho — all while rewarding them for staying.

## Four Key Behaviors to Add

### 1. Playbook Delivery Message
Immediately after emitting the `GENERATION` and `EXTRACTED_DATA` markers, Jericho tells the user:
- Their playbook is being built and will land in their inbox in a few minutes
- Check spam if they don't see it
- Humor: "It's worth the wait — trust me."

### 2. Job Description Upload Offer
Right after the delivery message, offer to accept a JD:
- "Got a job description handy? Drop it in and I'll supercharge your playbook with it."
- If they don't have one: "No worries — we can grab it later."
- If they do paste/upload one, acknowledge it and emit a new `<!--EXTRACTED_DATA:...-->` update with a `job_description` field

### 3. Stage 2 Continued Coaching Questions
After the JD offer (whether they provide one or not), Jericho keeps going with deeper questions. The prompt will include a **Stage 2 question bank** covering:
- Leadership style / management philosophy
- Career aspirations (where do you want to be in 3 years?)
- Biggest recent win
- What feedback they've received lately
- What skill they wish they had
- How they handle conflict
- What motivates them most

Rules for Stage 2:
- One question per turn (same as Stage 1)
- Response length up to 60 words (rapport is established)
- Periodically reinforce: "You're in the top 10% of people who keep going — every answer makes your playbook sharper."
- Pepper in **Jericho product education**: "This is actually how Jericho works day-to-day — it learns from conversations like this and turns them into action plans."
- Keep the humor dial turned up

### 4. Jericho FAQ / Pricing Handling
Add a section to the prompt for handling product questions mid-conversation:
- **Pricing**: "Ha — like me so much you're ready to buy? I'm flattered. I'm not allowed to share pricing, but I can get you on a call with one of our team. Want me to set that up?"
- **What is Jericho?**: Brief, punchy explanation — personal performance coach that learns from you and builds actionable growth plans
- **How does it work?**: "Exactly like this — we talk, I learn, and I build you a plan that actually fits your life. Then I check in, nudge you, and keep you accountable."

## Technical Changes

### File: `supabase/functions/_shared/try-system-prompt.ts`

Add a new **STAGE 2** section after Phase 9 in the system prompt covering:

1. **Transition message template** — playbook in inbox, check spam, stay and chat
2. **JD upload offer** — optional, low pressure
3. **Stage 2 question bank** — 8-10 deeper questions to cycle through, one per turn
4. **Gamification language** — "top 10%", "your playbook just got better", "most people bounce by now — you're not most people"
5. **Product education snippets** — weave in naturally, never salesy
6. **FAQ handling rules** — pricing deflection with humor, feature explanations, booking calls
7. **Response length**: Up to 60 words per turn in Stage 2

### File: `supabase/functions/proxy-try-chat/index.ts`

No structural changes needed — the existing streaming + marker system handles Stage 2 naturally since it's all prompt-driven.

### Deployment

Redeploy `proxy-try-chat` edge function to pick up the updated prompt.

