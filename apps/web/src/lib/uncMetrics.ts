/**
 * Web copy of the UncStats metrics engine — keep in sync with
 * apps/mobile/src/utils/uncMetrics.ts for identical Story receipts.
 */

export type DeviceOs = "android" | "ios";

export interface RawTelemetry {
  reelsScrolled: number;
  reelsLiked: number;
  commentsReadOrPosted: number;
  sharesDmed: number;
  activeScrollSeconds: number;
  fastestSkipMs: number;
  longestRotStreakMins: number;
  deviceOs: DeviceOs;
  calibrationReelsPerMinute?: number;
  activeMinutesIos?: number;
  hourlyWage?: number;
  currencyCode?: string;
}

export type OfficialClassification =
  | "Gainfully Employed"
  | "Part-Time Nephew"
  | "Couch Custodian"
  | "Senior Facebook Marketplace Lowballer";

export interface UncAuditReport {
  primary: {
    reelsScrolledToday: number;
    reelsScrolledLabel: string;
    doubleTapLikesIssued: number;
    commentsInspectedOrPosted: number;
    reelsForwardedToBros: number;
    avgAttentionSpanSeconds: number;
    avgAttentionSpanLabel: string;
    fastestSkipMs: number;
    fastestSkipLabel: string;
    measurementMethod: "exact" | "calibrated_estimate";
  };
  derived: {
    thumbDistanceMeters: number;
    thumbDistanceLabel: string;
    potentialWageLost: number;
    potentialWageLostLabel: string;
    uncAgeYears: number;
    uncAgeLabel: string;
    spineCurveDegrees: number;
    spineCurveLabel: string;
    employmentProbabilityPercent: number;
    employmentProbabilityLabel: string;
    officialClassification: OfficialClassification;
    couchIndentationMm: number;
    couchIndentationLabel: string;
    postureDegradationIndex: "Mild" | "Moderate" | "Severe" | "Catastrophic";
  };
  computedAt: string;
}

const DEFAULT_REELS_PER_MINUTE = 10.8;
const METERS_PER_REEL_SWIPE = 0.115;
const DEFAULT_HOURLY_WAGE = 7.25;
const UNC_AGE_CAP = 74;
const UNC_AGE_BASE = 18;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function classifyUnc(reelsScrolled: number): OfficialClassification {
  const n = Math.max(0, reelsScrolled);
  if (n <= 50) return "Gainfully Employed";
  if (n <= 200) return "Part-Time Nephew";
  if (n <= 500) return "Couch Custodian";
  return "Senior Facebook Marketplace Lowballer";
}

function resolveReels(raw: RawTelemetry): {
  reels: number;
  method: "exact" | "calibrated_estimate";
} {
  if (raw.deviceOs === "android") {
    return { reels: Math.max(0, Math.floor(raw.reelsScrolled)), method: "exact" };
  }
  if (raw.reelsScrolled > 0) {
    return {
      reels: Math.max(0, Math.floor(raw.reelsScrolled)),
      method: "calibrated_estimate",
    };
  }
  const rpm = raw.calibrationReelsPerMinute ?? DEFAULT_REELS_PER_MINUTE;
  const minutes =
    raw.activeMinutesIos ?? Math.floor(Math.max(0, raw.activeScrollSeconds) / 60);
  return {
    reels: Math.max(0, Math.floor(minutes * rpm)),
    method: "calibrated_estimate",
  };
}

export function computeUncAudit(raw: RawTelemetry): UncAuditReport {
  const { reels, method } = resolveReels(raw);
  const likes = Math.max(0, Math.floor(raw.reelsLiked));
  const comments = Math.max(0, Math.floor(raw.commentsReadOrPosted));
  const shares = Math.max(0, Math.floor(raw.sharesDmed));
  const activeSeconds = Math.max(0, Math.floor(raw.activeScrollSeconds));
  const fastest = Math.max(0, Math.floor(raw.fastestSkipMs));
  const rotMins = Math.max(0, Math.floor(raw.longestRotStreakMins));
  const wage = raw.hourlyWage ?? DEFAULT_HOURLY_WAGE;

  const attention =
    reels > 0 && activeSeconds > 0 ? round1(activeSeconds / reels) : 0;
  const thumbMeters = round1(reels * METERS_PER_REEL_SWIPE);
  const thumbLabel =
    thumbMeters >= 1000
      ? `${round2(thumbMeters / 1000).toFixed(2)}km — 0.0 calories burned`
      : `${thumbMeters.toFixed(1)}m — 0.0 calories burned`;
  const lost = round2((activeSeconds / 3600) * wage);
  const ageRaw = UNC_AGE_BASE + reels * 0.08 + rotMins * 0.25;
  const ageYears = round1(Math.min(UNC_AGE_CAP, ageRaw));
  const ageLabel =
    ageYears >= UNC_AGE_CAP
      ? "74 y/o Retired Balcony Uncle"
      : `${ageYears.toFixed(1)} y/o`;
  const spine = round1(15 + Math.min(45, activeSeconds / 180));
  const employRaw = 100 * Math.exp((-0.69 * reels) / 50);
  const employ =
    employRaw < 0.1
      ? { percent: 0.1, label: "<0.1% (Unemployable)" }
      : {
          percent: employRaw >= 10 ? round1(employRaw) : round2(employRaw),
          label:
            employRaw >= 10
              ? `${round1(employRaw).toFixed(1)}%`
              : `${round2(employRaw).toFixed(2)}%`,
        };
  const postureScore = spine + rotMins * 0.4;
  const posture =
    postureScore >= 70
      ? "Catastrophic"
      : postureScore >= 50
        ? "Severe"
        : postureScore >= 35
          ? "Moderate"
          : "Mild";
  const couchMm = round1(clamp(reels * 0.006 + rotMins * 0.08, 0, 42));

  return {
    computedAt: new Date().toISOString(),
    primary: {
      reelsScrolledToday: reels,
      reelsScrolledLabel:
        method === "exact" ? `${reels} (exact)` : `${reels} (calibrated estimate)`,
      doubleTapLikesIssued: likes,
      commentsInspectedOrPosted: comments,
      reelsForwardedToBros: shares,
      avgAttentionSpanSeconds: attention,
      avgAttentionSpanLabel:
        attention > 0 ? `${attention.toFixed(1)}s / Reel` : "n/a — insufficient sample",
      fastestSkipMs: fastest,
      fastestSkipLabel: fastest > 0 ? `${fastest}ms` : "n/a",
      measurementMethod: method,
    },
    derived: {
      thumbDistanceMeters: thumbMeters,
      thumbDistanceLabel: thumbLabel,
      potentialWageLost: lost,
      potentialWageLostLabel: `$${lost.toFixed(2)} potential USD forfeited`,
      uncAgeYears: ageYears,
      uncAgeLabel: ageLabel,
      spineCurveDegrees: spine,
      spineCurveLabel: `${spine.toFixed(1)} deg cervical flexion (est.)`,
      employmentProbabilityPercent: employ.percent,
      employmentProbabilityLabel: employ.label,
      officialClassification: classifyUnc(reels),
      couchIndentationMm: couchMm,
      couchIndentationLabel: `+${couchMm.toFixed(1)}mm`,
      postureDegradationIndex: posture,
    },
  };
}

export function formatAuditTimestamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return { dateLine: `${y}-${m}-${d}`, timeLine: `${hh}:${mm}:${ss}` };
}
