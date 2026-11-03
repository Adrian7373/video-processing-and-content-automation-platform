# AGENTS.md — Scroll Maestro (`video-repurposer`)

This npm-workspaces monorepo turns long videos into short clips and schedules them to TikTok (Content Posting API: Direct Post and Drafts) and YouTube Shorts.

Pipeline: a browser upload goes to S3 through a presigned URL. Next.js then enqueues a BullMQ job, and the worker extracts audio with FFmpeg and sends it to Groq Whisper for transcription. Gemini picks the highlights, FFmpeg renders the clips with burned-in captions, and the clips go back to S3. The user schedules posts, and the `social-publishing` queue posts them to the platforms.

## 1. Repository map

| Path | What it is | Deployed to |
|---|---|---|
| `apps/web` | Next.js **16** (App Router), React 19, Tailwind v4, NextAuth v5 beta, Zod v4 | Vercel |
| `apps/worker` | Node ESM + TypeScript BullMQ worker (`ioredis`, FFmpeg via `execFile`, `axios`, `ai` + `@ai-sdk/google`) | Render free web service (Docker, `Dockerfile.worker`) |
| `packages/database` | Prisma 7 schema/client (`@prisma/adapter-pg`), `videoLifecycle.ts`, `uploadLimits.ts` | — (imported by both apps) |
| `apps/transcriber` | **Deprecated** Flask transcription service. Do not edit, run, or call it. | — |

- Next.js 16 has breaking changes compared with older versions. Read `apps/web/AGENTS.md` and the docs in `node_modules/next/dist/docs/` before you write web code.
- Queue and job names are defined in two places: `apps/worker/src/constants/queues.ts` and `apps/web/src/lib/queues.ts`. They must stay identical. Queues: `media-processing`, `video-processing` (legacy), `social-publishing`. Jobs: `process-video`, `create-caption`, `create-thumbnail`, `publish-social-post`.
- The job payload types in `apps/web/src/lib/queues.ts` and the worker's processor Zod schemas must also stay in sync.

## 2. Commands

- **Install: only from the repo root.** Run `npm install`. Never run `npm install` inside a sub-package, because it breaks the workspace `.bin/next` links. `packages/database` runs `prisma generate` on postinstall.
- **Local infrastructure:** `docker compose up -d` starts Postgres 16 on 5432 and Redis 7 on 6379.
- **Web:** `npm run dev:web` from the root, or `npm run dev` in `apps/web`.
- **Worker:** `npm run dev:worker` from the root (`tsx watch`), or `npx tsx src/index.ts` in `apps/worker`.
- **Database (in `packages/database`):** `npx prisma db push`, then `npx prisma generate`. A `prisma/migrations/` folder exists. If you change the schema in a way that needs a data migration, say so to the user instead of only pushing.

## 3. Verification (no test suite exists)

Before you call a change done, run the checks that apply to it:

- Web: `npx tsc --noEmit` and `npm run lint` in `apps/web`.
- Worker: `npx tsc --noEmit -p apps/worker`.
- After schema changes: `npx prisma generate` in `packages/database`, then typecheck both apps.
- Tell the user which checks you ran and which you could not run, for example a flow that needs real S3, Groq, or OAuth credentials. Never claim an end-to-end flow works if you did not run it.

## 4. Code conventions

- **Zod everywhere:** validate request bodies, query params, job payloads, and third-party API responses with `safeParse`/`parse`. Never trust a client-supplied `userId`, credit amount, or status field.
- **Database imports use relative paths only.** Import `prisma`, the enums (`AspectRatio`, `CaptionStyle`, `CreditReason`, `PublishStatus`, `SocialPlatform`, `VideoStatus`), and the helpers from `packages/database/index`. In the worker (ESM), add `.js`, e.g. `../../../packages/database/index.js`. Do not invent a `@repo/database` alias. If you need another enum, export it from `packages/database/index.ts` first.
- **Route Handlers, not Server Actions:** write APIs as `src/app/api/.../route.ts` with `export const dynamic = "force-dynamic"`. Do not add new Server Actions. `apps/web/actions/upload.ts` (`getPresignedUploadUrl`, used by `VideoUploader.tsx`) is a known legacy exception. Moving it to a Route Handler is welcome, but only as a deliberate change of its own.
- **Auth and credits:** resolve the caller with `getOrCreateActor()` from `@/lib/auth`. It handles guests through the `vr_guest_user_id` cookie as well as signed-in users. Scope every query to the actor's user ID. Deduct and refund credits atomically inside `prisma.$transaction(...)`, and write a `CreditTransaction` row.
- **Video status:** move a video between statuses only through the helpers in `packages/database/videoLifecycle.ts` (`markVideoQueued`, `markVideoProcessing`, `heartbeatVideo`, `markVideoCompleted`, `markVideoFailed`). Do not write `status` directly. Long FFmpeg steps must call `heartbeatVideo`, or `reconcileStaleVideos` marks the job as failed. The timeouts are 45 minutes for processing and 15 minutes for the queue.
- **UI:** use a dark theme only (`#0A0D14` / `slate-950` backgrounds, subtle slate borders, dark surfaces) on every page, modal, and input. Never add unstyled light-mode controls. Icons come from `lucide-react`.

## 5. Invariants: do not regress

### A. Uploads and transcription
- The upload limits live in **`packages/database/uploadLimits.ts`**: **300 MB** and **45 minutes**. That file is the only source of truth. Import the constants and never hard-code the numbers. The web app enforces both limits before the S3 upload, reading duration from HTML5 video metadata.
- **Transcription goes only to Groq Whisper:** `POST https://api.groq.com/openai/v1/audio/transcriptions` with `Authorization: Bearer ${GROQ_API_KEY}`, `model: "whisper-large-v3-turbo"`, and `response_format: "verbose_json"`. Never call `127.0.0.1:5001` or any Flask `/transcribe` service.
- **Audio extraction (`extractAudio`)** always uses `-map 0:a:0 -vn -c:a libmp3lame -b:a 64k -f mp3`, which is about 0.48 MB per minute. That keeps a 45-minute video under Groq's 25 MB limit. Do not raise the bitrate.
- Highlight extraction uses Gemini (`gemini-3.5-flash-lite` via `@ai-sdk/google`) in `CLIP` mode. `CAPTION_ONLY` mode skips Gemini.

### B. Redis and the Upstash command quota (critical)
Upstash's free tier allows 500k commands a month, and this project has used up that whole quota in under 8 hours before. Every Redis round-trip counts.
- All three BullMQ workers (`media-processing`, `video-processing`, `social-publishing`) must use the shared `lowPollingWorkerOptions` from `apps/worker/src/config/workerOptions.ts`. Never pass inline options. The shared values are:
  ```ts
  {
    connection: redis,
    concurrency: 1,
    drainDelay: 60,            // seconds a blocked worker waits on an empty queue
    stalledInterval: 300000,   // 5 min stalled-job check
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 20 },
  }
  ```
  Never lower these numbers. Any new worker must spread or reuse `lowPollingWorkerOptions`.
- Do not add `QueueEvents`, `job.waitUntilFinished()`, `setInterval` Redis polling, or per-request `new Queue(...)` and `new Redis(...)` calls in the web app. Reuse the cached singletons in `apps/web/src/lib/queues.ts`. Job progress reaches the UI through **Postgres**, not Redis.
- Keep any periodic Redis call in the worker at 4 minutes or more (see `reconcileInterval` in `apps/worker/src/index.ts`). Add no new periodic Redis calls without asking.
- Keep `maxRetriesPerRequest: null` on the worker's ioredis client. Do not add tight reconnect or retry loops.

### C. Worker on Render's free tier
- The worker starts with `node --expose-gc --max-old-space-size=220 --import tsx`, which gives about 220 MB of heap. Stream files to and from disk and S3, and never buffer whole videos in memory. Pass FFmpeg temp-file paths, not Buffers. Delete temp files in `finally`.
- Media jobs run one at a time on purpose (`concurrency: 1` plus the in-process `mediaJobLock` in `mediaWorker.ts`). Do not parallelize FFmpeg renders.
- Render needs the HTTP server in `src/index.ts`: it binds `PORT` (default 8080) and answers `/` and `/health`. Workers start only after the server is listening.
- Keep-alive: the web app pings `${WORKER_PUBLIC_URL}/health` when it enqueues work. The worker pings itself every 4 minutes, but only while jobs are active, waiting, or delayed. Do not add pings while the queues are idle.
- `Dockerfile.worker` installs FFmpeg and the subtitle fonts (`fonts-liberation`, `fonts-dejavu-core`). If you add a caption font, add its package there.

### D. Social publishing
- TikTok supports `DIRECT` and `DRAFT` publish types (`tiktokPublishType`). YouTube Shorts uploads through the Data API v3 resumable upload. Both refresh OAuth tokens automatically, and YouTube retries once after a 401.
- Do not reintroduce demo or mock social accounts in the web app. For local testing, use `SOCIAL_PUBLISH_DRY_RUN=true` on the worker. Tokens prefixed `mock_token_` / `demo_` are also dry runs.

## 6. Environment variables

Never commit `.env*` files; `.gitignore` excludes them.

| Variable | web | worker | Notes |
|---|:-:|:-:|---|
| `DATABASE_URL` | ✓ | ✓ | Required. Prisma throws at import time without it. |
| `REDIS_URL` | ✓ | ✓ | Upstash `rediss://` URL in production. |
| `AWS_REGION`, `S3_BUCKET_NAME` (+ standard AWS credentials) | ✓ | ✓ | Video, clip, and thumbnail storage. |
| `GROQ_API_KEY` | | ✓ | Required. Validated in `apps/worker/src/config/env.ts`. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | | ✓ | Gemini, through the default `@ai-sdk/google` provider. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✓ | ✓ | YouTube OAuth. The worker also accepts `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`. |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | ✓ | ✓ | TikTok OAuth and token refresh. |
| `NEXT_PUBLIC_APP_URL` | ✓ | | Base URL for OAuth redirect URIs. |
| `AUTH_SECRET` | ✓ | | NextAuth v5. |
| `WORKER_PUBLIC_URL` | ✓ | ✓ | Defaults to `https://scroll-maestro-worker.onrender.com`. Used for wake and keep-alive pings. |
| `PORT` | | ✓ | Set by Render; defaults to 8080. |
| `FFMPEG_PATH` | | ✓ | Optional override of the FFmpeg binary. |
| `SOCIAL_PUBLISH_DRY_RUN` | | ✓ | `true` simulates publishing. |

When you add a worker env var, add it to the Zod schema in `apps/worker/src/config/env.ts`.
