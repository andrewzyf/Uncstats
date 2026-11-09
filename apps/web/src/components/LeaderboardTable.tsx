import { Link } from "react-router-dom";
import type { LeaderboardRow } from "../lib/supabase";

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="overflow-hidden border border-ink">
      <div className="grid grid-cols-[48px_1fr_auto] gap-2 border-b border-ink bg-ink px-3 py-2 text-[10px] font-bold tracking-[0.14em] text-paper sm:grid-cols-[56px_1fr_140px_120px]">
        <span>RANK</span>
        <span>SUBJECT</span>
        <span className="hidden text-right sm:block">UNC AGE</span>
        <span className="text-right">REELS</span>
      </div>
      <ul>
        {rows.map((row, index) => {
          const handle = (row.ig_handle || row.username).replace(/^@/, "");
          return (
            <li
              key={row.user_id}
              className="grid grid-cols-[48px_1fr_auto] items-start gap-2 border-b border-rule px-3 py-3 last:border-b-0 sm:grid-cols-[56px_1fr_140px_120px]"
            >
              <span className="font-bold text-warning">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <Link
                  to={`/u/${encodeURIComponent(handle)}`}
                  className="font-bold underline-offset-2 hover:text-warning hover:underline"
                >
                  @{handle}
                </Link>
                <p className="mt-1 text-[10px] text-muted">
                  {row.unc_tier} · {row.device_os.toUpperCase()}
                  {row.school_id ? ` · ${row.school_id}` : ""}
                </p>
              </div>
              <span className="hidden text-right text-sm sm:block">
                {Number(row.unc_age).toFixed(1)}
              </span>
              <span className="text-right font-bold">{row.reels_scrolled}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
