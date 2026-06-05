# FireScout

Wildfire smoke intelligence agent — hackathon MVP.

## Stack
- Next.js 16 App Router, TypeScript, Tailwind CSS
- Leaflet for interactive maps
- In-memory fallbacks for all integrations (Butterbase, XTrace, Photon, RocketRide)

## Run
```bash
npm run dev            # http://localhost:3000
npm run test:berkeley  # end-to-end pipeline test (mock)
npm run seed           # seed demo data + XTrace memory
npm run submit         # print hackathon submission details
```

## Environment
Copy `.env.example` → `.env.local`. Set `USE_MOCK_DATA=true` for local dev without API keys.

## Key files
- `lib/workflow.ts` — core orchestration for all user intents
- `lib/plume.ts` — Gaussian plume model
- `lib/risk.ts` — risk scoring (AQI + plume + trend + fires + activity)
- `lib/integrations/` — Butterbase, XTrace, Photon, RocketRide adapters
- `lib/officialData/` — AirNow, NASA FIRMS, NWS, NASA GIBS adapters
- `pipelines/` — RocketRide pipeline specs (JSON)
- `app/api/photon/webhook/route.ts` — Slack/Photon webhook entry point
- `app/map/[reportId]/page.tsx` — interactive map page

## Hackathon required technologies
- **RocketRide** — `lib/integrations/rocketride.ts` + `pipelines/*.pipe.json`
- **Butterbase** — `lib/integrations/butterbase.ts`
- **XTrace** — `lib/integrations/xtrace.ts`
- **Photon/Spectrum** — `lib/integrations/photon.ts` + `/api/photon/webhook`

## Demo flows
1. "Monitor Berkeley for outdoor running"
2. "How bad is it right now?"
3. "Show me the smoke risk map"
4. "What changed since yesterday?"
5. "Why is smoke bad?"

## Hackathon submission
Submission code: `havefun0605` — Hackathon slug: `agentic-ai-Hackathon`
Run `npm run submit` to print details. Do not submit automatically without confirmation.
