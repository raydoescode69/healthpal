# Research Summary: Nyra Viral Features

**Domain:** Viral/social feature integration into existing health app
**Researched:** 2026-03-09
**Overall confidence:** HIGH

## Executive Summary

The existing Nyra stack is remarkably well-suited for the three viral features. The project already has React Native Reanimated v4, SVG, Supabase (with Realtime built into the JS client), expo-haptics, and expo-notifications. The gap is small: only `react-native-view-shot` and `expo-sharing` need to be added as new dependencies. These are referenced in project memory as "already installed" but are NOT present in package.json -- they must be explicitly added via `npx expo install`.

The Aura Score orb visualization should be built with Reanimated + SVG rather than Skia or Three.js. While Skia (v2.5.1) would produce the most visually stunning shader-based orb, it adds ~3MB bundle weight and has had Expo SDK 54 compatibility friction (SkiaViewApi property errors). Three.js is already installed but WebGL on mobile is fragile and massive overkill for a 2D glowing circle effect. The orb mockup (concentric circles with color-coded glow) is fully achievable with animated SVG circles and radial gradients driven by Reanimated shared values.

Beast Bets real-time multiplayer is fully covered by Supabase Realtime (Postgres Changes for live leaderboard, Broadcast for ephemeral events, Presence for viewer tracking). The critical risk is Beast Bets' RLS complexity -- all existing Supabase policies use single-user access (`auth.uid() = user_id`), but Beast Bets requires cross-user read policies where participants can see each other's data within shared challenges. This is a new pattern for the codebase.

The shareable card pattern (used by both Aura Score and Roast Mode) follows a straightforward flow: render the card as a React Native View, capture it with `captureRef()`, then share via `expo-sharing`.

## Key Findings

**Stack:** Only 2 new packages needed: `react-native-view-shot` and `expo-sharing`. Everything else uses existing dependencies.
**Architecture:** Feature-slice pattern (screen + engine + store + components per feature) matching existing codebase conventions. Orb uses Reanimated + SVG, not Skia or Three.js.
**Critical pitfall:** Beast Bets introduces multi-user RLS policies (new pattern). Supabase Realtime in React Native requires manual `startAutoRefresh()`/`stopAutoRefresh()` lifecycle management.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Aura Score** - Build first. Simplest integration, establishes the shareable card pattern that Roast Mode reuses. Install view-shot + expo-sharing here.
   - Addresses: Score calculation, orb visualization, share card
   - Avoids: Real-time complexity, multi-user patterns
   - New: 1 table, 1 store, 1 screen, orb component, share card component

2. **AI Roast Mode** - Build second. Reuses sharing pattern from Aura Score, adds GPT-4o prompt engineering (already integrated).
   - Addresses: Roast generation, verdict system, share card
   - Benefits from: Aura Score existing (can reference in roasts), sharing infrastructure already proven
   - New: 1 table, 1 store, 1 screen, roast card component

3. **Beast Bets** - Build last. Most complex (real-time, multiplayer, invites), benefits from having other features' UI patterns established.
   - Addresses: Challenge creation, live leaderboard, friend invites, countdown
   - Requires: Multi-user RLS policies (new pattern), Supabase Realtime subscriptions, deep links
   - New: 2-3 tables, 1 store, 2 screens, leaderboard component

**Phase ordering rationale:**
- Aura Score and Roast Mode share the view-shot + sharing pattern; build it once in Phase 1, reuse in Phase 2
- Beast Bets is the only feature requiring Supabase Realtime subscriptions and multi-user RLS; isolating it reduces risk
- Each phase delivers a shippable, shareable feature independently

**Research flags for phases:**
- Phase 1 (Aura Score): Standard patterns, LOW research risk
- Phase 2 (Roast Mode): LOW research risk. Prompt engineering is creative work, not technical research
- Phase 3 (Beast Bets): MEDIUM research risk. RLS policies, Realtime lifecycle, deep link handling need investigation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 2 new deps, both Expo-official. Verified against package.json and Expo docs. |
| Features | HIGH | All features achievable with existing + minimal new stack |
| Architecture | HIGH | Standard patterns: Zustand slices, Supabase tables, SVG animation |
| Pitfalls | MEDIUM | Supabase Realtime RN lifecycle and multi-user RLS are new patterns for this codebase |

## Gaps to Address

- Sleep data source unclear: Google Fit/Apple Health integration exists but sleep data availability not verified
- Exact Supabase RLS policies for Beast Bets tables (cross-user reads) -- needs phase-specific design
- Deep link universal link configuration for app-not-installed fallback -- needs research during Beast Bets phase
- GPT-4o prompt engineering for roast tone (Gen Z humor, brutal but not mean) -- creative work, not technical
- Challenge winner determination timing (client vs server-side Edge Function) -- needs decision during Bets phase
