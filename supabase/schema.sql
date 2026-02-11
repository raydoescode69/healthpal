-- ============================================
-- HealthPal Database Schema
-- ============================================

-- 1. Profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  age integer,
  weight_kg numeric,
  height_cm numeric,
  goal text,
  diet_type text,
  allergies text,
  language_style text,
  timezone text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. Memories
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  memory_text text not null,
  category text,
  importance integer check (importance >= 1 and importance <= 10),
  created_at timestamptz default now() not null
);

alter table public.memories enable row level security;

create policy "Users can view their own memories"
  on public.memories for select
  using (auth.uid() = user_id);

create policy "Users can insert their own memories"
  on public.memories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own memories"
  on public.memories for update
  using (auth.uid() = user_id);

create policy "Users can delete their own memories"
  on public.memories for delete
  using (auth.uid() = user_id);

-- 3. Conversations
create table public.conversations (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null default 'New Chat',
  created_at timestamptz default now() not null
);

create index idx_conversations_user on public.conversations (user_id, created_at desc);

alter table public.conversations enable row level security;

create policy "Users can view their own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own conversations"
  on public.conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);

-- 4. Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role text not null,
  content text not null,
  conversation_id text references public.conversations(id) on delete cascade,
  session_id text,
  created_at timestamptz default now() not null
);

create index idx_messages_conversation on public.messages (conversation_id, created_at);
create index idx_messages_session on public.messages (user_id, session_id, created_at);

alter table public.messages enable row level security;

create policy "Users can view their own messages"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "Users can insert their own messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own messages"
  on public.messages for delete
  using (auth.uid() = user_id);

-- 5. Food Logs
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  food_name text not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  meal_type text,
  image_url text,
  logged_at timestamptz default now() not null
);

alter table public.food_logs enable row level security;

create policy "Users can view their own food logs"
  on public.food_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own food logs"
  on public.food_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own food logs"
  on public.food_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own food logs"
  on public.food_logs for delete
  using (auth.uid() = user_id);

-- 6. Follow-ups
create table public.followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  message text not null,
  send_at timestamptz not null,
  sent boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.followups enable row level security;

create policy "Users can view their own followups"
  on public.followups for select
  using (auth.uid() = user_id);

create policy "Users can insert their own followups"
  on public.followups for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own followups"
  on public.followups for update
  using (auth.uid() = user_id);

create policy "Users can delete their own followups"
  on public.followups for delete
  using (auth.uid() = user_id);

-- 7. Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  status text not null,
  trial_ends_at timestamptz,
  next_billing_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own subscription"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own subscription"
  on public.subscriptions for update
  using (auth.uid() = user_id);

-- ============================================
-- Migration: Chat System Rewrite
-- ============================================

-- Add message_type and metadata to messages
alter table public.messages
  add column if not exists message_type text default 'text',
  add column if not exists metadata jsonb;

-- 8. User Profile Data (extracted by AI from conversations)
create table if not exists public.user_profile_data (
  user_id uuid primary key references auth.users on delete cascade,
  name text,
  age integer,
  weight_kg float,
  height_cm float,
  goal text,
  diet_type text,
  allergies text,
  occupation text,
  updated_at timestamptz default now() not null
);

alter table public.user_profile_data enable row level security;

create policy "Users can view their own profile data"
  on public.user_profile_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile data"
  on public.user_profile_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile data"
  on public.user_profile_data for update
  using (auth.uid() = user_id);
