# Architecture Patterns

**Domain:** Viral features integration into existing health app (Nyra)
**Researched:** 2026-03-09

## Existing Architecture Summary

Nyra is an Expo Router app with two route groups: `(auth)` for login/onboarding and `(main)` for all authenticated screens. The `(main)` layout uses a `Stack` navigator with `headerShown: false`. Navigation between screens happens via `useRouter().push()` and sidebar links (`ChatSidebar`). State lives in three Zustand stores (`useAuthStore`, `useTrackingStore`, `useThemeStore`). Business logic lives in `lib/` modules (`chatEngine.ts`, `foodAnalyzer.ts`, `dietEngine.ts`). The Supabase client is a singleton in `lib/supabase.ts`, used directly by stores and lib modules.

```
app/
  _layout.tsx          -- Root: auth guard, fonts, splash, notifications
  (auth)/
    _layout.tsx        -- Stack for auth screens
    index.tsx          -- Login
    onboarding.tsx     -- Profile setup
  (main)/
    _layout.tsx        -- Stack for authenticated screens (headerShown: false)
    chat.tsx           -- Main chat (default screen)
    dashboard.tsx      -- Calendar + nutrition tracking
    camera.tsx         -- Food photo capture
    track-food.tsx     -- Manual food entry
    connectors.tsx     -- Health integrations
    edit-profile.tsx   -- Profile editor
    voice-test.tsx     -- Voice mode

store/
  useAuthStore.ts      -- session, user, profile
  useTrackingStore.ts  -- food logs, water, steps, daily summary
  useThemeStore.ts     -- dark/light mode

lib/
  supabase.ts          -- Singleton Supabase client
  chatEngine.ts        -- GPT-4o chat with context loading
  foodAnalyzer.ts      -- Food image/text analysis
  dietEngine.ts        -- Meal plan generation
  theme.ts             -- THEMES object (dark/light color maps)
  types.ts             -- All TypeScript interfaces
  nutritionUtils.ts    -- Calorie/macro target calculations
  usePedometer.ts      -- Step counting hook
  ...

components/
  ChatSidebar.tsx      -- Drawer nav with profile card + links to screens
  FoodLogModal.tsx     -- Food logging UI
  DietPlanCard.tsx     -- Meal plan display
  ActivityRings.tsx    -- Ring visualization
  ParticleSphere.tsx   -- Animated sphere
  ...
```

## Recommended Architecture

Each new feature follows the existing pattern: **screen in `app/(main)/`** + **engine in `lib/`** + **Zustand store in `store/`** + **components in `components/`**. This mirrors how `dashboard.tsx` uses `useTrackingStore` + `nutritionUtils.ts`.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **app/(main)/aura.tsx** | Aura Score screen: orb visualization, stat bars, share button | `useAuraStore`, `useTrackingStore` (read food/water/steps), `useAuthStore` (userId) |
| **lib/auraEngine.ts** | Pure function: score calculation from tracking data (0-100 with sub-scores) | Called by `useAuraStore`, reads data passed as arguments |
| **store/useAuraStore.ts** | Today's aura score, score history, loading state | Calls `auraEngine`, reads/writes `supabase.aura_scores` |
| **components/AuraOrb.tsx** | Animated glowing orb with color based on score tier | Props only (score, color) -- no store access |
| **components/AuraShareCard.tsx** | Shareable card layout captured via `react-native-view-shot` | Props only (score, stats, date) |
| | | |
| **app/(main)/roast.tsx** | Nightly Roast screen: roast bubble, stat pills, verdict, share | `useRoastStore`, `useTrackingStore`, `useAuthStore` |
| **lib/roastEngine.ts** | GPT-4o roast generation with health data context | OpenAI API (following chatEngine.ts pattern), data passed as arguments |
| **store/useRoastStore.ts** | Today's roast, roast history, generation state | Calls `roastEngine`, reads/writes `supabase.roasts` |
| **components/RoastBubble.tsx** | Chat-style roast text display | Props only |
| **components/RoastShareCard.tsx** | Shareable roast card for screenshots | Props only |
| | | |
| **app/(main)/bets.tsx** | Beast Bets screen: active bets list, pending invites, create button | `useBetsStore`, `useAuthStore` |
| **app/(main)/create-bet.tsx** | Challenge creation flow: pick metric, invite friends | `useBetsStore`, `useAuthStore` |
| **lib/betsEngine.ts** | Challenge CRUD, progress tracking, winner determination | `supabase` (challenges, challenge_participants, friendships tables) |
| **store/useBetsStore.ts** | Active bets, pending invites, friend list, real-time subscriptions | Calls `betsEngine`, manages Supabase real-time channels |
| **components/BetCard.tsx** | Active bet display with countdown timer + mini leaderboard | Props only |
| **components/PlayerRow.tsx** | Single player in leaderboard with avatar + progress bar | Props only |

### Navigation Integration

New screens slot into the existing `(main)` Stack navigator with zero layout changes. The `(main)/_layout.tsx` uses `headerShown: false` and auto-registers all files as stack screens. Add navigation entries to `ChatSidebar.tsx`:

```
ChatSidebar additions:
  - "Aura Score"  -> router.push("/(main)/aura")
  - "Roasts"      -> router.push("/(main)/roast")
  - "Beast Bets"  -> router.push("/(main)/bets")
```

### Data Flow

**Aura Score:**
```
                    useTrackingStore
                   (food_logs, water, steps)
                          |
                          v
  app/(main)/aura.tsx --> useAuraStore.calculateToday()
                          |
                          v
                    lib/auraEngine.ts --> calculateAuraScore(foodLogs, steps, water, sleep?)
                          |
                          |  Returns: { total, sleep, nutrition, movement, hydration } (0-100 each)
                          v
                    useAuraStore (caches result)
                          |
                    Writes to: supabase.aura_scores (one row per user per day)
                    Reads from: supabase.aura_scores (history)
                          |
                          v
                    AuraOrb renders with score + color
                    AuraShareCard captured via captureRef() -> expo-sharing
```

**AI Roast:**
```
  app/(main)/roast.tsx --> useRoastStore.generateRoast()
                                |
                                v
                          lib/roastEngine.ts
                                |
                    Reads (passed as args): food_logs (today), steps, waterGlasses, profile
                                |
                                v
                          OpenAI GPT-4o API
                          (system prompt: "You are Nyra, roast this user's health day..."
                           + structured stats + verdict list to choose from)
                                |
                                v
                    useRoastStore (caches today's roast)
                          |
                    Writes to: supabase.roasts (one row per user per day)
                          |
                          v
                    RoastBubble renders text + verdict
                    RoastShareCard captured via captureRef() -> expo-sharing
```

**Beast Bets:**
```
  CREATE FLOW:
  app/(main)/create-bet.tsx --> useBetsStore.createChallenge()
                                      |
                                      v
                                lib/betsEngine.ts
                                      |
                                Inserts into: supabase.challenges + challenge_participants
                                      |
                                      v
                                expo-sharing deep link: nyra://bet/{betId}

  LIVE VIEW:
  app/(main)/bets.tsx --> useBetsStore.subscribeToChallenge(betId)
                                |
                                v
                          Supabase real-time channel
                          (postgres_changes on challenge_participants
                           where challenge_id = betId)
                                |
                                v
                          useBetsStore updates participant progress
                                |
                                v
                          BetCard + PlayerRow re-render with new values

  EXPIRY:
  Client-side timer hits zero --> useBetsStore checks if already completed
    --> If not: calls betsEngine.completeBet() which compares values, sets winner
```

## New Supabase Tables

### aura_scores

```sql
CREATE TABLE aura_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  sleep_score INTEGER DEFAULT 50,
  nutrition_score INTEGER DEFAULT 50,
  movement_score INTEGER DEFAULT 50,
  hydration_score INTEGER DEFAULT 50,
  label TEXT,  -- 'THRIVING', 'RESTING', 'STRUGGLING', etc.
  scored_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, scored_date)
);

CREATE INDEX idx_aura_scores_user_date ON aura_scores(user_id, scored_date DESC);
ALTER TABLE aura_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aura scores"
  ON aura_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own aura scores"
  ON aura_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own aura scores"
  ON aura_scores FOR UPDATE USING (auth.uid() = user_id);
```

### roasts

```sql
CREATE TABLE roasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roast_text TEXT NOT NULL,
  verdict TEXT,           -- 'Main Character Delusion', 'Certified Grinder', etc.
  stats_snapshot JSONB,   -- { calories: 1800, steps: 3200, water: 4 }
  roast_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, roast_date)
);

CREATE INDEX idx_roasts_user_date ON roasts(user_id, roast_date DESC);
ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roasts"
  ON roasts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own roasts"
  ON roasts FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### challenges

```sql
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('steps', 'calories', 'water', 'workout_minutes')),
  target_value REAL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  winner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_challenges_status ON challenges(status, ends_at);
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- MULTI-USER RLS: participants can read challenges they are part of
CREATE POLICY "Participants can view their challenges"
  ON challenges FOR SELECT
  USING (
    id IN (SELECT challenge_id FROM challenge_participants WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can create challenges"
  ON challenges FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their challenges"
  ON challenges FOR UPDATE USING (auth.uid() = creator_id);
```

### challenge_participants

```sql
CREATE TABLE challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_value REAL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

-- MULTI-USER RLS: users can see all participants in challenges they belong to
CREATE POLICY "Users can view participants in their challenges"
  ON challenge_participants FOR SELECT
  USING (
    challenge_id IN (
      SELECT challenge_id FROM challenge_participants WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own participation"
  ON challenge_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own participation"
  ON challenge_participants FOR UPDATE USING (auth.uid() = user_id);
```

Enable Supabase Realtime replication on this table for live leaderboard updates.

### friendships

```sql
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can create friendships"
  ON friendships FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update friendships they receive"
  ON friendships FOR UPDATE
  USING (auth.uid() = addressee_id);
```

## New Zustand Store Interfaces

### useAuraStore.ts

```typescript
interface AuraState {
  score: number | null;
  subScores: { sleep: number; nutrition: number; movement: number; hydration: number } | null;
  label: string | null;           // 'THRIVING', 'RESTING', etc.
  history: AuraScore[];           // Last 7-30 days
  isLoading: boolean;
  isCalculating: boolean;

  calculateToday: (userId: string) => Promise<void>;
  loadHistory: (userId: string, days?: number) => Promise<void>;
}
```

### useRoastStore.ts

```typescript
interface RoastState {
  todayRoast: Roast | null;
  history: Roast[];
  isLoading: boolean;
  isGenerating: boolean;

  generateRoast: (userId: string) => Promise<void>;
  loadTodayRoast: (userId: string) => Promise<void>;
  loadHistory: (userId: string) => Promise<void>;
}
```

### useBetsStore.ts

```typescript
interface BetsState {
  activeBets: Challenge[];
  pendingInvites: Challenge[];
  friends: Friend[];
  isLoading: boolean;

  loadActiveBets: (userId: string) => Promise<void>;
  loadPendingInvites: (userId: string) => Promise<void>;
  createChallenge: (userId: string, data: CreateChallengeInput) => Promise<string>;
  acceptChallenge: (challengeId: string, userId: string) => Promise<void>;
  updateProgress: (challengeId: string, userId: string, value: number) => Promise<void>;
  subscribeToChallenge: (challengeId: string) => () => void;  // returns cleanup fn
  loadFriends: (userId: string) => Promise<void>;
  addFriend: (userId: string, friendCode: string) => Promise<void>;
}
```

## Patterns to Follow

### Pattern 1: Engine + Store Separation (Existing Pattern)

The app separates computation (`lib/`) from state management (`store/`). New features must follow this.

**What:** Business logic in `lib/[feature]Engine.ts`, state in `store/use[Feature]Store.ts`.
**Why:** Engines are testable pure functions. Stores handle async state and Supabase I/O.

### Pattern 2: Shareable Card Capture

**What:** Render a card component, capture as image, share via native sheet.
**When:** Any "Share" button (Aura, Roast).
**Example:**
```typescript
const cardRef = useRef<View>(null);

const handleShare = async () => {
  const uri = await captureRef(cardRef, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
  await Sharing.shareAsync(uri);
};

// Render card off-screen but in view hierarchy
<View ref={cardRef} collapsable={false} style={{ position: 'absolute', left: -9999 }}>
  <AuraShareCard score={score} stats={subScores} date={today} />
</View>
```

### Pattern 3: Supabase Realtime Subscription with Cleanup

**What:** Subscribe to table changes, clean up on unmount.
**When:** Beast Bets live leaderboard.
**Example:**
```typescript
useEffect(() => {
  const channel = supabase.channel(`bet:${betId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'challenge_participants',
      filter: `challenge_id=eq.${betId}`
    }, (payload) => {
      useBetsStore.getState().handleParticipantUpdate(payload.new);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [betId]);
```

### Pattern 4: Animated SVG with Reanimated (Orb)

**What:** Drive SVG properties from Reanimated shared values on UI thread.
**When:** Aura orb breathing/glow animation.
**Example:**
```typescript
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const scale = useSharedValue(1);

useEffect(() => {
  scale.value = withRepeat(withTiming(1.15, { duration: 2000 }), -1, true);
}, []);

const animatedProps = useAnimatedProps(() => ({
  r: 80 * scale.value,
  opacity: 0.3 + (scale.value - 1) * 2,
}));

<Svg><AnimatedCircle animatedProps={animatedProps} cx="150" cy="150" fill={orbColor} /></Svg>
```

### Pattern 5: Theme-Aware Screens (Existing Pattern)

Every screen reads theme from `useThemeStore` and uses `THEMES[mode]` or a local color helper function (see `dashboard.tsx` `getT()` pattern).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Single Monolithic Store
**What:** One store for all three features.
**Why bad:** Independent lifecycles, unnecessary re-renders.
**Instead:** Three separate stores matching existing pattern.

### Anti-Pattern 2: Inline Score Calculation in Component
**What:** Computing Aura Score inside the screen component.
**Why bad:** Hard to test, impossible to reuse (roast also needs the score).
**Instead:** Pure function `calculateAuraScore(stats)` in `lib/auraEngine.ts`.

### Anti-Pattern 3: Polling for Bet Updates
**What:** Using `setInterval` to fetch bet progress.
**Why bad:** Battery drain, delayed updates, unnecessary network traffic.
**Instead:** Supabase Realtime subscription (push-based).

### Anti-Pattern 4: Direct Supabase Calls in Screen Components
**What:** Calling `supabase.from(...)` directly in `aura.tsx`.
**Why bad:** Breaks existing pattern where stores are the data access layer.
**Instead:** All Supabase calls go through stores or engine modules.

### Anti-Pattern 5: Pressable Function Style for Row Layouts
**What:** `<Pressable style={({ pressed }) => ({ flexDirection: 'row' })}>`.
**Why bad:** Known bug -- `flexDirection: "row"` doesn't apply to children.
**Instead:** Inner `<View style={{ flexDirection: "row", alignItems: "center" }}>`.

## Suggested Build Order

### Phase 1: Aura Score (Build First)

**Rationale:** Zero new infrastructure. Reads from existing `food_logs`, steps, and water data. One new table, one new store, one new engine, one new screen. Validates the "new feature slice" integration pattern.

**Dependencies:** None beyond existing tracking data.

**Delivers:** `aura_scores` table, `useAuraStore`, `auraEngine.ts`, `aura.tsx`, `AuraOrb.tsx`, `AuraShareCard.tsx`, sidebar nav entry.

### Phase 2: AI Roast (Build Second)

**Rationale:** Reuses GPT-4o integration pattern from `chatEngine.ts`. Same data sources as Aura Score. Can reference aura score in roasts if Phase 1 is complete.

**Dependencies:** Tracking data (same as Aura). Benefits from Aura being complete.

**Delivers:** `roasts` table, `useRoastStore`, `roastEngine.ts`, `roast.tsx`, `RoastBubble.tsx`, `RoastShareCard.tsx`, sidebar nav entry.

### Phase 3: Beast Bets (Build Last)

**Rationale:** Most complex feature. Requires: (1) friend system (new concept), (2) Supabase real-time subscriptions (new pattern), (3) multi-user RLS policies (new RLS pattern), (4) challenge lifecycle state machine. Build after simpler features validate integration.

**Dependencies:** `friendships` table before challenges. Real-time replication enabled on `challenge_participants`.

**Delivers:** `challenges`, `challenge_participants`, `friendships` tables, `useBetsStore`, `betsEngine.ts`, `bets.tsx`, `create-bet.tsx`, `BetCard.tsx`, `PlayerRow.tsx`, sidebar nav entry.

## File Creation Summary

New files to create:

```
app/(main)/aura.tsx              -- Aura Score screen
app/(main)/roast.tsx             -- AI Roast screen
app/(main)/bets.tsx              -- Beast Bets screen
app/(main)/create-bet.tsx        -- Challenge creation screen

lib/auraEngine.ts                -- Score calculation logic (pure function)
lib/roastEngine.ts               -- GPT-4o roast generation
lib/betsEngine.ts                -- Challenge CRUD + progress + winner logic

store/useAuraStore.ts            -- Aura state management
store/useRoastStore.ts           -- Roast state management
store/useBetsStore.ts            -- Bets + friends state + real-time subscriptions

components/AuraOrb.tsx           -- Animated SVG orb visualization
components/AuraShareCard.tsx     -- Shareable aura card (captured by view-shot)
components/RoastBubble.tsx       -- Roast text display
components/RoastShareCard.tsx    -- Shareable roast card (captured by view-shot)
components/BetCard.tsx           -- Active bet display with countdown
components/PlayerRow.tsx         -- Leaderboard player row with progress bar
```

Existing files to modify:

```
components/ChatSidebar.tsx       -- Add nav entries for 3 new screens
lib/types.ts                     -- Add AuraScore, Roast, Challenge, Friend, Participant interfaces
supabase_schema.sql              -- Add 5 new table definitions
```

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Aura calculation | Client-side, instant | Client-side, instant | Client-side, instant |
| Roast generation | Direct GPT-4o call from client | Edge function with rate limiting | Queue + batch generation |
| Beast Bets real-time | Single channel per bet | Supabase handles scaling | Monitor connection limits, pool channels |
| Share card generation | Client-side capture | Client-side capture | Client-side capture (no server load) |
| Challenge winner determination | Client-side on timer expiry | Edge function + pg_cron for reliability | Server-side only |

## Sources

- Existing codebase analysis: all stores, engines, screens, schema, layouts, components
- [Expo captureRef docs](https://docs.expo.dev/versions/latest/sdk/captureRef/)
- [Supabase Realtime docs](https://supabase.com/docs/guides/realtime)
- [React Native Reanimated useAnimatedProps](https://docs.swmansion.com/react-native-reanimated/)
- Supabase RLS documentation for multi-user policies
