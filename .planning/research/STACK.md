# Technology Stack — Viral Features Additions

**Project:** Nyra AI — Viral Features Milestone
**Researched:** 2026-03-09
**Scope:** NEW libraries/patterns needed on top of existing stack

## Existing Stack (Do Not Re-Add)

Already installed and working (verified from package.json):
- Expo SDK 54, React Native 0.81, TypeScript 5.9
- NativeWind v4, Zustand 5.0, Supabase JS 2.95
- React Native Reanimated v4.1, Gesture Handler 2.28
- React Native SVG 15.12, expo-linear-gradient
- expo-gl, three.js 0.182, expo-three 8.0
- expo-sensors, expo-haptics, expo-notifications, expo-linking

## New Libraries Required

**IMPORTANT:** Despite project memory claiming these are "already installed," they are NOT in package.json. Verified 2026-03-09.

### Screenshot and Sharing (Aura Score + Roast Cards)

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| react-native-view-shot | ~8.0.0 | Capture React Native views as images | Expo's official recommended approach for view-to-image capture. Provides `captureRef()` which screenshots any View component. Required for "Share My Aura" and "Share the L" cards. Install via `npx expo install`. | HIGH |
| expo-sharing | ~13.0.0 | Native share sheet for images | Triggers the OS-level share dialog with the captured image URI. Pairs with view-shot. Part of Expo SDK, just needs explicit install. | HIGH |

### Orb Visualization (Aura Score)

**Decision: Use Reanimated + SVG. Not Skia. Not Three.js.**

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| (none new) | -- | Animated orb | Use existing `react-native-reanimated` v4 + `react-native-svg` 15.12 | HIGH |

**Rationale for Reanimated + SVG over alternatives:**

1. **Why NOT @shopify/react-native-skia (v2.5.1):** Skia produces the most visually stunning shader-based orbs, but adds ~3MB to bundle size, has had compatibility issues with Expo SDK 54 (SkiaViewApi property errors), and the orb mockup is achievable with SVG radial gradients + animated opacity/scale. Not worth the risk and weight for one component.

2. **Why NOT Three.js/expo-three (already installed):** Three.js is already in package.json but is massive overkill for a 2D glowing orb. WebGL context setup is fragile on mobile, and `expo-gl` has known rendering inconsistencies. The orb is essentially concentric circles with glow -- SVG handles this perfectly.

3. **Why Reanimated + SVG wins:** Both already installed. Reanimated v4 drives 120fps animations on UI thread. SVG provides radial gradients, opacity animation, and scale transforms. The orb is concentric `<Circle>` elements with animated opacity and scale using `useAnimatedProps`. Glow effect via layered semi-transparent circles with decreasing opacity.

**Implementation pattern:**
```typescript
import Animated, { useAnimatedProps, withRepeat, withTiming } from 'react-native-reanimated';
import { Circle, Svg, Defs, RadialGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// Use useAnimatedProps to drive radius, opacity, color based on aura score
```

### Real-Time Multiplayer (Beast Bets)

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| (none new) | -- | Real-time leaderboard | Supabase Realtime (already in @supabase/supabase-js 2.95) | HIGH |

**Supabase Realtime provides everything Beast Bets needs:**

1. **Postgres Changes** -- Subscribe to `bet_participants` table changes for live progress updates. When a participant's step count updates, all subscribers see it instantly.

2. **Broadcast** -- Lightweight pub/sub for ephemeral events (challenge accepted, countdown sync, winner announcement). No database write needed.

3. **Presence** -- Track who is currently viewing a bet. Show "3 players watching" indicator. Optional but adds social feel.

**Implementation pattern:**
```typescript
const channel = supabase.channel(`bet:${betId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'bet_participants',
    filter: `bet_id=eq.${betId}`
  }, (payload) => {
    // Update leaderboard in Zustand store
  })
  .on('broadcast', { event: 'winner' }, (payload) => {
    // Show winner animation
  })
  .subscribe();
```

**React Native gotcha:** Call `supabase.auth.startAutoRefresh()` when app is focused and `stopAutoRefresh()` when backgrounded, since Supabase cannot detect focus state in RN.

### Countdown Timer (Beast Bets)

No library needed. A countdown timer is a `setInterval` that computes time remaining to midnight. Animate digit changes with Reanimated `withTiming` for smooth transitions.

### Deep Linking / Friend Invites (Beast Bets)

No new library needed. `expo-linking` (already installed) generates deep links like `nyra://bet/{betId}`. Share via `expo-sharing`. expo-router handles deep link routing on both cold and warm start.

## Supporting Libraries to Consider (Not Required for MVP)

| Library | Version | Purpose | When to Add | Confidence |
|---------|---------|---------|-------------|------------|
| expo-haptics | ~15.0.8 | Tactile feedback on score reveal, bet wins | Already installed. Use `Haptics.impactAsync()` on key moments. | HIGH |
| lottie-react-native | ~7.1.0 | Pre-built celebration animations | Only if custom Reanimated animations feel insufficient for win celebrations | MEDIUM |
| expo-notifications | ~0.32.16 | Roast ready notification, bet expiry alerts | Already installed. Wire up scheduled nightly roast notification. | HIGH |

## Alternatives Considered and Rejected

| Category | Rejected | Why Not |
|----------|----------|---------|
| Orb rendering | @shopify/react-native-skia v2.5.1 | 3MB bundle cost, SDK 54 compatibility issues reported, overkill for concentric circles |
| Orb rendering | three.js (already installed) | WebGL fragile on mobile, massive overhead for 2D effect |
| Real-time | Firebase Realtime DB | Already on Supabase; adding Firebase would mean two backends |
| Real-time | Socket.io / Pusher | Supabase Realtime handles all needed patterns natively |
| State management | Redux / Jotai | Already using Zustand 5.0, no reason to switch |
| Sharing | react-native-share | expo-sharing is the Expo-blessed approach, simpler API |
| Animation | react-native-animatable | Reanimated v4 is strictly superior, already installed |
| Countdown | react-native-countdown-component | Abandoned packages with no RN 0.81 support; trivial to build |

## Installation

```bash
# Two new packages needed
npx expo install react-native-view-shot expo-sharing
```

That is it. Two packages. Everything else is already in the project or achievable with existing dependencies.

## Supabase Configuration Required

### Enable Realtime on Tables

In Supabase Dashboard, enable Realtime replication on:
- `bet_participants` (for live leaderboard updates)

### New Tables Needed

```sql
-- Aura Score
aura_scores (id, user_id, score, sleep, nutrition, movement, hydration, date)

-- Roast Mode
roasts (id, user_id, roast_text, verdict, stats_json, date)

-- Beast Bets
bets (id, creator_id, metric, duration, status, created_at, expires_at)
bet_participants (id, bet_id, user_id, progress, joined_at)
```

All tables need RLS policies. Beast Bets tables need multi-user read policies (participants can see each other's data within a shared bet) -- this is a new pattern for this codebase.

## Sources

- [Expo captureRef / react-native-view-shot docs](https://docs.expo.dev/versions/latest/sdk/captureRef/)
- [Supabase Realtime docs](https://supabase.com/docs/guides/realtime)
- [Supabase Realtime Concepts](https://supabase.com/docs/guides/realtime/concepts)
- [React Native Skia Orb Shader Animation](https://www.animatereactnative.com/post/orb-shader-animation-with-react-native-skia)
- [@shopify/react-native-skia npm](https://www.npmjs.com/package/@shopify/react-native-skia)
- [Expo Skia docs](https://docs.expo.dev/versions/latest/sdk/skia/)
- [React Native Reanimated docs](https://docs.swmansion.com/react-native-reanimated/)
- [Supabase Realtime React Native](https://www.restack.io/docs/supabase-knowledge-supabase-realtime-react-native)
- [Supabase Realtime Presence Authorization](https://supabase.com/features/realtime-presence-authorization)
