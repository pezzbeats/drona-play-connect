
The user wants a fully detailed ElevenLabs system prompt — not code changes, just a copy-pasteable system prompt document. This is a content generation task, not an implementation task. No plan needed — I should just write and present the system prompt directly.

Let me now construct the full system prompt with all the required sections:

1. Agent identity & personality — "Drona", warm Hinglish persona
2. Knowledge base references — reference the two KB files (voice-agent-knowledge-base.txt and any second file)
3. #TOOLS section — all 4 tools with when to call them, what mobile to extract, etc.
4. Guardrails — no gambling talk, no off-topic, no hallucination, stay in scope
5. Conversation flow — greeting, how to handle queries, escalation
6. Error handling

Wait — the user mentioned "two files in knowledge base". I only see one file referenced: voice-agent-knowledge-base.txt. The second one may be the FAQ or a separate file they've uploaded to ElevenLabs directly. I'll write the system prompt referencing "knowledge base documents" generally since ElevenLabs presents them to the agent as context.

The four tools are:
- lookup_ticket: requires mobile number
- get_match_info: no params needed
- get_pricing: optional mobile
- check_registration: requires mobile

Key details to include:
- Agent name: Drona
- Language: Hinglish (Hindi + English mix)
- Venue: Hotel Drona Palace, Kashipur
- Contact: +91 72170 16170, dronapalace@gmail.com
- Mobile normalization: ask user to say "digits only" or clarify if garbled
- Pricing: ₹999 new, ₹949 returning
- Payment methods: Razorpay, UPI QR, Pay at Hotel
- Always call tools for live data (bookings, match info) — never guess
- Knowledge base for static FAQ (event info, game rules, policies, food, etc.)

This is NOT a code change, it's a content response. I should present the full system prompt in clean markdown code blocks directly in chat — no presentation-plan needed since this is not an implementation task.

Actually wait — the instructions say "Present plans for implementation tasks (add feature, refactor). Skip for research ('how does X work?')." This is a content generation task (write a system prompt), not a codebase implementation task. So I should respond directly without a plan.

But I'm in Plan mode (READ-ONLY). I can still provide text responses — I just can't make code changes. So I'll write the full system prompt as a response.

Let me write the system prompt now:
