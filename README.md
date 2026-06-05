# FireScout

**A wildfire smoke intelligence agent that shows where smoke may be coming from, what changed, and what to do before you go outside.**

FireScout combines AirNow AQI, NASA FIRMS satellite fire detections, NWS wind forecasts, NASA satellite imagery, and a Gaussian plume model to generate personalized wildfire-smoke risk maps and messaging alerts.

## Architecture

```
User (Slack / Web)
  → Photon/Spectrum webhook
  → FireScout API
  → RocketRide workflow (message_router → risk_brief / what_changed / map_generation)
  → XTrace memory read (user locations, activity, prior risk state)
  → official_data_ingestion (AirNow + NASA FIRMS + NWS + CAL FIRE)
  → Gaussian plume model (lib/plume.ts)
  → Risk score (lib/risk.ts)
  → Butterbase (store report, obs, fire detections, plume run, messages)
  → XTrace memory write (revised risk state + artifact)
  → Photon response (text brief + map link)
```

## Hackathon Technology Usage

### RocketRide — Core Workflow Orchestration
- 6 pipeline specs in `/pipelines/` (message router, data ingestion, plume model, map gen, risk brief, what changed)
- `lib/integrations/rocketride.ts` — tries RocketRide SDK, falls back to local executor
- Every user query routes through a named pipeline

### Butterbase — Backend DB, Storage, AI Model Gateway
- Tables: users, locations, air_quality_observations, fire_detections, wind_snapshots, plume_model_runs, risk_reports, map_artifacts, messages
- `lib/integrations/butterbase.ts` — REST API adapter with in-memory fallback
- `lib/integrations/modelGateway.ts` — Butterbase AI chat for brief generation

### XTrace — Persistent Self-Revising Memory
- Read before every response: locations, activity, previous risk state
- Write after every response: updated risk state, revised beliefs, artifacts
- Group memory for team use cases
- `lib/integrations/xtrace.ts`

### Photon/Spectrum — Messaging Delivery
- `/api/photon/webhook` — Slack Event API + Photon format + slash commands
- Quick action buttons (What changed? / Show map / Explain)
- `lib/integrations/photon.ts`

## Data Sources

| Source | What it provides | Key |
|--------|-----------------|-----|
| AirNow | Official real-time AQI / PM2.5 | `AIRNOW_API_KEY` |
| NASA FIRMS | MODIS/VIIRS fire detections | `NASA_FIRMS_MAP_KEY` |
| NWS | Wind speed + direction | None (User-Agent) |
| NASA GIBS | Satellite imagery tiles | None |
| NIFC/IRWIN | CAL FIRE incident context | None |

## Gaussian Plume Model

Simplified ground-level Gaussian dispersion:
```
C(x,y) = Q/(2πuσyσz) · exp(-y²/2σy²) · [exp(-(z-H)²/2σz²) + exp(-(z+H)²/2σz²)]
```
Wind convention: meteorological (FROM direction). Smoke moves TOWARD windDir+180°.
Grid: 40×40 over 100 km radius. Scores normalized 0–100.
**This is an EXPLAINABLE ESTIMATE, not an official atmospheric forecast.**

## Risk Score

```
finalRisk = 0.45·AQIScore + 0.25·plumeScore + 0.15·trendScore + 0.10·fireProximityScore + 0.05·activityScore
```
Levels: CLEAR (0–25) / WATCH (26–50) / ACT (51–75) / CRITICAL (76–100)

## Safety Disclaimer

**FireScout is decision support, not an emergency authority.**
AirNow data = real-time/preliminary AQI reporting, not final AQS regulatory-certified data.
For evacuation or emergency guidance, follow local officials, CAL FIRE, NWS, and emergency alerts.

## How to Run

```bash
npm install
cp .env.example .env.local
# Set USE_MOCK_DATA=true or add real API keys
npm run dev          # http://localhost:3000
npm run test:berkeley  # End-to-end test with mock data
npm run seed           # Seed demo data + XTrace memory
```

## Demo Script

1. "Monitor Berkeley for outdoor running."
2. "How bad is it right now?"
3. "Show me the smoke risk map."
4. "What changed since yesterday?"
5. "Why is smoke bad?"

## Known Limitations

- Mock mode (USE_MOCK_DATA=true) sets confidence=Low and shows warning banner
- Plume model is a proxy; not a certified atmospheric model
- Static PNG screenshot not implemented (map link sent instead)
- HRRR-Smoke not implemented (placeholder adapter)
