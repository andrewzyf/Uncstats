import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

const env = (globalThis as { process?: { env?: Record<string, string> } }).process
  ?.env;

const supabaseUrl =
  (extra.supabaseUrl as string) ||
  env?.EXPO_PUBLIC_SUPABASE_URL ||
  "";
const supabaseAnonKey =
  (extra.supabaseAnonKey as string) ||
  env?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface LeaderboardRow {
  user_id: string;
  username: string;
  ig_handle: string | null;
  device_os: "android" | "ios";
  unc_tier: string;
  squad_id: string | null;
  reels_scrolled: number;
  longest_rot_streak_mins: number;
  unc_age: number;
  updated_at: string | null;
}

export async function fetchSquadLeaderboard(
  squadId?: string
): Promise<LeaderboardRow[]> {
  if (!supabase) return [];

  let query = supabase
    .from("leaderboard_today")
    .select("*")
    .order("reels_scrolled", { ascending: false })
    .limit(50);

  if (squadId) {
    query = query.eq("squad_id", squadId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

export async function fetchCalibrationReelsPerMinute(): Promise<number> {
  if (!supabase) return 10.8;
  const { data, error } = await supabase
    .from("global_calibration")
    .select("reels_per_minute")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return 10.8;
  return Number(data.reels_per_minute) || 10.8;
}

export async function upsertLocalDailyStats(payload: {
  userId: string;
  reelsScrolled: number;
  reelsLiked: number;
  commentsReadOrPosted: number;
  sharesDmed: number;
  activeScrollSeconds: number;
  fastestSkipMs: number;
  longestRotStreakMins: number;
}): Promise<void> {
  if (!supabase) return;
  await supabase.rpc("upsert_daily_stats", {
    p_user_id: payload.userId,
    p_reels_scrolled: payload.reelsScrolled,
    p_reels_liked: payload.reelsLiked,
    p_comments_read_or_posted: payload.commentsReadOrPosted,
    p_shares_dmed: payload.sharesDmed,
    p_active_scroll_seconds: payload.activeScrollSeconds,
    p_fastest_skip_ms: payload.fastestSkipMs,
    p_longest_rot_streak_mins: payload.longestRotStreakMins,
  });
}
