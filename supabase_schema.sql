-- =====================================================================
-- HealthPal — Complete Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- =====================================================================

-- 1. PROFILES (created during onboarding)
-- Stores basic user profile from onboarding flow.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  weight REAL,          -- in kg
  height REAL,          -- in cm
  goal TEXT,            -- lose_weight | gain_muscle | eat_healthy | manage_stress
  diet_type TEXT,       -- veg | non_veg | vegan | keto | no_preference
  allergies TEXT,       -- comma-separated allergy list (optional)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);


-- 2. USER_PROFILE_DATA (auto-extracted from chat by GPT)
-- Background extraction stores structured data the AI picks up from conversations.
CREATE TABLE IF NOT EXISTS user_profile_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  age INTEGER,
  weight_kg REAL,
  height_cm REAL,
  goal TEXT,
  diet_type TEXT,
  allergies TEXT,
  occupation TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)
);

ALTER TABLE user_profile_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile data"
  ON user_profile_data FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile data"
  ON user_profile_data FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile data"
  ON user_profile_data FOR UPDATE USING (auth.uid() = user_id);


-- 3. CONVERSATIONS
-- Each chat session / thread.
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New conversation',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversations_user ON conversations(user_id, created_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE USING (auth.uid() = user_id);


-- 4. MESSAGES
-- Individual chat messages within conversations.
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 5. PINNED_MESSAGES
-- Messages or diet cards pinned by users within a conversation.
CREATE TABLE IF NOT EXISTS pinned_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,         -- UUID for messages, "diet-{timestamp}" for diet cards
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_type TEXT DEFAULT 'message' CHECK (pin_type IN ('message', 'diet_card')),
  pinned_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(conversation_id, message_id)
);

CREATE INDEX idx_pinned_conversation ON pinned_messages(conversation_id, user_id);

ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pins"
  ON pinned_messages FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pins"
  ON pinned_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pins"
  ON pinned_messages FOR DELETE USING (auth.uid() = user_id);


-- 6. FOOD_LOGS
-- Tracked food entries from the food logging feature.
CREATE TABLE IF NOT EXISTS food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  calories REAL NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0,
  carbs_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  meal_type TEXT,                   -- breakfast | lunch | dinner | snack
  image_url TEXT,
  logged_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_food_logs_user_date ON food_logs(user_id, logged_at DESC);

ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own food logs"
  ON food_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food logs"
  ON food_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food logs"
  ON food_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own food logs"
  ON food_logs FOR DELETE USING (auth.uid() = user_id);


-- 7. MEMORIES
-- AI-extracted user context/memories for personalization across sessions.
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_text TEXT NOT NULL,
  importance INTEGER DEFAULT 1 CHECK (importance >= 1 AND importance <= 10),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_memories_user ON memories(user_id, importance DESC);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories"
  ON memories FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
  ON memories FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
  ON memories FOR DELETE USING (auth.uid() = user_id);
