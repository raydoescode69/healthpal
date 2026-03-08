import { Share } from "react-native";
import { supabase } from "./supabase";
import type { Challenge, ChallengeParticipant } from "./types";

const AVATAR_EMOJIS = ["🐉", "🦁", "🐺", "🦅", "🐻", "🦊", "🐯", "🦈"];

export type EnrichedParticipant = ChallengeParticipant & {
  display_name?: string;
  avatar_emoji?: string;
};

export async function createChallenge(
  userId: string,
  data: { title: string; metric: Challenge["metric"]; target: number }
): Promise<Challenge> {
  const now = new Date();
  const expires = new Date(now);
  expires.setUTCHours(23, 59, 59, 0);
  if (expires.getTime() <= now.getTime()) {
    expires.setUTCDate(expires.getUTCDate() + 1);
  }

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({
      creator_id: userId,
      title: data.title,
      metric: data.metric,
      target: data.target,
      status: "active",
      expires_at: expires.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from("challenge_participants")
    .insert({ challenge_id: challenge.id, user_id: userId, current_value: 0 });

  return challenge as Challenge;
}

export async function joinChallenge(
  userId: string,
  challengeId: string
): Promise<ChallengeParticipant> {
  const { data: ch, error: chErr } = await supabase
    .from("challenges")
    .select("status")
    .eq("id", challengeId)
    .single();

  if (chErr) throw chErr;
  if (ch?.status !== "active") throw new Error("Challenge is no longer active");

  const { data, error } = await supabase
    .from("challenge_participants")
    .upsert(
      { challenge_id: challengeId, user_id: userId, current_value: 0 },
      { onConflict: "challenge_id,user_id", ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) {
    const { data: existing } = await supabase
      .from("challenge_participants")
      .select("*")
      .eq("challenge_id", challengeId)
      .eq("user_id", userId)
      .single();
    if (existing) return existing as ChallengeParticipant;
    throw error;
  }

  return data as ChallengeParticipant;
}

export function getInviteLink(challengeId: string): string {
  return `healthpal://bets/join/${challengeId}`;
}

export async function shareInvite(
  challengeId: string,
  challengeTitle: string
): Promise<void> {
  try {
    await Share.share({
      message: `Join my Beast Bet: "${challengeTitle}"! Can you beat me? ${getInviteLink(challengeId)}`,
    });
  } catch {
    console.warn("Share not available");
  }
}

export async function loadUserChallenges(
  userId: string
): Promise<Challenge[]> {
  const { data: created } = await supabase
    .from("challenges")
    .select("*")
    .eq("creator_id", userId);

  const { data: participated } = await supabase
    .from("challenge_participants")
    .select("challenge_id")
    .eq("user_id", userId);

  const ids = (participated || []).map(
    (p: { challenge_id: string }) => p.challenge_id
  );

  let participatedChallenges: Challenge[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from("challenges")
      .select("*")
      .in("id", ids);
    participatedChallenges = (data as Challenge[]) || [];
  }

  const all = [...(created || []), ...participatedChallenges];
  const seen = new Set<string>();
  return all.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }) as Challenge[];
}

export async function loadChallengeDetail(challengeId: string): Promise<{
  challenge: Challenge;
  participants: EnrichedParticipant[];
}> {
  const { data: challenge, error: e1 } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .single();

  if (e1) throw e1;

  const { data: parts, error: e2 } = await supabase
    .from("challenge_participants")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("current_value", { ascending: false });

  if (e2) throw e2;

  const enriched: EnrichedParticipant[] = await Promise.all(
    (parts || []).map(async (p: ChallengeParticipant, i: number) => {
      let display_name = `Player ${i + 1}`;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", p.user_id)
          .single();
        if (profile?.name) display_name = profile.name;
      } catch {}
      return {
        ...p,
        display_name,
        avatar_emoji: AVATAR_EMOJIS[i % AVATAR_EMOJIS.length],
      };
    })
  );

  return { challenge: challenge as Challenge, participants: enriched };
}

export function subscribeToChallenge(
  challengeId: string,
  onUpdate: (participants: EnrichedParticipant[]) => void
): () => void {
  const channel = supabase
    .channel(`challenge-${challengeId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "challenge_participants",
        filter: `challenge_id=eq.${challengeId}`,
      },
      async () => {
        const detail = await loadChallengeDetail(challengeId);
        onUpdate(detail.participants);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function resolveExpiredChallenges(
  userId: string
): Promise<void> {
  const { data } = await supabase
    .from("challenges")
    .select("id")
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString());

  if (!data || data.length === 0) return;

  for (const ch of data) {
    await supabase
      .from("challenges")
      .update({ status: "completed" })
      .eq("id", ch.id);
  }
}

export async function updateParticipantProgress(
  participantId: string,
  newValue: number
): Promise<void> {
  const { error } = await supabase
    .from("challenge_participants")
    .update({ current_value: newValue })
    .eq("id", participantId);

  if (error) throw error;
}
