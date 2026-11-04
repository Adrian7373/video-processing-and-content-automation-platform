# AGENTS.md — Scroll Maestro (`video-repurposer`)

Automated short-form video repurposing and social scheduling monorepo (npm workspaces) built for TikTok Content Posting API (Direct Post & Drafts) and YouTube Shorts.

## 1. Repository Map & Boundaries
- `apps/web`: Next.js (App Router), React, TypeScript, Tailwind CSS. Deployed on Vercel.
- `apps/worker`: Node.js/TypeScript BullMQ background processor (`ioredis`, `ffmpeg`, `axios`). Deployed on Render (Free Web Service tier via dummy HTTP server).
- `packages/database`: Prisma ORM + PostgreSQL schema, client, and `videoLifecycle.ts` helpers.

## 2. Exact Commands (Run by Directory)
- **Install dependencies (ALWAYS from monorepo root `video-repurposer/`):**
  `npm install`
  *(Never run `npm install` inside sub-packages; it breaks workspace `.bin/next` links).*
- **Frontend (`cd apps/web`):**
  `npm run dev`
- **Background Worker (`cd apps/worker`):**
  `npx tsx src/index.ts`
- **Database Schema Updates (`cd packages/database`):**
  `npx prisma db push`
  `npx prisma generate`

## 3. Code & Type-Safety Conventions
- **Strict Zod Validation:** Validate all external inputs, API request bodies, and third-party API responses (`safeParse` / `parse`) using `zod`. Never trust client-supplied `userId`, credits, or status fields.
- **Database Imports (Relative Paths Only):** Import `prisma`, enums (`AspectRatio`, `CaptionStyle`, `CreditReason`, `TikTokPublishType`), and helpers strictly via relative paths to `packages/database/index` (or `.js` in `apps/worker` ESM imports, e.g., `../../../packages/database/index.js`). Do not invent `@repo/database` aliases.
- **Next.js App Router Only:** Use Route Handlers (`app/api/.../route.ts` with `export const dynamic = "force-dynamic"`). Do **not** introduce Next.js Server Actions.
- **Auth & Credits:** Resolve actors in API routes via `getOrCreateActor()` from `@/lib/auth`. Deduct and refund credits atomically inside `prisma.$transaction(...)`.
- **UI & Styling (`apps/web`):** Enforce a strict, high-contrast dark theme (`#0A0D14` / `slate-950` backgrounds, subtle slate borders, consistent dark surfaces) across all pages, modals, and components. Never add unstyled light-mode inputs or cards.

## 4. Infrastructure & Domain Invariants (DO NOT REGRESS)

### A. Audio Extraction & Transcription (`apps/worker`)
- **Deprecated Flask Service:** Never call `127.0.0.1:5001` or any Render Flask `/transcribe` microservice.
- **Groq Whisper API Only:** Send extracted audio directly to `https://api.groq.com/openai/v1/audio/transcriptions` using `Authorization: Bearer ${process.env.GROQ_API_KEY}`, `model: "whisper-large-v3-turbo"`, and `response_format: "verbose_json"`.
- **FFmpeg Audio Compression (`extractAudio`):** Always extract audio using `-c:a libmp3lame -b:a 64k -f mp3` (~0.48 MB/min) so videos up to 45 minutes stay strictly under Groq's 25 MB file size limit.
- **Frontend Upload Guard (`apps/web`):** Enforce max file size (250 MB) and max video duration (45 minutes via HTML5 video metadata preload) before S3 upload.

### B. BullMQ & Upstash Redis Quota Protection
- **Worker Options:** All 3 BullMQ workers (`media-processing`, `video-processing`, `social-publishing`) MUST keep low-polling settings to avoid exhausting Upstash's 500k monthly command cap:
  ```ts
  const workerOptions = {
    connection: redisConnection,
    drainDelay: 60,
    stalledInterval: 300000,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 20 },
  };