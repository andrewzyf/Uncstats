# UncStats

**Unemployed Uncle Statistics** — clinical audit of Instagram Reels doomscrolling.

Deadpan thermal-receipt telemetry for the terminal uncle on the couch. Exact Android Accessibility tracking; iOS Screen Time calibration against live Android scroll velocity.

## Monorepo

| Path | Role |
|------|------|
| `apps/mobile` | Expo React Native (SDK 52+), NativeWind, native bridges |
| `apps/web` | Vite + React leaderboard + `/u/:username` Story landing |
| `supabase/` | Postgres schema, RLS, Realtime |

## Stack

- **Mobile:** Expo bare/prebuild, TypeScript, NativeWind, `react-native-view-shot`, `expo-sharing`
- **Android:** Kotlin `AccessibilityService` + floating `TYPE_ACCESSIBILITY_OVERLAY` pill
- **iOS:** `FamilyControls` + `DeviceActivityMonitor` (1-min thresholds → calibrated Reels)
- **Web:** Vite, React, Tailwind, React Router
- **Backend:** Supabase (profiles, daily_stats, global_calibration, Realtime)

## Aesthetic

- Fonts: JetBrains Mono / Space Mono
- Paper: `#F4F4F0`
- Ink: `#111111`
- Warning: `#FF4F00`

Humor stays dry and statistical. No slang. No emoji UI labels.

## Quick start

```bash
npm install
npm run web          # leaderboard at localhost:5173
npm run mobile       # Expo dev client
```

Apply schema:

```bash
psql $DATABASE_URL -f supabase/schema.sql
```

## Metrics engine

Pure TypeScript: `apps/mobile/src/utils/uncMetrics.ts`  
Shared copy used by web receipts for consistent Unc Age / Employment Probability / classification.
