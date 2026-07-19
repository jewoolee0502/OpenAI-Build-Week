# ImagineLab

Imagine it. Build it. Play it.

ImagineLab is an Android-first AI game studio for children. The child experience is a React Native Expo app for phones and tablets; the guardian experience is a separate responsive React website. A child describes a game, immediately plays it, and improves it through conversation. Published games get a public play link, while the parent portal shows the child's projects and evidence-based conversation starters.

## What is implemented

- React Native, TypeScript, Expo SDK 54, and Expo Router child app for phones and tablets.
- Child project list, prompt-to-game creation, hardened WebView preview, iterative edits, version status, publishing, unpublishing, clipboard, and native sharing.
- Push-to-talk game ideas and edit requests using `expo-audio` plus a server-only OpenAI transcription endpoint.
- Separate React, TypeScript, and Vite parent website with a project dashboard, activity timeline, sandboxed game preview, and AI insight reports.
- TypeScript, Fastify, OpenAI Responses API, and Audio Transcriptions API backend.
- Zod Structured Outputs for game bundles and parent insights.
- Server-side project authorization with Firebase ID-token support and an isolated local demo mode.
- Immutable project versions, separate current and published versions, activity events, and local JSON persistence for development.
- Generated HTML validation, restrictive CSP, blocked external network capabilities, and sandboxed public hosting.
- Deterministic local demo generation when `OPENAI_API_KEY` is not set.

## Run the backend

Requirements: Node.js 22 or newer.

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The API starts at `http://localhost:8080`. With no OpenAI key, it returns a local playable demo so the text-based creation flow remains testable.

Game generation still has a deterministic fallback when `OPENAI_API_KEY` is empty. Voice transcription requires an OpenAI key because raw child audio is never faked or stored. The transcription model defaults to `gpt-4o-mini-transcribe` and can be changed with `OPENAI_TRANSCRIPTION_MODEL`.

Backend checks:

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

The phone and development computer must be on the same network when using a LAN address. Restart Expo after changing `.env`.

In either game-idea field, hold **Hold to talk**, speak for up to 30 seconds, and release. ImagineLab sends the temporary recording to the authenticated backend, inserts the transcript into the editable text field, and deletes the device-side cache file after the request.

Mobile checks:

```bash
cd mobile
npm run check
npx expo-doctor
npx expo export --platform android
```

## Run the parent website

With the backend running in another terminal:

```bash
cd parent-web
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. The default `VITE_API_BASE_URL` is `http://localhost:8080`.

Website checks:

```bash
cd parent-web
npm run check
```

## Demo accounts

Local `AUTH_MODE=dev` is intentionally limited to non-production environments:

- Child: `demo-child`
- Linked guardian: `demo-guardian`

The Expo app sends the child demo identity and the parent website sends the guardian demo identity in development headers. Production must set `AUTH_MODE=firebase`, send Firebase ID tokens as bearer tokens, and assign validated `child` or `guardian` role claims server-side.

## Production work still required

- Create and configure the Firebase project, Authentication providers, Firestore, and Cloud Storage.
- Add Firebase client configuration to Expo and the parent website, then replace demo identity headers with Firebase ID tokens.
- Replace local JSON persistence with Firestore metadata and versioned Cloud Storage game bundles.
- Confirm the unresolved child/guardian consent, linking, publishing, content, launch-region, and game-capability decisions in `PRD.md`.
- Add content moderation, production telemetry, Cloud Run deployment, EAS builds, and end-to-end Firebase authorization tests.
- Keep the community gallery read-only and moderated until its child-safety policies are confirmed.

See [PRD.md](./PRD.md) for product scope and [AGENTS.md](./AGENTS.md) for non-negotiable engineering constraints.
