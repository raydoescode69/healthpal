-- ============================================================
-- Pinned Messages Table
-- ============================================================

create table if not exists public.pinned_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.conversations(id) on delete cascade,
  message_id      text not null,
  user_id         uuid not null references auth.users on delete cascade,
  pinned_at       timestamptz not null default now(),

  constraint uq_pinned_message unique (conversation_id, message_id)
);

-- Indexes
create index if not exists idx_pinned_messages_conversation
  on public.pinned_messages (conversation_id);

create index if not exists idx_pinned_messages_message
  on public.pinned_messages (conversation_id, message_id);

create index if not exists idx_pinned_messages_user
  on public.pinned_messages (user_id);

-- Row Level Security
alter table public.pinned_messages enable row level security;

create policy "Users can view their own pins"
  on public.pinned_messages for select
  using (user_id = auth.uid());

create policy "Users can insert their own pins"
  on public.pinned_messages for insert
  with check (user_id = auth.uid());

create policy "Users can delete their own pins"
  on public.pinned_messages for delete
  using (user_id = auth.uid());
