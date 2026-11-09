import { computeUncAudit, formatAuditTimestamp, type UncAuditReport } from "../lib/uncMetrics";
import type { LeaderboardRow } from "../lib/supabase";

function Row({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 py-1 text-[11px] uppercase tracking-wide">
      <span className="text-ink/90">{label}</span>
      <span className={`text-right font-bold ${warn ? "text-warning" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}

function Barcode() {
  const bars = Array.from({ length: 52 }, (_, i) => 1 + ((i * 7) % 3));
  return (
    <div className="flex h-10 w-full items-stretch gap-px overflow-hidden">
      {bars.map((w, i) => (
        <div
          key={i}
          className={i % 2 === 0 ? "bg-ink" : "bg-paper"}
          style={{ width: w * 3 }}
        />
      ))}
    </div>
  );
}

export function auditFromRow(row: LeaderboardRow): UncAuditReport {
  return computeUncAudit({
    reelsScrolled: row.reels_scrolled,
    reelsLiked: row.reels_liked,
    commentsReadOrPosted: row.comments_read_or_posted,
    sharesDmed: row.shares_dmed,
    activeScrollSeconds: row.active_scroll_seconds,
    fastestSkipMs: row.fastest_skip_ms,
    longestRotStreakMins: row.longest_rot_streak_mins,
    deviceOs: row.device_os,
  });
}

export function UncReceipt({
  row,
  rivalHandle = "your_employed_friend",
}: {
  row: LeaderboardRow;
  rivalHandle?: string;
}) {
  const audit = auditFromRow(row);
  const { dateLine, timeLine } = formatAuditTimestamp(new Date(audit.computedAt));
  const handle = (row.ig_handle || row.username).replace(/^@/, "");

  return (
    <article className="relative mx-auto w-full max-w-md rotate-[-0.4deg] border border-ink bg-paper bg-receipt px-5 pb-5 pt-6 shadow-[4px_4px_0_#111111]">
      <header className="text-center">
        <h1 className="text-sm font-bold tracking-[0.18em]">OFFICIAL UNC AUDIT</h1>
        <p className="mt-1 text-[10px] tracking-[0.14em]">// DEPT. OF UNEMPLOYMENT</p>
      </header>

      <div className="my-3 border-b border-ink" />

      <Row label="Subject" value={`@${handle}`} warn />
      <Row label="Date" value={dateLine} />
      <Row label="Time" value={timeLine} />
      <Row label="Classification" value={audit.derived.officialClassification} warn />
      <Row
        label="Measurement"
        value={
          audit.primary.measurementMethod === "exact"
            ? "ANDROID EXACT"
            : "IOS CALIBRATED"
        }
      />

      <div className="my-3 border-b border-dashed border-ink/50" />
      <p className="mb-2 text-[10px] font-bold tracking-[0.16em]">INSTAGRAM TELEMETRY</p>
      <Row label="Reels Scrolled Today" value={String(audit.primary.reelsScrolledToday)} warn />
      <Row label="Double-Tap Likes Issued" value={String(audit.primary.doubleTapLikesIssued)} />
      <Row
        label="Comments Inspected / Posted"
        value={String(audit.primary.commentsInspectedOrPosted)}
      />
      <Row label="Reels Forwarded to Bros" value={String(audit.primary.reelsForwardedToBros)} />
      <Row label="Avg Attention Span" value={audit.primary.avgAttentionSpanLabel} />

      <div className="my-3 border-b border-dashed border-ink/50" />
      <p className="mb-2 text-[10px] font-bold tracking-[0.16em]">DERIVED UNC TELEMETRY</p>
      <Row label="Thumb Distance Traveled" value={audit.derived.thumbDistanceLabel} />
      <Row label="Potential Min. Wage Lost" value={audit.derived.potentialWageLostLabel} />
      <Row label="Unc Age Equivalent" value={audit.derived.uncAgeLabel} warn />
      <Row label="Spine Curve / Neck Angle" value={audit.derived.spineCurveLabel} />
      <Row
        label="Employment Probability"
        value={audit.derived.employmentProbabilityLabel}
        warn
      />
      <Row label="Couch Indentation Depth" value={audit.derived.couchIndentationLabel} />
      <Row label="Posture Degradation Index" value={audit.derived.postureDegradationIndex} />

      <div className="my-3 border-b border-ink" />
      <Barcode />

      <p className="mt-3 text-center text-[10px] tracking-wide">
        CERTIFIED MORE UNEMPLOYED THAN:
      </p>
      <p className="mt-1 text-center text-sm font-bold text-warning">
        @{rivalHandle.replace(/^@/, "")}
      </p>
      <p className="mt-4 text-center text-[9px] tracking-[0.2em] text-muted">
        UNCSTATS.COM
      </p>
    </article>
  );
}
