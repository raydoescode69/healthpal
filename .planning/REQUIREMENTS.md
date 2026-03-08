# Requirements — Nyra Viral Features (v1)

## v1 Requirements

### Aura Score
- [x] **AURA-01**: User sees a daily Aura Score (0-100) calculated from sleep, nutrition, hydration, and movement data
- [x] **AURA-02**: Aura screen displays an animated glowing orb that changes color based on score (lime=thriving, blue=rested, orange=low, red=rough)
- [x] **AURA-03**: Aura screen shows stat breakdown (Sleep, Nutrition, Movement, Hydration) with progress bars and values
- [x] **AURA-04**: Score has a text label (THRIVING, RESTING, STRUGGLING, etc.) that updates based on score range
- [x] **AURA-05**: User can tap "Share My Aura" to generate and share a screenshot card of their aura
- [x] **AURA-06**: Aura score history is persisted to Supabase (daily snapshots)
- [x] **AURA-07**: Aura screen is accessible from sidebar and dashboard navigation

### Nyra Roasts
- [ ] **ROAST-01**: User receives a nightly AI-generated personalized roast based on their day's data (calories, steps, sleep)
- [ ] **ROAST-02**: Roast screen displays AI roast in a chat bubble UI with Gen Z humor tone
- [ ] **ROAST-03**: Roast screen shows stat pills (calories, steps, sleep) with color-coded values
- [ ] **ROAST-04**: Each roast includes a collectible verdict with emoji (e.g., "Main Character Delusion 💀", "Certified Grinder 🔥")
- [ ] **ROAST-05**: User can tap "Share the L" to generate and share a roast card image
- [ ] **ROAST-06**: "Redemption?" button navigates user back to main chat for motivation
- [ ] **ROAST-07**: Roast history is persisted to Supabase
- [ ] **ROAST-08**: Roast generation uses GPT-4o with user's daily tracked data as context

### Beast Bets
- [ ] **BETS-01**: User can create a 24-hour challenge with a chosen metric (steps, calories burned, workout minutes)
- [ ] **BETS-02**: User can invite friends to a challenge via share link
- [ ] **BETS-03**: Active bet screen shows challenge title, progress bar, and live leaderboard with player ranks
- [ ] **BETS-04**: Leaderboard shows each player's avatar, name, score, and rank with visual distinction for current user
- [ ] **BETS-05**: Countdown timer shows time remaining until bet expires (midnight)
- [ ] **BETS-06**: User can create new bets via "New Bet — Challenge a Friend" button
- [ ] **BETS-07**: Challenge data syncs in real-time via Supabase subscriptions
- [ ] **BETS-08**: Challenge results are recorded when timer expires (winner/loser determined)

### Infrastructure
- [x] **INFRA-01**: New Supabase tables created for aura_scores, roasts, challenges, challenge_participants with RLS policies
- [x] **INFRA-02**: New Zustand stores for aura, roasts, and bets state management
- [x] **INFRA-03**: Navigation updated — new screens accessible from sidebar (ChatSidebar) and dashboard
- [x] **INFRA-04**: Share functionality uses react-native-view-shot + expo-sharing for all 3 features

## v2 Requirements (Deferred)
- Body Receipt (receipt-format daily summary)
- Physique Forecast (30/60/90-day body projections)
- Push notifications for roasts and bet updates
- "L" badge system on user profiles for lost bets
- Bet rematch / grudge system
- Aura streak tracking and weekly trends
- Social feed of friends' auras

## Out of Scope
- Deep social features (following, profiles, feed) — MVP focuses on share-out, not social-in
- Real money betting — Beast Bets are bragging rights only
- Apple Watch / wearable companion app — use existing health integrations
- Custom avatar system — use emoji avatars for now

## Traceability

| REQ ID | Phase | Status |
|--------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| AURA-01 | Phase 1 | Complete |
| AURA-02 | Phase 1 | Complete |
| AURA-03 | Phase 1 | Complete |
| AURA-04 | Phase 1 | Complete |
| AURA-05 | Phase 1 | Complete |
| AURA-06 | Phase 1 | Complete |
| AURA-07 | Phase 1 | Complete |
| ROAST-01 | Phase 2 | Pending |
| ROAST-02 | Phase 2 | Pending |
| ROAST-03 | Phase 2 | Pending |
| ROAST-04 | Phase 2 | Pending |
| ROAST-05 | Phase 2 | Pending |
| ROAST-06 | Phase 2 | Pending |
| ROAST-07 | Phase 2 | Pending |
| ROAST-08 | Phase 2 | Pending |
| BETS-01 | Phase 3 | Pending |
| BETS-02 | Phase 3 | Pending |
| BETS-03 | Phase 3 | Pending |
| BETS-04 | Phase 3 | Pending |
| BETS-05 | Phase 3 | Pending |
| BETS-06 | Phase 3 | Pending |
| BETS-07 | Phase 3 | Pending |
| BETS-08 | Phase 3 | Pending |
