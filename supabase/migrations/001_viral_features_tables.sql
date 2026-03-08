-- ══════════════════════════════════════════════════════════════
-- Viral Features Tables: Aura Scores, Roasts, Challenges
-- ══════════════════════════════════════════════════════════════

-- ── aura_scores ──────────────────────────────────────────────
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

ALTER TABLE aura_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aura scores"
  ON aura_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own aura scores"
  ON aura_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own aura scores"
  ON aura_scores FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_aura_scores_user_id ON aura_scores(user_id);
CREATE INDEX idx_aura_scores_scored_at ON aura_scores(scored_at);

-- ── roasts ───────────────────────────────────────────────────
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

ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roasts"
  ON roasts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roasts"
  ON roasts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_roasts_user_id ON roasts(user_id);
CREATE INDEX idx_roasts_scored_at ON roasts(scored_at);

-- ── challenges ───────────────────────────────────────────────
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

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own or participating challenges"
  ON challenges FOR SELECT
  USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM challenge_participants
      WHERE challenge_participants.challenge_id = challenges.id
      AND challenge_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create challenges"
  ON challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own challenges"
  ON challenges FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE INDEX idx_challenges_creator_id ON challenges(creator_id);

-- ── challenge_participants ───────────────────────────────────
CREATE TABLE IF NOT EXISTS challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_value INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view challenge members"
  ON challenge_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenge_participants cp
      WHERE cp.challenge_id = challenge_participants.challenge_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join challenges"
  ON challenge_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON challenge_participants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_challenge_participants_challenge_id ON challenge_participants(challenge_id);
CREATE INDEX idx_challenge_participants_user_id ON challenge_participants(user_id);
