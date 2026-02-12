# HealthPal

AI-powered health & nutrition companion built with React Native + Expo. Chat with "Pal" — a friendly AI buddy who helps you track food, manage diet plans, and stay on top of your health goals.

## Features

- **AI Chat** — Conversational health assistant powered by GPT-4o with a WhatsApp-style personality
- **Food Tracking (Text)** — Type what you ate, AI estimates calories & macros, saved to database
- **Food Tracking (Camera/Gallery)** — Snap or pick a food photo, GPT-4o Vision analyzes it instantly
- **Nutrition Dashboard** — Daily calorie progress, macro breakdown (protein/carbs/fat), full food log history
- **7-Day Diet Plans** — AI-generated personalized meal plans based on your profile (goal, diet type, allergies)
- **Conversation History** — All chats persisted in Supabase with sidebar navigation
- **Message Pinning** — Long-press to pin important messages
- **User Onboarding** — Step-by-step profile setup (name, age, weight, height, goal, diet preference)
- **Water Tracking** — Quick-log daily water intake

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54 + React Native 0.81 |
| Navigation | Expo Router v6 (file-based) |
| Styling | NativeWind v4 (Tailwind CSS) |
| State | Zustand (persisted with AsyncStorage) |
| Backend | Supabase (Auth, Postgres, RLS) |
| AI | OpenAI GPT-4o (chat + Vision) |
| Fonts | Sora + DM Sans (Google Fonts) |
| Animations | React Native Reanimated v4 |

## Project Structure

```
healthpal/
├── app/
│   ├── _layout.tsx              # Root layout — auth guard, fonts, session listener
│   ├── (auth)/
│   │   ├── _layout.tsx          # Auth stack layout
│   │   ├── index.tsx            # Login / Sign up screen
│   │   └── onboarding.tsx       # 4-step profile setup
│   └── (main)/
│       ├── _layout.tsx          # Main stack layout (headerless)
│       ├── chat.tsx             # Core chat screen with AI messaging
│       └── dashboard.tsx        # Daily nutrition dashboard
├── components/
│   ├── ChatSidebar.tsx          # Slide-out conversation sidebar + dashboard nav
│   ├── DietPlanCard.tsx         # 7-day diet plan display with day tabs
│   └── FoodLogModal.tsx         # Modal: Type / Camera / Gallery food logging
├── lib/
│   ├── chatEngine.ts            # OpenAI integration, prompt building, response parsing
│   ├── foodAnalyzer.ts          # Food analysis via GPT-4o (text + Vision)
│   ├── supabase.ts              # Supabase client with SecureStore auth
│   └── types.ts                 # TypeScript interfaces and constants
├── store/
│   ├── useAuthStore.ts          # Auth session + user profile (persisted)
│   ├── useThemeStore.ts         # Light/dark mode preference
│   └── useTrackingStore.ts      # Food logs (Supabase-synced) + water tracking
├── supabase/
│   └── schema.sql               # Complete database schema with RLS policies
└── tailwind.config.js           # NativeWind config with custom brand colors
```

## Setup

### Prerequisites

- Node.js 18+
- Expo Go app on your phone (or an emulator)
- Supabase project
- OpenAI API key with GPT-4o access

### 1. Clone & install

```bash
git clone https://github.com/<your-username>/healthpal.git
cd healthpal
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required due to React 19.1 peer dependency conflicts with some Expo packages.

### 2. Environment variables

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Where to get it |
|----------|----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → `anon` `public` key |
| `EXPO_PUBLIC_OPENAI_API_KEY` | [OpenAI API Keys](https://platform.openai.com/api-keys) |

### 3. Database setup

Run the schema in your Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**

This creates all required tables with Row Level Security policies:
- `profiles` — User profiles from onboarding
- `user_profile_data` — AI-extracted profile data from conversations
- `conversations` — Chat conversation metadata
- `messages` — Chat messages (user + assistant)
- `food_logs` — Tracked food entries with calories & macros
- `memories` — AI-generated user memories for context
- `followups` — Scheduled follow-up messages
- `subscriptions` — Subscription status

Also create the `pinned_messages` table:

```sql
create table if not exists public.pinned_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.conversations(id) on delete cascade,
  message_id uuid not null,
  user_id uuid not null references auth.users on delete cascade,
  pinned_at timestamptz default now() not null,
  unique(conversation_id, message_id)
);

alter table public.pinned_messages enable row level security;

create policy "Users can manage their own pins"
  on public.pinned_messages for all
  using (auth.uid() = user_id);
```

### 4. Run

```bash
npx expo start -c
```

Scan the QR code with Expo Go on your phone.

## How It Works

### Chat Engine (`lib/chatEngine.ts`)

The core AI system builds a rich context for every message:
- Loads user profile, recent messages, and AI memories from Supabase
- Constructs a system prompt with personality (24yo Indian fitness friend on WhatsApp)
- Calculates calorie/macro targets using Mifflin-St Jeor formula based on user profile
- Detects diet plan requests and enforces structured JSON output
- Parses responses into text bubbles (separated by `|||`) and optional diet plan JSON
- Extracts profile data from user messages in the background

### Food Analysis (`lib/foodAnalyzer.ts`)

Two functions for nutritional analysis:
- **`analyzeFoodFromText(description)`** — Sends food description to GPT-4o, returns structured JSON with food name, calories, protein, carbs, fat, and meal type
- **`analyzeFoodFromImage(base64)`** — Sends photo to GPT-4o Vision using the image_url content format, same structured output
- Both infer meal type from time of day as fallback (breakfast < 11am, lunch 11-3, snack 3-6, dinner 6+)

### Food Tracking Store (`store/useTrackingStore.ts`)

Zustand store synced with Supabase `food_logs` table:
- `loadTodayLogs(userId)` — Fetches today's food logs from database
- `saveFoodLog(userId, result, imageUrl?)` — Inserts to Supabase + updates local state
- `deleteFoodLog(logId)` — Removes from database and local state
- `getDailySummary()` — Sums calories/protein/carbs/fat across today's logs

### Chat Screen (`app/(main)/chat.tsx`)

The main screen handles:
- Conversation loading/creation with Supabase persistence
- Sequential typewriter effect for bot response bubbles
- Bubble queue system for multi-bubble responses
- Diet plan card rendering between messages
- Quick actions: Log Food, My Plan, Motivate me, Water intake
- "Log Food" opens the `FoodLogModal` with 3 options (type/camera/gallery)
- Text food input → `analyzeFoodFromText()` → `saveFoodLog()` → confirmation in chat
- Image food input → `analyzeFoodFromImage()` → `saveFoodLog()` → confirmation in chat
- Message pinning with long-press (persisted to Supabase)

### Dashboard (`app/(main)/dashboard.tsx`)

Full-screen nutrition overview accessible from the sidebar:
- Calorie progress bar with daily target (calculated from profile)
- Three macro cards: Protein (blue), Carbs (orange), Fat (red) with progress bars
- Scrollable food log list with meal type emoji, food name, time, and macro pills
- Empty state when no food is logged yet
- All data loaded from Supabase on mount

### Authentication Flow

1. `app/_layout.tsx` listens to Supabase auth state changes
2. No session → redirects to `/(auth)` (login screen)
3. After login → checks for existing profile → redirects to onboarding if needed
4. After onboarding → redirects to `/(main)/chat`
5. Session persisted via `expo-secure-store`

### Sidebar (`components/ChatSidebar.tsx`)

Animated slide-out drawer with:
- User avatar and profile badges (goal + diet type)
- Dashboard navigation button
- New Chat button
- Conversation history grouped by date (Today, Yesterday, Last 7 days, Older)
- Sign Out button

## Key Design Decisions

- **Dual ID tracking for conversations** — `conversationIdRef` (ref for async operations) + state for re-renders, prevents race conditions
- **Bubble queue system** — Bot responses split by `|||` are queued and displayed one at a time with typewriter effect
- **Diet plan deduplication** — `dietPlanShownRef` + AsyncStorage flag prevents duplicate diet plan cards per conversation
- **Supabase RLS** — All tables use Row Level Security so users can only access their own data
- **Background profile extraction** — Every user message is analyzed by GPT-4o-mini to silently extract profile data (weight, goal, etc.)
