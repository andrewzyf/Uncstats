import { useEffect, useState } from "react";
import { LeaderboardTable } from "../components/LeaderboardTable";
import {
  fetchLeaderboard,
  subscribeLeaderboard,
  type LeaderboardRow,
} from "../lib/supabase";

type Board = "global" | "school";

export function HomePage() {
  const [board, setBoard] = useState<Board>("global");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const result = await fetchLeaderboard(
      board === "school" ? { schoolId: "state-u" } : undefined
    );
    setRows(result.rows);
    setLive(result.live);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    return subscribeLeaderboard(() => {
      void load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6">
      <header className="mb-10">
        <p className="text-[11px] tracking-[0.22em] text-warning">DEPT. OF UNEMPLOYMENT</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">UNCSTATS</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Live leaderboard of Instagram Reels doomscrolling. Ranked by volume and Unc Age.
          Clinical. Objective. Terminal.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["global", "GLOBAL"],
            ["school", "SCHOOL / SQUAD"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setBoard(id)}
            className={`border border-ink px-3 py-2 text-[11px] font-bold tracking-[0.12em] ${
              board === id ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-ink/5"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[10px] tracking-wide text-muted">
          {live ? "REALTIME: ON" : "DEMO FEED"}
        </span>
      </div>

      {loading && rows.length === 0 ? (
        <p className="border border-ink px-4 py-8 text-center text-sm text-muted">
          LOADING AUDIT ROWS…
        </p>
      ) : (
        <LeaderboardTable rows={rows} />
      )}

      <p className="mt-8 text-center text-[10px] tracking-[0.16em] text-muted">
        SHARE YOUR RECEIPT · UNCSTATS.COM/U/YOU
      </p>
    </main>
  );
}
