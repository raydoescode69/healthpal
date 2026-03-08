# Roadmap: Nyra Viral Features

## Overview

Three viral features layered onto an existing health app. Phase 1 lays the database and state foundation while delivering the simplest feature (Aura Score). Phase 2 adds AI-generated roasts, reusing the share infrastructure from Phase 1. Phase 3 tackles the most complex feature (Beast Bets) with real-time multiplayer, now that all supporting infrastructure exists.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation + Aura Score** - Supabase tables, Zustand stores, navigation, and the complete Aura Score feature with orb visualization and sharing
- [ ] **Phase 2: Nyra Roasts** - Nightly AI roast generation, roast screen with bubble UI and verdict cards, roast sharing
- [ ] **Phase 3: Beast Bets** - 24-hour friend challenges with live leaderboard, countdown timer, invite system, and real-time sync

## Phase Details

### Phase 1: Foundation + Aura Score
**Goal**: Users can view their daily health aura as a glowing orb, see stat breakdowns, and share their aura card -- with all database and navigation infrastructure ready for subsequent features
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, AURA-01, AURA-02, AURA-03, AURA-04, AURA-05, AURA-06, AURA-07
**Success Criteria** (what must be TRUE):
  1. User can navigate to the Aura screen from the sidebar and dashboard
  2. User sees a daily score (0-100) with a color-changing animated orb and text label that reflects their tracked health data
  3. User sees a stat breakdown (Sleep, Nutrition, Movement, Hydration) with progress bars below the orb
  4. User can tap "Share My Aura" and a shareable card image opens in the native share sheet
  5. Aura score snapshots persist across app restarts (stored in Supabase)
**Plans**: 2 plans

Plans:
- [ ] 01-01: Supabase tables, RLS policies, Zustand stores, and navigation wiring
- [ ] 01-02: Aura Score screen -- orb visualization, score calculation, stat breakdown, sharing

### Phase 2: Nyra Roasts
**Goal**: Users receive a nightly AI-generated roast of their day with Gen Z humor, see their stats roasted, collect verdicts, and share the roast card
**Depends on**: Phase 1
**Requirements**: ROAST-01, ROAST-02, ROAST-03, ROAST-04, ROAST-05, ROAST-06, ROAST-07, ROAST-08
**Success Criteria** (what must be TRUE):
  1. User can view a personalized AI roast of their day's health data in a chat bubble UI with Gen Z humor tone
  2. Roast screen shows color-coded stat pills (calories, steps, sleep) and a collectible verdict with emoji
  3. User can tap "Share the L" to generate and share a roast card image via native share sheet
  4. User can tap "Redemption?" to navigate back to the main chat for motivation
  5. Roast history persists across sessions (stored in Supabase)
**Plans**: 1 plan

Plans:
- [ ] 02-01-PLAN.md — GPT-4o roast engine, roast screen UI (bubble, stat pills, verdict), and shareable roast card

### Phase 3: Beast Bets
**Goal**: Users can create 24-hour health challenges, invite friends, track progress on a live leaderboard, and see results when the timer expires
**Depends on**: Phase 1
**Requirements**: BETS-01, BETS-02, BETS-03, BETS-04, BETS-05, BETS-06, BETS-07, BETS-08
**Success Criteria** (what must be TRUE):
  1. User can create a new 24-hour challenge by choosing a metric (steps, calories, workout minutes) and inviting friends via share link
  2. Active bet screen shows challenge title, each player's avatar/name/score/rank on a live leaderboard with visual distinction for the current user
  3. Countdown timer displays time remaining until the bet expires at midnight
  4. Leaderboard updates in real-time as participants' progress changes (via Supabase subscriptions)
  5. Challenge results are automatically determined when the timer expires (winner/loser recorded)
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Challenge creation, invite sharing, bets service layer, Zustand store with realtime subscriptions
- [ ] 03-02-PLAN.md — Bet detail screen with live leaderboard, countdown timer, progress tracking, results display

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Aura Score | 0/2 | Not started | - |
| 2. Nyra Roasts | 0/1 | Not started | - |
| 3. Beast Bets | 0/2 | Not started | - |
