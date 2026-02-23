-- ============================================
-- Push Notifications + Follow-up Messages
-- ============================================

-- 1. Push Tokens table
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push tokens"
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens"
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
  ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens"
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Alter followups table — add conversation tracking
ALTER TABLE public.followups
  ADD COLUMN IF NOT EXISTS conversation_id TEXT REFERENCES public.conversations(id),
  ADD COLUMN IF NOT EXISTS followup_type TEXT DEFAULT 'inactivity';

-- Index for efficient rate-limit queries (user + sent status + time)
CREATE INDEX IF NOT EXISTS idx_followups_user_sent
  ON public.followups(user_id, sent, created_at);

-- 3. Service role policy for Edge Functions (bypass RLS)
-- The Edge Function uses the service_role key which bypasses RLS,
-- so no additional policies are needed for server-side inserts.

-- 4. Allow service role to insert messages for followups
-- (service_role already bypasses RLS, but add an explicit policy for clarity)
CREATE POLICY "Service can insert followup messages"
  ON public.messages FOR INSERT
  WITH CHECK (true);
