# Tutor Mint

A tutor that won't give you the answer.

Point your camera at a problem, type it out, or just talk. You get the question
that gets you moving — not the worked solution. Built for the moment you're
stuck and staring at the page.

## What's in it

**Scan** — camera or photo upload. Reads the problem off the page, then starts
asking.

**Chat** — same thing, typed.

**Voice** — hands-free back-and-forth. It listens, answers out loud, and keeps
listening. Replies stay short so it sounds like a person, not a textbook.

With `ELEVENLABS_API_KEY` set it speaks in a real neural voice; without it the
device's own voice is used, ranked to avoid the robotic ones. The orb is driven
by the actual audio — its amplitude is read through a Web Audio analyser, so it
moves with the syllables rather than on a timer.

**Guide vs Explain** — Guide asks the questions. Explain teaches the idea (and
still won't do your homework). Both are one tap apart everywhere.

**Short videos** — YouTube explainers picked for a short attention span: under
12 minutes, visual, to the point in the first 30 seconds.

**Study**
- *To-do* — tasks with due dates, on a month calendar
- *Cards* — paste notes, get flashcards
- *Quiz* — multiple choice with explanations, scored
- *Class* — record a lesson live, get a recap, terms, and homework pulled
  straight onto your to-do list
- *Calc* — scientific calculator and a function grapher

**You** — Google or email sign-in, profile picture, and your stats.

Sprig, the mint leaf, turns up on the screens that would otherwise be blank —
before your first photo, on sign-in, on an empty to-do list — and reacts to
your quiz score. He stays out of the way once there's something on screen.

## The one rule

The prompts in `lib/prompts.ts` are the product. Tutor Mint never states a final
answer, a solved equation, or a filled-in blank — not even when pushed. It will
confirm or correct a step *you* took. When you're stuck twice on the same thing
it drops to an easier parallel example and walks you back.

One question at a time, 2–4 short sentences before it, plain words, no emoji, no
cheerleading.

## Running it

```bash
npm install
cp .env.example .env.local   # add OPENROUTER_API_KEY
npm run dev
```

### Environment

| Variable | Needed | What it does |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | The tutor brain. Server-side only. |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Accounts and sync. Ships with a working default. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Same. Public by design; RLS protects the data. |
| `NEXT_PUBLIC_SITE_URL` | no | OAuth redirects and OpenRouter attribution. |
| `OPENROUTER_TEXT_MODELS` | no | Override the text fallback chain. |
| `OPENROUTER_VISION_MODELS` | no | Override the vision fallback chain. |
| `ELEVENLABS_API_KEY` | no | Natural voice. Without it, the browser's own voice is used. |
| `ELEVENLABS_VOICE_ID` | no | Which ElevenLabs voice. Defaults to a warm, unhurried one. |
| `YOUTUBE_API_KEY` | no | Real video results with thumbnails instead of search links. |

**Only `OPENROUTER_API_KEY` has to be set.** It is the one real secret, so it
lives server-side and is never bundled. The Supabase values ship as committed
defaults in `lib/config.ts` — they are `NEXT_PUBLIC_`, so they are compiled into
the browser bundle and served to every visitor regardless of where they are
configured, and the anon key grants nothing on its own. Row-level security is
the boundary: every table is scoped to `auth.uid()`, and an anonymous reader
sees zero rows.

If Supabase is ever unreachable the app still works — everything saves to the
device, and signing in later pushes it up once.

## Deploying to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import
   `stacysolovyev-prog/mintai`. `claude/modest-babbage-7jk5sw` is the repo's
   default branch, so it is selected for you.
2. Add the environment variables from `.env.example`. At minimum
   `OPENROUTER_API_KEY`.
3. Deploy. Then set `NEXT_PUBLIC_SITE_URL` to the URL Vercel gives you and
   redeploy so OAuth redirects land in the right place.

Nothing else to configure — Next.js is detected automatically.

### Turning on Google sign-in

Email and password work the moment Supabase is configured. Google needs one
extra step, because it requires credentials only you can create:

1. In Google Cloud Console, make an OAuth client and add
   `https://fhitmtbhaqqqjfdjennl.supabase.co/auth/v1/callback` as an authorised
   redirect URI.
2. Paste the client ID and secret into Supabase → Authentication → Providers →
   Google.
3. Add your Vercel URL under Authentication → URL Configuration.

Until then the Google button explains itself rather than failing silently.

## Free models

Everything runs on OpenRouter's free tier. Those model IDs churn constantly, so
`lib/openrouter.ts` walks a fallback chain and takes the first model that
answers, led by `openrouter/free` — a meta-router that picks an available free
model itself.

Most free models now are *reasoning* models: they spend their budget thinking,
return it in `message.reasoning`, and leave `content` empty. The client asks for
low-effort reasoning, gives generous token headroom, and salvages the reasoning
text if that's all that comes back. If a chain ever goes stale you can replace
it with an env var instead of a code change.

## Layout

```
app/
  api/tutor/    photo → problem → Socratic reply
  api/study/    flashcards, quizzes, class recaps
  api/videos/   ADHD-friendly YouTube picks
lib/
  prompts.ts    the tutoring rules
  openrouter.ts fallback chain + reasoning-model handling
  math.ts       expression parser for the calculator and grapher
  store.ts      one data layer over Supabase or localStorage
components/     one file per screen
supabase/       schema
```

## Notes

- Camera and microphone need HTTPS. Vercel gives you that.
- Speech recognition works in Safari on iPhone and Chrome elsewhere. Firefox
  doesn't support it; the app says so instead of breaking.
- Free models are rate-limited. When one is busy the chain moves on, and if
  they're all busy your work stays on screen with a Retry button.

## Where it's deployed

**https://mintai-three.vercel.app**

Note the `-three`. The plain `mintai.vercel.app` belongs to someone else, so
Vercel appended a suffix when it created this project — visiting the bare name
shows an unrelated site, not this one.

A `404: NOT_FOUND` with a code like `iad1::...` means you reached Vercel but
asked for a hostname or path it does not serve — usually that bare hostname, or
a route the currently deployed commit predates.

## If the deployed site misbehaves

Open `/api/health` on your deployed URL. It reports what that deployment
actually has configured — no secret values, just what is present and what is
missing — and names the fix for anything that isn't set.
