# ImagineLab

Imagine it. Build it. Play it.

ImagineLab is an Android-first AI game studio for children. The child experience is a React Native
Expo app for phones and tablets; guardians use a separate responsive React website. Children build,
play, revise, and publish small browser games while guardians see projects, activity, and
evidence-based creative-practice insights.

## What is implemented

- Expo SDK 54, React Native, TypeScript, Expo Router, and a hardened WebView game preview.
- Explicit **Join as Guest** child onboarding with a private bearer token in Expo SecureStore.
- A shareable high-entropy Child ID, such as `KID-ABCD-2345`, for guardian linking.
- Parent email/password registration and login with Argon2id and HttpOnly cookie sessions.
- Local PostgreSQL storage for accounts, sessions, guardian links, projects, immutable versions,
  activities, creative-process events, insights, and radar evidence snapshots.
- Prompt-to-game creation, iterative edits, draft/publish/unpublish, public links, and speech-to-text.
- Separate Parent Portal Portfolio, Activity, and Insights pages.
- An accessible child-level, six-axis Creative Practice Radar backed by `0–4` evidence states and
  concrete evidence across the available portfolio, never peer comparison or a fixed-ability score.
- Fastify authorization for every child, guardian, project, transcription, and insight request.
- Server-only OpenAI Responses and Audio Transcriptions APIs. No client receives an OpenAI or
  PostgreSQL credential.
- Generated HTML validation, restrictive CSP, blocked external network access, and sandboxed public
  hosting.

## Start PostgreSQL and the backend

Requirements: Node.js 22+, Docker Desktop.

```bash
docker compose up -d postgres
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

The API starts at `http://localhost:8080`. With no OpenAI key, game generation and Insights use
deterministic local demo output. Voice transcription requires `OPENAI_API_KEY`; raw child audio is
never retained.

Optional local seed:

```bash
cd backend
npm run db:seed
```

This creates `parent@imaginelab.local` with password `imagine-together-123` and one linked child.
Normal demos can instead create both accounts through the Parent Portal and Expo app.

Backend checks require the local PostgreSQL container. Tests use the separate `imaginelab_test`
database and do not modify development accounts or projects:

```bash
cd backend
npm run typecheck
npm test
npm run build
```

## Run the Expo app

Install Expo Go on an Android or iOS device, then:

```bash
cd mobile
npm install
cp .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env`:

- Android Emulator: `http://10.0.2.2:8080`
- iOS Simulator or web: `http://localhost:8080`
- Physical device: your computer's LAN address, such as `http://192.168.1.50:8080`

On first launch, select **Join as Guest**. The backend creates a private child session and returns a
Child ID. The Child ID can be shared with a parent; it is not a login credential.

In either prompt field, hold **Hold to talk**, speak for up to 30 seconds, and release. The temporary
recording goes only to the authenticated backend and is deleted from the device cache after the
request.

Mobile checks:

```bash
cd mobile
npm test
npm run check
npx expo-doctor
npx expo export --platform android
```

## Run the Parent Portal

With PostgreSQL and the backend running:

```bash
cd parent-web
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Register a parent account, then enter the Child ID displayed in the
Expo app. Portfolio, Activity, and Insights share the currently selected linked child.

Website checks:

```bash
cd parent-web
npm test
npm run check
```

## Local authentication model

- PostgreSQL stores password hashes and session-token hashes, never plaintext credentials.
- Child bearer tokens are long-lived placeholders for the hackathon and remain private to the
  device. Account recovery is not yet implemented.
- Parent sessions use an HttpOnly, SameSite cookie.
- For this hackathon build, entering a valid Child ID creates an active guardian link immediately.
- The backend rechecks role, ownership, and guardian-child linkage on every protected request.

## Work beyond the hackathon

- Replace immediate Child-ID linking with a confirmed guardian/child consent flow before a real
  child-data launch.
- Add Google Sign-In, child account recovery, content moderation, a managed PostgreSQL service,
  production telemetry and deployment, and EAS release builds.
- Confirm the unresolved publishing, content, launch-region, activity-detail, and game-capability
  policies in [PRD.md](./PRD.md).
- Keep any future community gallery read-only and moderated until its child-safety policy is defined.

See [AGENTS.md](./AGENTS.md) for non-negotiable engineering constraints.
