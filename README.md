# EMAILSCH — Persistent Email Scheduler

A production-grade, persistent email scheduling and delivery system built with **Express.js**, **BullMQ**, **Redis**, **MySQL (Prisma)**, **Ethereal SMTP**, **Elasticsearch**, **Slack alerts**, and a **React + Tailwind CSS** inbox-style frontend.

---

## 1. Running the Backend (Express, Redis, DB, BullMQ worker)

### 1.1 Start the infrastructure (MySQL, Redis, Elasticsearch)

```bash
# from the project root
docker compose up -d
```

This starts:

| Service         | Container                  | Host port |
| :-------------- | :------------------------- | :-------- |
| MySQL 8         | `reachinbox_mysql`         | `3336`    |
| Redis 7 (AOF)   | `reachinbox_redis`         | `6379`    |
| Elasticsearch 8 | `reachinbox_elasticsearch` | `9200`    |

### 1.2 Install, migrate, and start the API + worker

```bash
cd backend
npm install

# Generate the Prisma client and sync the MySQL schema
npx prisma generate
npx prisma db push

# Start Express API + BullMQ worker + Bull-Board dashboard
npm run dev
```

The single `npm run dev` process boots everything on the backend side:

- **REST API** — `http://localhost:5000/api`
- **BullMQ worker** — consumes the `email-queue` with configurable concurrency
- **Restart sync routine** — re-enqueues pending jobs on boot (see §4.2)
- **Bull-Board queue dashboard** — `http://localhost:5000/admin/queues`

Production-style run: `npm run build` then `npm start` (serves `dist/index.js`).

---

## 2. Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

- **UI** — `http://localhost:3000`
- Vite proxies `/api` and `/admin` to `http://localhost:5000`, so the backend must be running for live data.
- If the backend is unreachable, login falls back to a local browser session so the UI remains usable.

Production build: `npm run build` (outputs `dist/`, type-checked with `tsc`).

---

## 3. Ethereal Email Setup & Environment Variables

### 3.1 Ethereal Email (fake SMTP)

No manual registration or SMTP credentials are required:

1. On the first send, `etherealService.ts` calls `nodemailer.createTestAccount()` to create a dynamic Ethereal test account.
2. A transporter is created against `smtp.ethereal.email:587` and reused for all sends.
3. After each send, `nodemailer.getTestMessageUrl(info)` produces a web preview link, which is stored on the email job (`etherealPreviewUrl`) and shown in the frontend as **"Preview on Ethereal"**.

Ethereal *captures* messages instead of delivering them — nothing reaches real inboxes, which makes it safe for demos and tests.

### 3.2 Environment variables (`backend/.env`)

```env
PORT=5000
DATABASE_URL="mysql://reachinbox_user:reachinbox_pass@localhost:3336/reachinbox_email_db"
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
ELASTICSEARCH_NODE=http://localhost:9200
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_SECONDS=2
DEFAULT_MAX_EMAILS_PER_HOUR=50
JWT_SECRET=reachinbox_super_secret_jwt_key_2026
```

| Variable                     | Purpose                                                              | Default |
| :--------------------------- | :------------------------------------------------------------------- | :------ |
| `PORT`                       | Express API port                                                     | `5000`  |
| `DATABASE_URL`               | MySQL connection string used by Prisma                               | root@`3306` |
| `REDIS_HOST` / `REDIS_PORT`  | Redis used by BullMQ, the worker, and the rate limiter               | `127.0.0.1:6379` |
| `ELASTICSEARCH_NODE`         | Elasticsearch node for full-text email search                        | `http://localhost:9200` |
| `WORKER_CONCURRENCY`         | Parallel jobs the BullMQ worker processes                            | `5`     |
| `MIN_EMAIL_DELAY_SECONDS`    | Minimum pause between two sends (throttling)                         | `2`     |
| `DEFAULT_MAX_EMAILS_PER_HOUR`| Hourly send cap per sender when a batch does not override it         | `50`    |
| `JWT_SECRET`                 | Signs session tokens issued by `/api/auth/google`                    | dev key |

> The bundled `.env` targets the Docker Compose MySQL on port **3336**. If you run MySQL natively on `3306`, adjust `DATABASE_URL` accordingly.

---

## 4. Architecture Overview

```mermaid
graph TD
    Client[React + Tailwind Inbox UI] -->|REST + JWT| Express[Express.js API]
    Express -->|ScheduleBatch + EmailJob rows| MySQL[(MySQL / Prisma)]
    Express -->|Delayed jobs| Redis[(Redis + BullMQ)]
    Redis -->|Consumes jobs| Worker[BullMQ Worker]
    Worker -->|Atomic INCR hour counter| RateLimit[Redis Rate Limiter]
    Worker -->|Fake SMTP send| Ethereal[Ethereal SMTP]
    Worker -->|Index documents| ES[(Elasticsearch)]
    Worker -->|Limit-hit alert| Slack[Slack Webhook]
```

### 4.1 How scheduling works (no cron jobs)

1. `POST /api/emails/schedule` validates the payload and extracts recipient addresses (array, free text, or uploaded lead file).
2. A `ScheduleBatch` row plus one `EmailJob` row per recipient are written to MySQL with status `SCHEDULED`.
3. Each recipient gets a staggered send time: `startTime + index * delayBetweenEmailsSeconds`.
4. Each job is added to BullMQ as a **delayed job** with a deterministic id (`scheduled_<emailJobId>`); Redis timers release the job to the worker when the delay expires. No OS/Node cron is involved.
5. The worker flips the row to `SENDING`, sends via Ethereal, then stores `SENT` + `sentAt` + preview URL, and indexes the document in Elasticsearch.

### 4.2 How persistence on restart is handled

- **Redis side**: Redis runs with `appendonly yes`, so BullMQ delayed jobs survive a Redis or host restart.
- **MySQL side (source of truth)**: on boot, `syncPendingJobsOnRestart()` loads every `SCHEDULED` / `RESCHEDULED` job and checks whether its `bullJobId` still exists in BullMQ. Missing jobs are re-enqueued with the *remaining* delay (`scheduledFor - now`) and a fresh job id.
- **Idempotency**: deterministic BullMQ job ids prevent double-enqueueing, and the worker re-reads the MySQL row before sending — jobs already `SENT` are skipped, so a restart can never duplicate a delivery.

### 4.3 How rate limiting & concurrency are implemented

- **Concurrency**: the BullMQ worker runs with `concurrency: WORKER_CONCURRENCY` (default 5), processing independent jobs in parallel.
- **Send throttling**: after each successful send the worker sleeps `delaySeconds` (batch-level, falling back to `MIN_EMAIL_DELAY_SECONDS`) to enforce a minimum gap between sends.
- **Hourly rate limit**: `checkAndIncrementRateLimit()` atomically `INCR`s the Redis key `ratelimit:{sender}:{YYYY-MM-DD-HH}` (UTC hour window, 3660 s TTL). Because `INCR` is atomic, the counter is safe across concurrent workers.
- **When the cap is hit** the job is *not* failed or dropped: the row becomes `RESCHEDULED` (with `rescheduleCount` incremented), a Slack alert fires if the user connected a webhook, and the job is re-queued with `delay = msUntilNextHour` so it lands in the next hour window.
- **Failures**: SMTP errors mark the row `FAILED` with `errorMessage` and rethrow so BullMQ records the failed job.

---

## 5. Features Implemented

### 5.1 Backend

| Area | Feature |
| :--- | :------ |
| **Scheduler** | BullMQ delayed-job scheduling with per-recipient stagger; no cron jobs; Bull-Board live queue dashboard at `/admin/queues`. |
| **Persistence** | MySQL (`ScheduleBatch`, `EmailJob`) as source of truth; Redis AOF for queue durability; `syncPendingJobsOnRestart()` re-enqueues orphaned jobs on boot; idempotent worker (skips already-`SENT` jobs). |
| **Rate limiting** | Atomic Redis hourly counters per sender (`ratelimit:{sender}:{hour}`); over-cap jobs are rescheduled to the next hour window instead of failing; Slack webhook alert on limit hit. |
| **Concurrency** | Configurable worker concurrency (`WORKER_CONCURRENCY`) plus minimum inter-send delay (`MIN_EMAIL_DELAY_SECONDS` / batch `delaySeconds`). |
| **Delivery** | Ethereal fake SMTP with auto-created test account and stored preview URLs. |
| **Search** | Elasticsearch indexing on schedule/send; multi-field search endpoint with MySQL `LIKE` fallback when ES is unavailable. |
| **Auth** | Google login endpoint issuing JWTs (`/api/auth/google`, `/api/auth/me`); bearer-token middleware on email routes. |
| **Alerting** | Slack rate-limit notifications via connected webhook per user. |

### 5.2 Frontend

| Area | Feature |
| :--- | :------ |
| **Login** | Light-themed login card: Google OAuth (`@react-oauth/google`) plus email/password entry with client-session fallback when the backend is offline. |
| **Dashboard** | Inbox-style dashboard with sidebar (user card + logout, Compose action, Scheduled/Sent navigation with live counts) and 5-second polling refresh. |
| **Email list** | Row list per tab showing recipient, scheduled/sent time badge, subject + body preview, and star toggle; empty and loading states. |
| **Search & filter** | Debounced Elasticsearch search box plus status filter dropdown (Scheduled / Sent / Rate limited / Failed) and manual refresh. |
| **Email detail** | Full email view: sender block, timestamp, body paragraphs, and "Preview on Ethereal" link for sent mail. |
| **Compose** | Full-page composer: sender select, recipients (with lead-file attach), subject, delay-between-emails and hourly-limit inputs, reply body with formatting toolbar, and a **Send Later** popover (custom date-time picker + tomorrow presets) that schedules through `POST /api/emails/schedule`. |

