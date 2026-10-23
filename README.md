# AZ-900 Study Planner (Unofficial)

> **Unofficial study tool. Not affiliated with or endorsed by Microsoft. All content is original. Always verify with [Microsoft Learn](https://learn.microsoft.com/).**

Built for the **Vibe Coding Hackathon: AZ-900 Exam Prep Edition** (#1MillionDevs).
Challenge: **Personal Study Planner**.

**Live prototype:** [link] | **Demo video:** [link] | **Pitch deck:** [link]

## The problem
When we studied for AZ-900, we kept mixing up Azure service names, and we never knew whether we were actually ready. Learners often know their exam date but not how to spread their study time or where to focus.

## What it does
- Creates a day-by-day study plan from your **exam date**, **hours per day**, and **confidence in each exam domain**
- Gives weaker domains more time and reserves the final days for revision
- Tracks progress overall and per domain, and tells you if you're on track
- **"Explain this simply"**: an AI explanation (under 120 words) using everyday African analogies, in English or Kiswahili
- **Offline fallback**: pre-written explanations if the AI is unavailable
- Links every topic to Microsoft Learn

## How it works
1. **Rule-based planner** (`planner.js`) schedules topics, so dates are deterministic and testable.
2. **AI is used only for explanations**, never for scheduling, to avoid date errors.
3. **Supabase** stores plans and progress. An **Edge Function** calls the LLM, so no API key is exposed in the browser.

## Tech stack
HTML, CSS, JavaScript | Supabase (Postgres + Edge Functions) | [LLM provider] | [Hosting provider] | GitHub | Claude (prompt engineering and coding help)

## Prompt engineering
Our AI tutor's system prompt and every iteration are logged in [`prompts.md`](prompts.md). Key design choices: strict word limit, fundamentals level only, "do not invent facts", say when unsure, African-life analogies, Kiswahili option, and a Microsoft Learn verification line.

## Run it yourself
1. Clone the repo.
2. Create a Supabase project and run `schema.sql`.
3. Add your Supabase URL and anon key in [file, as per your setup].
4. Deploy the edge function and set the secret `LLM_API_KEY` (never commit keys).
5. Open `index.html` or deploy to [hosting].

## Content and rules
- All explanations and questions are original and based on the public AZ-900 skills outline on Microsoft Learn.
- No real exam questions. No Microsoft logos.
- AI explanations can contain errors. Verify with Microsoft Learn.

## Scalability
A `certification` field and topic CSVs mean other exams (such as AZ-104 or AI-900) can be added by supplying a new topic list.

## Next steps
Readiness score from self-check questions, auto-reschedule for missed days, calendar export, more languages.

## Contributions
- [Name]: frontend and integration
- [Name]: planner logic and database
- [Name]: AI function and prompt engineering
- [Name]: content (topics, explanations, Learn links)
- [Name]: pitch, demo, README and testing
*(Edit so each line matches what that person actually did.)*
