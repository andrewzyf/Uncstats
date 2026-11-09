import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { UncReceipt } from "../components/UncReceipt";
import { fetchUserAudit, type LeaderboardRow } from "../lib/supabase";

const APP_STORE = import.meta.env.VITE_APP_STORE_URL || "#download";
const PLAY_STORE = import.meta.env.VITE_PLAY_STORE_URL || "#download";

export function UserAuditPage() {
  const { username = "" } = useParams();
  const [row, setRow] = useState<LeaderboardRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUserAudit(username).then((data) => {
      if (!cancelled) {
        setRow(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const handle = username.replace(/^@/, "");

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          to="/"
          className="text-[11px] tracking-[0.14em] text-ink underline-offset-2 hover:text-warning hover:underline"
        >
          ← LIVE BOARD
        </Link>
        <span className="text-[11px] tracking-[0.18em] text-warning">UNCSTATS</span>
      </div>

      <header className="mb-8 text-center sm:text-left">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          @{handle || "unknown"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Live Unc Audit receipt from today&apos;s Reels exposure.
        </p>
      </header>

      {loading ? (
        <p className="border border-ink px-4 py-10 text-center text-sm text-muted">
          RETRIEVING SUBJECT FILE…
        </p>
      ) : !row ? (
        <div className="border border-ink px-4 py-10 text-center">
          <p className="text-sm font-bold">SUBJECT NOT FOUND</p>
          <p className="mt-2 text-xs text-muted">
            No audit on file for @{handle}. Download UncStats and establish a baseline.
          </p>
        </div>
      ) : (
        <UncReceipt row={row} />
      )}

      <section className="mx-auto mt-10 max-w-md border border-ink bg-ink px-5 py-6 text-paper">
        <h2 className="text-sm font-bold tracking-[0.16em]">BEAT THIS SCORE</h2>
        <p className="mt-2 text-xs leading-relaxed text-paper/75">
          Install UncStats. Enable telemetry. Produce a more unemployed audit than @
          {handle || "them"}.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <a
            href={APP_STORE}
            className="flex-1 border border-paper px-3 py-3 text-center text-[11px] font-bold tracking-[0.12em] hover:bg-paper hover:text-ink"
          >
            APP STORE
          </a>
          <a
            href={PLAY_STORE}
            className="flex-1 bg-warning px-3 py-3 text-center text-[11px] font-bold tracking-[0.12em] text-paper hover:brightness-110"
          >
            PLAY STORE
          </a>
        </div>
      </section>
    </main>
  );
}
