# DentalScan AI — Full-Stack Engineering Challenge

> A patient-facing dental imaging web application built with **Next.js 14**, **TypeScript**, **Prisma ORM**, and **SQLite**. Patients complete a guided multi-angle tooth scan, clinics are notified instantly, and both parties can communicate through a real-time messaging sidebar — no extra apps required.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Features](#features)
  - [Guided Dental Scan Flow](#1-guided-dental-scan-flow)
  - [Scan Completion Notification System](#2-scan-completion-notification-system)
  - [Patient-Dentist Messaging Sidebar](#3-patient-dentist-messaging-sidebar)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Architecture Decisions](#architecture-decisions)
- [Error Handling](#error-handling)
- [Code Quality](#code-quality)
- [If I Had More Time](#if-i-had-more-time)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Database ORM | Prisma 5 |
| Database | SQLite (dev) |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Font | Inter (Google Fonts via `next/font`) |

---

## Project Structure

```
starter-kit/
├── prisma/
│   ├── schema.prisma         # Data models: Scan, Notification, Thread, Message
│   └── dev.db                # SQLite database (local dev, git-ignored in production)
│
├── src/
│   ├── constants/
│   │   ├── scanning.ts       # StabilityLevel enum, STABILITY_CONFIG, VIEWS, motion thresholds
│   │   └── messaging.ts      # Sender enum, Message type, MessageSidebarProps type
│   │
│   ├── lib/
│   │   └── prisma.ts         # Shared PrismaClient singleton — prevents hot-reload connection leaks
│   │
│   ├── app/
│   │   ├── layout.tsx        # Root layout — Inter font, global metadata
│   │   ├── globals.css       # Tailwind base + CSS custom properties
│   │   ├── page.tsx          # / — Renders <ScanningFlow />
│   │   ├── results/
│   │   │   └── page.tsx      # /results — Renders <MessageSidebar />
│   │   └── api/
│   │       ├── notify/
│   │       │   └── route.ts  # POST /api/notify · GET /api/notify
│   │       └── messaging/
│   │           └── route.ts  # GET /api/messaging · POST /api/messaging
│   │
│   └── components/
│       ├── ScanningFlow.tsx  # Multi-step guided camera capture UI
│       └── MessageSidebar.tsx# Floating patient-to-clinic chat sidebar
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client types from schema
npx prisma generate

# 3. Push schema to SQLite (creates dev.db if it doesn't exist)
npx prisma db push

# 4. Start the development server
npm run dev
```

App is available at **http://localhost:3000**

### Useful Commands

```bash
# View and edit database records in a browser UI
npx prisma studio

# Apply schema changes after editing prisma/schema.prisma
npx prisma db push

# Build for production
npm run build
```

### Routes

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Guided scan flow |
| `http://localhost:3000/results` | Results page with messaging sidebar |
| `GET /api/notify` | Fetch all unread clinic notifications |
| `POST /api/notify` | Trigger a scan completion notification |
| `GET /api/messaging?threadId=<id>` | Fetch all messages in a thread |
| `POST /api/messaging` | Send a message (auto-creates thread if needed) |

---

## Features

### 1. Guided Dental Scan Flow

**Component:** `src/components/ScanningFlow.tsx`  
**Route:** `/`

Guides the patient through **5 sequential dental photo captures** using their device camera. A circular overlay helps them position their mouth. A motion stability detector prevents blurry captures by signalling when the device is steady enough.

#### Scan Steps

| Step | View | Instruction |
|------|------|-------------|
| 1 | Front View | Smile and look straight at the camera |
| 2 | Left View | Turn your head to the left |
| 3 | Right View | Turn your head to the right |
| 4 | Upper Teeth | Tilt your head back and open wide |
| 5 | Lower Teeth | Tilt your head down and open wide |

#### Stability Indicator

The guide circle changes colour based on motion sensor data:

| Colour | Level | Meaning |
|--------|-------|---------|
| 🔴 Red | Unstable | Device moving — hold still |
| 🟡 Amber | Okay | Almost steady |
| 🟢 Green | Stable | Ready to capture |

#### Performance Design

Raw `devicemotion` events fire at ~60 Hz. Magnitude is written to a **ref** (zero re-renders). A `setInterval` polls at **200ms** and only calls `setStability()` when the category changes — capping re-renders at 5/sec instead of 60/sec.

#### On Completion

When all 5 images are captured, a `POST /api/notify` request fires automatically to alert the clinic.

---

### 2. Scan Completion Notification System

**Route:** `POST /api/notify` · `GET /api/notify`  
**File:** `src/app/api/notify/route.ts`

Fires a clinic notification the moment the scan is complete. The notification is persisted to the database with `read: false` so it can be consumed by a clinic dashboard.

#### How It Works

```
ScanningFlow (step 5 complete)
  → POST /api/notify { scanId, status: "completed" }
    → Response returned immediately (non-blocking)
    → createNotification() runs in background:
        → prisma.notification.create(...)
        → console.log("[Twilio STUB] SMS sent...")
```

The `createNotification` function is called **without `await`**. The HTTP response reaches the client in milliseconds — the DB write happens asynchronously after. Any failure inside is caught and logged without affecting the user.

#### Endpoints

**`POST /api/notify`**

```json
// Request
{ "scanId": "scan_1713728400000", "status": "completed" }

// Response 200
{ "ok": true, "message": "Scan received. Clinic notification dispatched." }
```

**`GET /api/notify`**

Returns all unread notifications ordered newest-first — designed as the backing endpoint for a clinic dashboard.

```json
{ "notifications": [{ "id": "...", "title": "New Scan Ready for Review", "read": false }] }
```

---

### 3. Patient-Dentist Messaging Sidebar

**Component:** `src/components/MessageSidebar.tsx`  
**Routes:** `GET /api/messaging` · `POST /api/messaging`  
**Mounted on:** `/results`

A slide-in sidebar lets patients send messages to their clinic directly from the results page. Messages are threaded, persisted in the database, and the UI updates immediately with **optimistic rendering** — rolling back gracefully if the request fails.

#### Open / Close Behaviour

| Action | Result |
|--------|--------|
| Click message icon | Opens sidebar, icon hides |
| Click outside sidebar | Closes sidebar |
| Click X in header | Closes sidebar |

#### Thread Lifecycle

The first message from a patient automatically creates a `Thread` record. Subsequent messages attach to the same thread. The patient never sees this — it's transparent.

#### Optimistic UI

1. Message appended immediately to the list (50% opacity while pending)
2. Input cleared so the patient can type next message
3. **Success:** temp placeholder replaced with the real DB record
4. **Failure:** temp message removed, input text restored, inline error shown

#### Endpoints

**`GET /api/messaging?threadId=<id>`**

```json
{ "messages": [{ "id": "...", "content": "...", "sender": "patient", "createdAt": "..." }] }
```

**`POST /api/messaging`**

```json
// Request (first message — no threadId)
{ "patientId": "patient_001", "content": "When will results be ready?", "sender": "patient", "threadId": "" }

// Response 201
{ "ok": true, "message": { ... }, "threadId": "clx9abc..." }
```

---

## Database Schema

Managed via **Prisma** with SQLite in development. Schema at `prisma/schema.prisma`.

```prisma
model Scan {
  id        String   @id @default(cuid())
  status    String   @default("pending") // pending | completed | failed
  images    String   @default("")        // CSV of URLs (SQLite has no array type)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  title     String
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Thread {
  id        String    @id @default(cuid())
  patientId String
  messages  Message[]
  updatedAt DateTime  @updatedAt
}

model Message {
  id        String   @id @default(cuid())
  threadId  String
  content   String
  sender    String   // "patient" | "dentist"
  createdAt DateTime @default(now())
  thread    Thread   @relation(fields: [threadId], references: [id])
}
```

> **Note:** SQLite does not support scalar array columns. In a production PostgreSQL environment, `images` would be a `String[]` or a separate `ScanImage` relation table.

---

## API Reference

### `POST /api/notify`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scanId` | `string` | ✅ | Unique scan identifier |
| `status` | `string` | ✅ | Must be `"completed"` to trigger notification |

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "scanId is required" }` | Missing scanId |
| 500 | `{ "error": "Internal Server Error" }` | Unexpected failure |

---

### `POST /api/messaging`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | `string` | ✅ | Message text |
| `sender` | `"patient" \| "dentist"` | ✅ | Message author |
| `threadId` | `string` | ❌ | Omit or pass `""` to create a new thread |
| `patientId` | `string` | ✅ (if no threadId) | Required to create a new thread |

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "content and sender are required" }` | Missing required fields |
| 400 | `{ "error": "patientId required to create a new thread" }` | No threadId and no patientId |
| 500 | `{ "error": "Internal Server Error" }` | Unexpected failure |

---

### `GET /api/messaging?threadId=<id>`

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "messages": [...] }` | Success |
| 400 | `{ "error": "Missing threadId" }` | No threadId provided |

---

## Architecture Decisions

### Prisma Singleton (`src/lib/prisma.ts`)

Next.js hot-reload in development destroys and recreates modules on every file save. Without a singleton, each reload leaks a new `PrismaClient` connection. The singleton attaches the instance to `globalThis` in dev — which survives hot-reload — while production serverless invocations always get a fresh process.

```ts
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Constants Extracted to `src/constants/`

All enums, config maps, and domain constants are isolated from component files:

- `src/constants/scanning.ts` — `StabilityLevel`, `STABILITY_CONFIG`, `VIEWS`, motion thresholds
- `src/constants/messaging.ts` — `Sender`, `Message`, `MessageSidebarProps`

This keeps components focused on rendering logic and makes constants independently testable and reusable.

### Non-blocking Notification Dispatch

The notify API responds immediately and fires the DB write after — the patient's scan completion screen is never delayed by a backend operation:

```ts
createNotification(scanId); // no await
return NextResponse.json({ ok: true }); // returns instantly
```

---

## Error Handling

| Surface | Strategy |
|---------|----------|
| Camera denied | `DOMException.name === "NotAllowedError"` caught; user-facing message shown in viewport |
| Camera hardware failure | Generic error message displayed; button stays disabled |
| Notification fire | `.catch()` on client fetch — failure is silent to user, scan completion still shows |
| Notification DB write | `try/catch` inside `createNotification`; logs error, never throws to caller |
| Message load (sidebar open) | `.catch()` with `console.error`; sidebar shows empty state gracefully |
| Message send failure | Full optimistic rollback — temp message removed, input restored, inline error shown (no `alert()`) |
| API routes | All `POST` handlers wrapped in `try/catch`; return structured `{ error }` JSON; never expose stack traces |

---

## Code Quality

### TypeScript

- `StabilityLevel` and `Sender` are **string enums** — exhaustive, no stringly-typed comparisons
- `StabilityConfig` and `ViewConfig` are explicitly typed — no implicit `any`
- `ReturnType<typeof setInterval>` used for the interval ref — cross-environment safe (Node returns `NodeJS.Timeout`, not `number`)
- Component props use named exported types (`MessageSidebarProps`) — not anonymous `Props` locals

### React

- Motion data written to a **ref**, not state — raw 60 Hz events cause zero re-renders
- `setInterval` polls at 200ms; `setStability()` called only when the category changes
- `useCallback` on `handleCapture` — stable reference across renders
- Camera stream captured in closure at effect setup time — avoids stale ref on unmount
- `key={v.label}` on thumbnail list — stable key prevents React from reusing the wrong DOM node

### Accessibility

- Message sidebar has `role="dialog"`, `aria-modal="true"`, `aria-label`
- All icon-only buttons have `aria-label`
- Input field labelled with `aria-label="Message input"`

---

## If I Had More Time

This section outlines the features, optimisations, and architectural improvements I would tackle given more time — roughly in priority order.

### 🔐 Authentication & Multi-Tenancy
- Integrate **NextAuth.js** (or Clerk) for proper patient and dentist authentication
- Replace the hardcoded `patientId: "patient_001"` and `userId: "clinic_default"` with real session-derived identities
- Scope all DB queries by authenticated user — patients only see their own threads; dentists only see threads for their clinic

### 📡 Real-Time Messaging
- Replace the current poll-on-open fetch with **WebSockets or Server-Sent Events** so new clinic replies appear in the sidebar without a refresh
- Likely implementation: Next.js Route Handlers with SSE, or a lightweight Pusher / Ably integration
- Add typing indicators and read receipts

### 📲 Real SMS Notifications
- Wire up the **Twilio** stub in `POST /api/notify` with actual credentials from environment variables
- Send an SMS to the clinic's phone number the moment a scan is uploaded
- Add a webhook handler for Twilio delivery status callbacks to track whether the SMS was delivered

### 🗄️ Production Database
- Migrate from SQLite to **PostgreSQL** (via Supabase, Neon, or PlanetScale)
- Update `schema.prisma` to use `provider = "postgresql"` and replace the CSV `images` field with a proper `String[]` array or a `ScanImage` relation table
- Add database connection pooling (PgBouncer or Prisma Accelerate) for serverless environments

### 📷 Actual Image Upload
- The captured canvas frames are currently held in component state as base64 data URLs — they are never persisted
- Add a `POST /api/upload` route that accepts the images, stores them in **AWS S3 / Cloudflare R2**, and writes the URLs back to the `Scan.images` column
- Show the uploaded image URLs on the results page rather than a static placeholder

### 🦷 AI Scan Analysis
- Integrate an image classification model (e.g. via **Replicate API** or a custom TensorFlow.js model) to analyse the uploaded dental images
- Display findings on the results page: cavity risk, plaque detection, alignment notes
- Stream results progressively so the patient sees feedback as each image is processed

### 🔔 Clinic Notification Dashboard
- Build a `/dashboard` page for dentists that consumes `GET /api/notify`
- Display unread notifications with scan ID, timestamp, and a "Mark as read" action that calls a `PATCH /api/notify/:id` endpoint
- Add a badge counter on the clinic-side nav showing unread count

### ⚡ Performance
- Add `React.memo` to the thumbnail strip items to prevent unnecessary re-renders during capture
- Lazy-load `MessageSidebar` with `next/dynamic` since it's not needed until the user interacts
- Implement image compression before upload (use `canvas.toDataURL("image/jpeg", 0.8)` quality parameter and resize to a max dimension)
- Add `loading="lazy"` to thumbnail `<img>` tags

### 🧪 Testing
- Unit tests for `STABILITY_CONFIG` threshold logic and the motion magnitude calculation
- Integration tests for all API routes using **Vitest** + `msw` (Mock Service Worker)
- End-to-end tests with **Playwright** covering the full scan → notify → message flow
- Test the optimistic UI rollback path explicitly

### 📱 Mobile UX Polish
- Request `{ facingMode: "environment" }` (rear camera) for tooth scans instead of the selfie camera — rear cameras have higher resolution and better macro focus
- Add haptic feedback (`navigator.vibrate`) on successful capture
- Lock screen orientation to portrait during the scan flow
- Add a countdown timer (3-2-1) before auto-capturing when stability is detected, reducing the need to tap the button
