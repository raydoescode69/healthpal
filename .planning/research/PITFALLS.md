# Domain Pitfalls

**Domain:** Viral health app features (shareable cards, real-time multiplayer, AI content)
**Researched:** 2026-03-09

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: captureRef Fails on Non-Rendered Views
**What goes wrong:** Share card component has `display: none`, `opacity: 0`, or is conditionally unmounted. `captureRef()` returns blank/null image or throws.
**Why it happens:** react-native-view-shot requires the view to be actually rendered in the native view hierarchy.
**Consequences:** Share button appears to do nothing, or shares blank image. Users share broken cards = anti-viral.
**Prevention:** Render share card off-screen with `position: 'absolute', left: -9999` rather than hiding it. Set `collapsable={false}` on the captured View. Test on both iOS and Android -- behavior differs.
**Detection:** Share button produces white/blank image, or `captureRef` promise rejects.

### Pitfall 2: Supabase Realtime Connection Leak in React Native
**What goes wrong:** Navigating away from BetDetailScreen without unsubscribing leaves orphan Realtime channels open. Multiple visits create multiple subscriptions. App accumulates WebSocket connections.
**Why it happens:** React Native navigation keeps screens mounted in the stack. `useEffect` cleanup may not fire when expected with stack navigation.
**Consequences:** Memory leak, battery drain, potential Supabase connection limit exhaustion, duplicate state updates causing UI glitches.
**Prevention:** Always call `supabase.removeChannel(channel)` in useEffect cleanup. Use `useFocusEffect` from `@react-navigation/native` instead of `useEffect` for subscription lifecycle. Verify cleanup fires on screen blur.
**Detection:** Multiple console logs for same event, increasing memory usage over session, Supabase dashboard showing many active connections per user.

### Pitfall 3: Supabase Auth Token Expiry in React Native Background
**What goes wrong:** User backgrounds app, returns after token expiry, Realtime subscriptions silently fail. Bet leaderboard appears frozen.
**Why it happens:** Supabase JS cannot detect app focus state in React Native (unlike browsers). Auto-refresh stops when app is backgrounded.
**Consequences:** Stale data shown as current, users think leaderboard is live when it's frozen.
**Prevention:** Call `supabase.auth.startAutoRefresh()` in AppState 'active' handler, `stopAutoRefresh()` on 'background'. Re-subscribe to channels on app resume.
**Detection:** Leaderboard not updating after app resume, auth errors in logs.

### Pitfall 4: Pressable Function Style Doesn't Apply flexDirection
**What goes wrong:** Using `({ pressed }) => ({ flexDirection: 'row', ... })` on Pressable doesn't lay out children in a row.
**Why it happens:** Known React Native bug where function-style Pressable styles don't properly propagate certain layout properties.
**Consequences:** Misaligned share buttons, broken card layouts on interactive elements.
**Prevention:** Always use an inner `<View style={{ flexDirection: 'row', alignItems: 'center' }}>` inside Pressable for row layouts. This is already documented in project memory.
**Detection:** Buttons with icon + text stacking vertically instead of horizontally.

## Moderate Pitfalls

### Pitfall 1: GPT-4o Roast Tone Inconsistency
**What goes wrong:** Roasts are sometimes too mean, sometimes too bland. Tone varies wildly between calls.
**Prevention:** Use a detailed system prompt with examples of good/bad roasts. Include explicit constraints ("never mock eating disorders", "never be genuinely hurtful"). Set temperature to 0.7-0.8 for consistency with personality. Test with edge cases (0 steps, 5000 calories, etc.). Consider a content moderation pass.

### Pitfall 2: SVG Animation Performance on Low-End Android
**What goes wrong:** Aura orb animation drops frames on budget Android devices. Multiple animated SVG circles with opacity/scale transitions overwhelm the render pipeline.
**Prevention:** Limit animated circles to 3-4 layers max. Use `useAnimatedProps` (UI thread) not `useAnimatedStyle` for SVG props. Test on a low-end device (Galaxy A series). Consider reducing animation complexity based on device tier.

### Pitfall 3: Race Condition in Bet Expiry
**What goes wrong:** Two clients both think they should mark the bet as "completed" when the countdown hits zero. Double-write to database causes inconsistent state.
**Prevention:** Use a Supabase Edge Function triggered by pg_cron or a database trigger to handle bet expiry server-side. Clients should display results, not determine them. If client-side: use a Supabase RPC with `FOR UPDATE` locking.

### Pitfall 4: Deep Link Handling on Cold Start vs Warm Start
**What goes wrong:** Deep link from bet invite works when app is already open but fails on cold start (app not running). User taps invite, app opens to home screen instead of bet.
**Prevention:** Handle deep links in both `expo-linking` initial URL (cold start) and event listener (warm start). Test both scenarios on both platforms. Use expo-router's built-in deep link handling which covers both cases.

### Pitfall 5: Share Card Aspect Ratio Inconsistency
**What goes wrong:** Share card looks good on the device but gets cropped/stretched when posted to Instagram Stories, Twitter, or iMessage.
**Prevention:** Design share cards at Instagram Story aspect ratio (9:16, 1080x1920) or square (1:1, 1080x1080) since these work across most platforms. Include padding so content isn't cut by platform UI chrome. Test sharing to Instagram, Twitter, WhatsApp, and iMessage.

## Minor Pitfalls

### Pitfall 1: Midnight Timezone Mismatch
**What goes wrong:** Countdown timer says "3 hours left" but bet expires at midnight in a different timezone than the user expects.
**Prevention:** Always use UTC for bet expiry. Display countdown based on UTC midnight. Show timezone in UI if users span timezones.

### Pitfall 2: Aura Score = 0 Edge Case
**What goes wrong:** User with no tracked data gets score 0 and a "STRUGGLING" label, which feels punishing for new users.
**Prevention:** Show "Track your first meal to get your Aura Score" instead of 0. Require minimum data threshold before generating a score.

### Pitfall 3: Haptic Feedback Spam
**What goes wrong:** Every animation frame triggers haptics. Phone vibrates constantly.
**Prevention:** Haptic only on discrete events: score reveal, bet win/loss, share button tap. Never on continuous animations.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Aura Score | SVG performance on low-end Android | Limit to 3-4 animated layers, test on budget device |
| Aura Score | captureRef blank image | `collapsable={false}`, off-screen not hidden |
| Roast Mode | GPT-4o tone inconsistency | Detailed system prompt with examples and guardrails |
| Roast Mode | Roast takes too long to generate | Show loading animation, cache roast once generated per day |
| Beast Bets | Realtime connection leak | `useFocusEffect` cleanup, not just `useEffect` |
| Beast Bets | Auth token expiry on resume | `startAutoRefresh`/`stopAutoRefresh` lifecycle |
| Beast Bets | Bet expiry race condition | Server-side expiry via Edge Function or DB trigger |
| Beast Bets | Deep link cold start failure | Handle both initial URL and event listener |

## Sources

- [Expo captureRef docs](https://docs.expo.dev/versions/latest/sdk/captureRef/)
- [Supabase Realtime React Native](https://www.restack.io/docs/supabase-knowledge-supabase-realtime-react-native)
- [react-native-view-shot issues](https://github.com/gre/react-native-view-shot/issues/553)
- [Supabase Realtime Concepts](https://supabase.com/docs/guides/realtime/concepts)
