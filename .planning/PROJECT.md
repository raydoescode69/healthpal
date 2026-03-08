# Nyra AI — Viral Features Milestone

## Vision

Add 3 viral, Gen Z-targeted features to Nyra (AI health companion) that drive daily engagement, social sharing, and organic installs. Each feature is designed to be screenshot-worthy, competitive, and shareable.

## Core Value

Transform Nyra from a utility health app into a **social-viral health platform** — features that make users come back daily and share organically.

## Target User

Gen Z (18-25) health-conscious users who value aesthetics, humor, competition, and social sharing.

## Current State (Brownfield)

Nyra is a mature React Native + Expo SDK 54 app with:
- **AI Chat:** GPT-4o powered conversations with food logging detection
- **Food Tracking:** Text + camera-based food analysis, calorie/macro tracking
- **Dashboard:** Calendar view, donut charts, macro breakdown, water/steps
- **Diet Plans:** Offline 7-day meal plan generator
- **Auth:** Email/password + Google Sign-In, Supabase backend
- **Voice:** Cartesia STT + ElevenLabs TTS
- **Health Integrations:** Google Fit, Samsung Health, Apple Health
- **Notifications:** Push, meal reminders, calorie progress

### Tech Stack
- Expo SDK 54, React Native 0.81, TypeScript 5.9
- NativeWind v4 (Tailwind for RN), Zustand 5.0
- Supabase (auth, DB with RLS, edge functions)
- OpenAI GPT-4o (chat, food analysis, vision)
- React Native Reanimated v4, gesture-handler

### Database Tables (Supabase)
- profiles, user_profile_data, conversations, messages
- pinned_messages, food_logs, memories

## Features to Build

### Feature 1: Aura Score (Daily Health Score)
- Daily score 0-100 from sleep, nutrition, hydration, movement
- Glowing orb visualization that changes color by score
  - Lime (#bef135) = thriving, Blue = rested, Orange = low, Red = rough
- Stats breakdown: Sleep, Nutrition, Movement, Hydration with progress bars
- "Share My Aura" button — generates shareable card image
- Score label: "THRIVING", "RESTING", "STRUGGLING" etc.
- **UI Reference:** Exact match to HTML mockup — dark bg, centered orb with rings, stat bars below

### Feature 2: Nyra Roasts You (Nightly AI Roast)
- Nightly AI-generated personalized roast of user's day
- Gen Z humor tone — brutal but funny, never mean
- Shows stats that got roasted (calories, steps, sleep)
- Collectible verdicts: "Main Character Delusion", "Ghost Protocol", "Certified Grinder", etc.
- "Share the L 💀" button — shareable roast card
- "Redemption?" button — motivates comeback
- **UI Reference:** Exact match to HTML mockup — roast bubble, stat pills, verdict card

### Feature 3: Beast Bets (24hr Friend Challenges)
- Create 24-hour challenges against friends (steps, calories, workout)
- Live leaderboard with rank, avatars, progress bars
- Countdown timer to midnight
- "L" badge system for losers (optional, with permission)
- Challenge creation: pick metric, invite friends
- Friends need the app to accept — organic install driver
- **UI Reference:** Exact match to HTML mockup — active bet card, player rows, timer

## Constraints

- Must use existing Supabase backend (add new tables, don't modify existing)
- Must match exact UI from HTML mockups (dark theme, lime accent, Geist-style fonts)
- `npm install --legacy-peer-deps` required for any new packages
- Pressable with function style doesn't apply flexDirection — use inner View wrapper
- Keep existing features working — no regressions

## Requirements

### Validated (Existing)
- ✓ AI chat with GPT-4o — existing
- ✓ Food tracking (text + camera) — existing
- ✓ Nutrition dashboard — existing
- ✓ Diet plan generation — existing
- ✓ Auth (email + Google) — existing
- ✓ Voice input/output — existing
- ✓ Health integrations — existing

### Active
- [ ] Aura Score screen with orb visualization
- [ ] Aura Score calculation from tracked data
- [ ] Aura Score sharing as image
- [ ] Nightly roast generation via AI
- [ ] Roast screen with bubble UI + verdict
- [ ] Roast sharing as image
- [ ] Beast Bets challenge creation
- [ ] Beast Bets live leaderboard
- [ ] Beast Bets friend invite system
- [ ] Beast Bets countdown timer
- [ ] Supabase tables for all 3 features
- [ ] Navigation integration (new screens accessible from sidebar/dashboard)

### Out of Scope
- Body Receipt (feature 5) — deferred to next milestone
- Physique Forecast (feature 3 from doc) — deferred to next milestone
- Push notification for roasts/bets — can add later
- Deep social features (profiles, following) — not needed for MVP

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dark theme with lime accent | Matches existing Nyra brand + HTML mockups | Brand consistency |
| Supabase for bets/challenges | Already using Supabase, add tables with RLS | No new infra |
| GPT-4o for roast generation | Already integrated, can use existing chatEngine patterns | Reuse existing |
| Share via react-native-view-shot | Already installed in project | No new deps |
| Aura calculated from food_logs + steps | Data already tracked in dashboard | Leverage existing data |

---
*Last updated: 2026-03-09 after initialization*
