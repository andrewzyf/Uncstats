import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(url && anon);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anon)
  : null;

export interface LeaderboardRow {
  user_id: string;
  username: string;
  ig_handle: string | null;
  device_os: "android" | "ios";
  unc_tier: string;
  squad_id: string | null;
  school_id: string | null;
  reels_scrolled: number;
  reels_liked: number;
  comments_read_or_posted: number;
  shares_dmed: number;
  active_scroll_seconds: number;
  fastest_skip_ms: number;
  longest_rot_streak_mins: number;
  unc_age: number;
  updated_at: string | null;
}

export const DEMO_LEADERBOARD: LeaderboardRow[] = [
  {
    user_id: "1",
    username: "balcony_gary",
    ig_handle: "balcony_gary",
    device_os: "android",
    unc_tier: "Senior Facebook Marketplace Lowballer",
    squad_id: "global",
    school_id: null,
    reels_scrolled: 842,
    reels_liked: 61,
    comments_read_or_posted: 14,
    shares_dmed: 22,
    active_scroll_seconds: 4210,
    fastest_skip_ms: 280,
    longest_rot_streak_mins: 118,
    unc_age: 74,
    updated_at: new Date().toISOString(),
  },
  {
    user_id: "2",
    username: "couch_custodian_88",
    ig_handle: "couch_custodian_88",
    device_os: "android",
    unc_tier: "Couch Custodian",
    squad_id: "state-u",
    school_id: "state-u",
    reels_scrolled: 376,
    reels_liked: 29,
    comments_read_or_posted: 9,
    shares_dmed: 11,
    active_scroll_seconds: 1980,
    fastest_skip_ms: 410,
    longest_rot_streak_mins: 54,
    unc_age: 61.5,
    updated_at: new Date().toISOString(),
  },
  {
    user_id: "3",
    username: "part_time_nephew",
    ig_handle: "part_time_nephew",
    device_os: "ios",
    unc_tier: "Part-Time Nephew",
    squad_id: "state-u",
    school_id: "state-u",
    reels_scrolled: 148,
    reels_liked: 12,
    comments_read_or_posted: 3,
    shares_dmed: 5,
    active_scroll_seconds: 820,
    fastest_skip_ms: 0,
    longest_rot_streak_mins: 28,
    unc_age: 36.8,
    updated_at: new Date().toISOString(),
  },
  {
    user_id: "4",
    username: "still_employed_tmp",
    ig_handle: "still_employed_tmp",
    device_os: "ios",
    unc_tier: "Gainfully Employed",
    squad_id: "global",
    school_id: null,
    reels_scrolled: 27,
    reels_liked: 2,
    comments_read_or_posted: 0,
    shares_dmed: 1,
    active_scroll_seconds: 140,
    fastest_skip_ms: 0,
    longest_rot_streak_mins: 4,
    unc_age: 21.2,
    updated_at: new Date().toISOString(),
  },
];

export async function fetchLeaderboard(filter?: {
  squadId?: string;
  schoolId?: string;
}): Promise<{ rows: LeaderboardRow[]; live: boolean }> {
  if (!supabase) {
    let rows = DEMO_LEADERBOARD;
    if (filter?.schoolId) {
      rows = rows.filter((r) => r.school_id === filter.schoolId);
    } else if (filter?.squadId && filter.squadId !== "global") {
      rows = rows.filter((r) => r.squad_id === filter.squadId);
    }
    return { rows, live: false };
  }

  let query = supabase
    .from("leaderboard_today")
    .select("*")
    .order("reels_scrolled", { ascending: false })
    .limit(100);

  if (filter?.schoolId) query = query.eq("school_id", filter.schoolId);
  if (filter?.squadId) query = query.eq("squad_id", filter.squadId);

  const { data, error } = await query;
  if (error || !data?.length) {
    return { rows: DEMO_LEADERBOARD, live: false };
  }
  return { rows: data as LeaderboardRow[], live: true };
}

export async function fetchUserAudit(username: string): Promise<LeaderboardRow | null> {
  const needle = username.replace(/^@/, "").toLowerCase();
  if (!supabase) {
    return (
      DEMO_LEADERBOARD.find(
        (r) =>
          r.username.toLowerCase() === needle ||
          (r.ig_handle ?? "").toLowerCase() === needle
      ) ?? null
    );
  }

  const { data, error } = await supabase
    .from("leaderboard_today")
    .select("*")
    .or(`username.eq.${needle},ig_handle.eq.${needle}`)
    .maybeSingle();

  if (error || !data) {
    return (
      DEMO_LEADERBOARD.find(
        (r) =>
          r.username.toLowerCase() === needle ||
          (r.ig_handle ?? "").toLowerCase() === needle
      ) ?? null
    );
  }
  return data as LeaderboardRow;
}

export function subscribeLeaderboard(onChange: () => void): () => void {
  if (!supabase) {
    const id = window.setInterval(onChange, 30_000);
    return () => window.clearInterval(id);
  }
  const channel = supabase
    .channel("uncstats-leaderboard")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "daily_stats" },
      () => onChange()
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
