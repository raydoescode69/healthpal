# Feature Landscape

**Domain:** Viral health app features (social sharing, gamification, AI humor)
**Researched:** 2026-03-09

## Table Stakes

Features users expect from each viral feature. Missing = feature feels incomplete.

### Aura Score
| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Daily score 0-100 | Oura Readiness and Whoop Recovery set this standard. Users understand 0-100 instantly. | Low | Weighted average of tracked health pillars |
| Color-coded orb visualization | Visual identity. Every health score uses color to communicate good/bad. | Medium | SVG animated circles with radial gradient, color shifts by tier |
| Score label (THRIVING, RESTING, etc.) | Gives meaning to the number. A bare "67" is meaningless. | Low | Threshold mapping to 5-6 named tiers |
| Stats breakdown (4 pillars) | Users need to know WHY. Oura shows 9 contributors; 4 is right for Gen Z. | Low | Progress bars for sleep, nutrition, movement, hydration |
| Share as image card | Viral loop driver. Spotify Wrapped proved shareable data cards drive installs. | Medium | view-shot + expo-sharing with app watermark |
| Daily persistence | Score must persist, not recalculate on every visit. | Low | aura_scores table with date unique constraint |
| Yesterday delta indicator | Users want to see improvement. Simple up/down arrow creates engagement. | Low | Compare cached scores |

### AI Roast Mode
| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Personalized roast text | Generic roasts feel lazy. Must reference ACTUAL stats. | Medium | GPT-4o with food_logs + health data as context |
| Stats that got roasted | Context for humor. Show the actual numbers alongside the roast. | Low | Pill/badge UI showing referenced metrics |
| Collectible verdict badge | Shareability hook. "Main Character Delusion", "Ghost Protocol" become identity. | Low | 10-15 curated verdicts, AI selects based on data |
| Share roast card | The roast IS the shareable content. Self-deprecating humor drives virality. | Medium | Reuses Aura's view-shot + sharing pattern |
| Single roast per day | Scarcity creates anticipation and ritual (like Wordle). | Low | Key to date, cache after generation |
| Consistent humor tone | Must be brutal but funny, never mean or body-shaming. | Medium | System prompt guardrails are non-negotiable |
| Time-gated availability | "Nightly" means after 8pm. Predictable timing creates ritual. | Low | Show "roast ready" indicator after 8pm local |

### Beast Bets
| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create challenge with metric selection | Users pick what to compete on. Standard in Strive, StepUp, Motion. | Medium | 3 metrics for MVP: steps, calories, workout minutes |
| Friend invite via share link | Organic install driver. Every challenge = potential new install. | High | Deep link + invite code fallback + share sheet |
| Live leaderboard | Competition needs visibility. Rank, avatar, progress bar, current value. | Medium | Polling every 30s (upgrade to Realtime later) |
| Countdown timer | 24hr challenges need visible urgency. | Low | setInterval + Reanimated digit transitions |
| Win/loss result | Clear outcome when timer ends. Winner highlighted. | Low | End state screen with final rankings |
| Accept/decline invites | Friends must opt in to participate. | Medium | In-app invite list or deep link acceptance |

## Differentiators

Features that set Nyra apart. Not expected, but drive virality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Animated orb pulse | Mesmerizing, screenshot-worthy. Most scores are just a number in a circle. | Medium | Breathing animation with Reanimated spring/loop |
| Gen Z personality labels | "GHOST PROTOCOL", "MAIN CHARACTER ENERGY" -- language Oura would never use | Low | 6-8 labels mapped to score ranges |
| Verdict badges as collectibles | Users screenshot to prove rare verdicts. Drives daily return. | Low | "Couch Fossil", "Sleep Demon", "Certified Grinder" |
| "L" badge for losers | Playful shame mechanic. Fitness apps only reward winners. Novel. | Low | Opt-in, consensual, never auto-applied |
| No wearable required | Oura costs $300+, Whoop $30/mo. Nyra uses existing app data. | Low | Graceful degradation if data missing |
| 24hr time constraint | Most competitors do 7-day. 24hr = urgency + low commitment + daily replay. | Low | Hard-code duration, no custom for MVP |
| "Bet" framing not "Challenge" | Gambling language without real money. Exciting vs corporate wellness. | Low | Language/UI design choice only |
| Roast savagery calibration | Good days = lighter roasts. Bad days = full roast. Rewards good behavior. | Low | Prompt engineering calibration |
| Haptic feedback on reveals | Premium feel on score appear, verdict reveal, bet win. | Low | expo-haptics already installed |
| "Redemption?" CTA after roast | Turns roast into motivation with one achievable action step. | Low | Links back to tracking or dashboard |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Social profiles / following | Scope creep. Not a social network. | Share via native share sheet |
| In-app messaging | Not a social network. Messaging is its own product. | Use share sheet for communication |
| Real money betting | Legal nightmare. App store rejection risk. | Bragging rights, L badges, streaks only |
| Roast history / archive | Kills daily FOMO. If user missed it, it's gone. | Show only today's roast |
| Score trend charts (MVP) | Charting libraries add complexity. Viral value is in TODAY. | Simple delta arrow (up/down from yesterday) |
| Custom avatar system | Design overhead, low viral impact. | Supabase profile photos or initials |
| Large group bets (10+) | Leaderboards with 20 people = noise. | Cap at 5 participants per bet |
| Open/public challenges | Strangers remove the social pressure that makes it fun. | Friends-only via invite link |
| Multi-day challenges | Higher commitment = lower completion. | Hard 24hr limit |
| Push notifications (MVP) | Gen Z hates notification-heavy apps. | Badge/indicator when content ready |
| User-adjustable roast intensity | Kills surprise. Settings make it corporate. | AI calibrates based on data quality |
| Roast text copy (without card) | Loses branded format + app watermark. | Share only via generated card image |
| Score notifications / nagging | "Your score dropped!" feels judgmental. | Let users discover when they open app |
| Automated challenge suggestions | "Nyra thinks you should challenge Sarah!" = creepy. | User-initiated only |
| Complex scoring / handicaps | Removes simplicity. | Raw metric comparison, highest wins |
| Aura streaks / badges (MVP) | Over-engineering. Simple score + share is sufficient for v1. | Add gamification layer in future milestone |

## Feature Dependencies

```
Shared: Share Card System (view-shot + expo-sharing)
  --> Aura Score "Share My Aura"
  --> Roast "Share the L"
  --> Beast Bets invite sharing

Shared: Health Data Aggregation (food_logs + health integrations)
  --> Aura Score calculation (4 pillars)
  --> Roast generation (daily stats as GPT-4o context)

Aura Score --> AI Roast (roast can reference aura score in text)

Supabase tables (aura_scores) --> Aura Score + Roast
Supabase tables (bets, bet_participants) --> Beast Bets (independent)
Supabase Realtime --> Beast Bets live leaderboard ONLY

GPT-4o (existing) --> Roast generation

Deep Linking (expo-linking) --> Beast Bets friend invites ONLY
Friend/invite system (new) --> Beast Bets (must exist before challenges)
```

### Build Order Implication

1. Share Card System -- used by all 3, build once
2. Health Data Aggregation -- used by Aura + Roast, build once
3. Aura Score -- simplest standalone, validates data pipeline
4. AI Roast -- references Aura Score, reuses health data + share
5. Beast Bets -- most complex (multiplayer, deep links, real-time), last

## MVP Recommendation

**Aura Score MVP:**
1. Score calculation from food + steps + water (skip sleep if unavailable)
2. Orb visualization with color tiers
3. Sub-score breakdown with progress bars
4. Share card with app watermark
5. Yesterday delta arrow

**AI Roast MVP:**
1. GPT-4o roast with day's stats as context
2. Stats pills showing referenced metrics
3. Verdict badge selection
4. Share card
5. Time-gating (available after 8pm)
6. One roast per day (cached)

**Beast Bets MVP:**
1. Create steps challenge (single metric first, add calories/workout later)
2. Friend invite via share code (not phone contacts)
3. Leaderboard with polling-based refresh (not real-time initially)
4. 24hr countdown timer
5. Win/loss end state

**Defer to v2:**
- "L" badge system
- Real-time leaderboard (start with polling)
- Universal links for app-not-installed flow (use invite codes)
- Score trend charts / history
- Roast history / archive
- Push notifications for any feature

## Complexity Summary

| Feature | UI | Backend | AI | Overall |
|---------|-----|---------|-----|---------|
| Share Card System | Medium | None | None | Medium |
| Aura Score | High (orb) | Medium (data aggregation) | None | **High** |
| AI Roast | Medium (card) | Low (GPT call + cache) | High (prompt safety) | **Medium** |
| Beast Bets | Medium (leaderboard) | High (invites, real-time) | None | **High** |

## Sources

- [Oura Readiness Score](https://support.ouraring.com/hc/en-us/articles/360025589793-Readiness-Score) -- score methodology
- [Oura Readiness Contributors](https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors) -- weighted approach
- [Duolingo Viral Screenshot Strategy](https://startupspells.com/p/duolingo-screenshot-tracking-viral-strategy) -- shareable card mechanics
- [How to Build a Wrapped Feature](https://trophy.so/blog/how-to-build-wrapped-feature) -- summary feature patterns
- [Why Every App Does Wrapped](https://www.axios.com/2023/12/08/spotify-wrapped-apps-marketing-copy) -- viral mechanic analysis
- [Best Fitness Challenge Apps 2025](https://benfit.co.uk/best-fitness-challenge-apps-2025/) -- competitive landscape
- [Strive Fitness Challenges](https://www.strivecompetitions.com/) -- competition types
- [StepUp Group Challenges](https://thestepupapp.com/) -- leaderboard patterns
- [Gamification in Health Apps](https://www.plotline.so/blog/gamification-in-health-and-fitness-apps) -- engagement patterns
- [Designing Apps for Viral Growth](https://placid.app/blog/design-your-apps-for-viral-growth-with-social-sharing) -- shareable card design
