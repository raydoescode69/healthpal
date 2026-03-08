# Nyra (HealthPal) — Clone & Setup Guide

Complete guide to set up this project on a new machine.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | 18+ | https://nodejs.org |
| **npm** | Comes with Node | — |
| **Git** | Any recent | https://git-scm.com |
| **Expo Go** app | Latest | App Store / Play Store |
| **Supabase account** | Free tier works | https://supabase.com |
| **OpenAI API key** | GPT-4o access | https://platform.openai.com |

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/raydoescode69/healthpal.git
cd healthpal
```

---

## Step 2 — Install Dependencies

```bash
npm install --legacy-peer-deps
```

> **Why `--legacy-peer-deps`?** The project uses React 19.1 which has peer dependency conflicts with some Expo packages. This flag is required — without it, install will fail.

---

## Step 3 — Environment Variables

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# OpenAI (GPT-4o for chat + Vision for food image analysis)
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-openai-api-key
```

**Where to find these:**

- **Supabase URL & Anon Key:** Supabase Dashboard → Project Settings → API → Project URL and `anon` `public` key
- **OpenAI API Key:** OpenAI Platform → API Keys → Create new secret key

---

## Step 4 — Firebase Setup (Android Push Notifications)

1. Go to https://console.firebase.google.com
2. Create or select your project
3. Add an Android app with package name `com.healthpal.app`
4. Download `google-services.json`
5. Place it in the project root: `healthpal/google-services.json`

> This file is gitignored for security — each developer needs their own copy.

---

## Step 5 — Supabase Database Setup

You need to run SQL migrations in your **Supabase Dashboard → SQL Editor**.

### 5a. Core Tables

Run the contents of these files in order:

1. `supabase/migrations/20260212_create_pinned_messages.sql`
2. `supabase/migrations/20260219_push_notifications.sql`

### 5b. Viral Features Tables (Aura, Roasts, Beast Bets)

Run this **first** — creates the tables:

```sql
CREATE TABLE IF NOT EXISTS aura_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  sleep_score INTEGER CHECK (sleep_score >= 0 AND sleep_score <= 100),
  nutrition_score INTEGER CHECK (nutrition_score >= 0 AND nutrition_score <= 100),
  movement_score INTEGER CHECK (movement_score >= 0 AND movement_score <= 100),
  hydration_score INTEGER CHECK (hydration_score >= 0 AND hydration_score <= 100),
  label TEXT NOT NULL CHECK (label IN ('THRIVING', 'RESTING', 'PUSHING', 'STRUGGLING')),
  scored_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, scored_at)
);

CREATE TABLE IF NOT EXISTS roasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roast_text TEXT NOT NULL,
  verdict_title TEXT NOT NULL,
  verdict_emoji TEXT NOT NULL,
  calories INTEGER,
  steps INTEGER,
  sleep_hours REAL,
  scored_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, scored_at)
);

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('steps', 'calories', 'workout_minutes')),
  target INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_value INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);
```

Then run this **second** — adds security policies and indexes:

```sql
ALTER TABLE aura_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own aura scores" ON aura_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own aura scores" ON aura_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own aura scores" ON aura_scores FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_aura_scores_user_id ON aura_scores(user_id);
CREATE INDEX idx_aura_scores_scored_at ON aura_scores(scored_at);

ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roasts" ON roasts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own roasts" ON roasts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_roasts_user_id ON roasts(user_id);
CREATE INDEX idx_roasts_scored_at ON roasts(scored_at);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own or participating challenges" ON challenges FOR SELECT USING (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM challenge_participants WHERE challenge_participants.challenge_id = challenges.id AND challenge_participants.user_id = auth.uid()));
CREATE POLICY "Users can create challenges" ON challenges FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update own challenges" ON challenges FOR UPDATE USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE INDEX idx_challenges_creator_id ON challenges(creator_id);

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view challenge members" ON challenge_participants FOR SELECT USING (EXISTS (SELECT 1 FROM challenge_participants cp WHERE cp.challenge_id = challenge_participants.challenge_id AND cp.user_id = auth.uid()));
CREATE POLICY "Users can join challenges" ON challenge_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON challenge_participants FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_challenge_participants_challenge_id ON challenge_participants(challenge_id);
CREATE INDEX idx_challenge_participants_user_id ON challenge_participants(user_id);
```

---

## Step 6 — Enable Supabase Realtime

Required for the live Beast Bets leaderboard:

1. Supabase Dashboard → **Database → Replication**
2. Toggle **ON** for `challenge_participants`

---

## Step 7 — Supabase Auth Setup

1. Supabase Dashboard → **Authentication → Providers**
2. Enable **Google** sign-in
3. Add your Google OAuth client ID and secret
4. Enable **Email** sign-in if needed

---

## Step 8 — Run the App

```bash
npx expo start
```

Then:

- **Android:** Scan QR code with Expo Go app
- **iOS:** Scan QR code with Camera app (opens in Expo Go)
- **Emulator:** Press `a` for Android emulator or `i` for iOS simulator

---

## Project Structure

```
healthpal/
├── app/
│   ├── (auth)/              # Login, onboarding screens
│   ├── (main)/              # Main app screens
│   │   ├── chat.tsx         # AI chat with Nyra
│   │   ├── dashboard.tsx    # Health dashboard
│   │   ├── aura.tsx         # Aura Score screen
│   │   ├── roast.tsx        # Nyra Roasts You screen
│   │   ├── bets.tsx         # Beast Bets list
│   │   ├── bet-detail.tsx   # Bet detail + leaderboard
│   │   └── create-bet.tsx   # Create new bet
│   └── _layout.tsx          # Root layout
├── components/              # Reusable components
├── lib/                     # Services, utilities, API clients
├── store/                   # Zustand state stores
├── supabase/migrations/     # Database migrations (run manually)
└── .env.example             # Environment variable template
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54 + React Native 0.81 |
| Language | TypeScript 5.9 |
| Styling | NativeWind v4 (Tailwind CSS) |
| State | Zustand 5.0 |
| Backend | Supabase (Auth, Postgres, Realtime) |
| AI | OpenAI GPT-4o (chat, roasts, food analysis) |
| Animations | React Native Reanimated v4 |
| Sharing | expo-sharing + react-native-view-shot |

---

## Features

- **AI Health Chat** — Talk to Nyra about nutrition, fitness, and wellness
- **Food Camera** — Snap a photo of food for instant nutritional analysis
- **Health Dashboard** — Track calories, water, steps, and meals
- **Aura Score** — Daily health score with animated glowing orb
- **Nyra Roasts You** — Nightly AI-generated roast of your health choices with shareable cards
- **Beast Bets** — Challenge friends to 24hr health competitions with live leaderboard

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm install` fails | Use `npm install --legacy-peer-deps` |
| App can't connect to Supabase | Check `.env` values match your Supabase dashboard |
| Roast feature not working | Verify OpenAI API key has GPT-4o access |
| Bets leaderboard not updating live | Enable Realtime on `challenge_participants` (Step 6) |
| `google-services.json` missing | Download from Firebase Console (Step 4) |
| Build errors on Windows | Use Git Bash or WSL, not CMD/PowerShell |
| Camera not working in Expo Go | Camera requires a dev build (`npx expo run:android`) |
