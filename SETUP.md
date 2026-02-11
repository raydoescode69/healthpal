# HealthPal - Setup Guide

## Prerequisites

- Node.js 18+
- npm
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)
- Supabase account (free tier works)
- OpenAI API key

---

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Environment Variables

Create a `.env` file in the project root with these variables:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_google_web_client_id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_google_ios_client_id
```

### Where to get these:

| Variable | Source |
|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → `anon` `public` key |
| `EXPO_PUBLIC_OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) → Create new key |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Cloud Console → OAuth 2.0 credentials (for Google Sign-In) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google Cloud Console → OAuth 2.0 credentials (iOS client) |

> **Note:** Google Sign-In credentials are optional if you're only using email/password auth.

---

## 3. Supabase Database Setup

1. Go to your Supabase Dashboard → **SQL Editor**
2. Copy the entire contents of `supabase/schema.sql`
3. Paste and run it in the SQL Editor
4. This creates all required tables with Row Level Security (RLS) policies:
   - `profiles` — user onboarding data
   - `memories` — AI-extracted conversation memories
   - `conversations` — chat conversation list
   - `messages` — individual chat messages
   - `food_logs` — food tracking
   - `followups` — scheduled follow-ups
   - `subscriptions` — user subscriptions
   - `user_profile_data` — AI-extracted profile data from conversations

### Supabase Auth Setup

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider (enabled by default)
3. (Optional) Enable **Google** provider with your OAuth credentials

---

## 4. Run the App

```bash
npx expo start
```

Then scan the QR code with Expo Go on your phone.

### Other run commands:

```bash
# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android

# Clear cache and start
npx expo start -c
```

---

## Project Structure

```
healthpal/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   │   ├── chat.tsx       # Main chat screen
│   │   ├── profile.tsx    # User profile
│   │   └── _layout.tsx    # Tab layout config
│   └── ...
├── components/            # Reusable components
│   ├── ChatSidebar.tsx    # Chat history sidebar
│   └── DietPlanCard.tsx   # Diet plan display card
├── lib/                   # Core logic
│   ├── chatEngine.ts      # AI chat engine (OpenAI integration)
│   ├── supabase.ts        # Supabase client
│   └── types.ts           # TypeScript types
├── store/                 # State management (Zustand)
│   ├── useAuthStore.ts    # Auth state
│   └── useThemeStore.ts   # Theme state
├── supabase/
│   └── schema.sql         # Database schema (run this in Supabase SQL Editor)
└── .env                   # Environment variables (create this yourself)
```

---

## Tech Stack

- **Framework:** React Native + Expo (SDK 54)
- **Navigation:** Expo Router
- **Styling:** NativeWind (Tailwind CSS for RN)
- **Backend:** Supabase (Postgres + Auth + RLS)
- **AI:** OpenAI GPT-4o (chat) + GPT-4o-mini (profile extraction)
- **State:** Zustand
- **Animations:** Reanimated

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "OpenAI API key not configured" | Check `.env` file exists and has `EXPO_PUBLIC_OPENAI_API_KEY` |
| Conversations not showing in sidebar | Check Supabase RLS policies are created (run schema.sql) |
| Blank screen on launch | Run `npx expo start -c` to clear cache |
| Type errors | Run `npx tsc --noEmit` to check, then `npm install` |
