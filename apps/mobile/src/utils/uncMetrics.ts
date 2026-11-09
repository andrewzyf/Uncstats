/**
 * UncStats Metrics Engine
 * Pure TypeScript — no React Native imports.
 * Converts raw Instagram telemetry into primary IG stats + derived Unc telemetry.
 */

export type DeviceOs = "android" | "ios";

export interface RawTelemetry {
  /** Exact reel swipe count on Android; estimated on iOS after calibration. */
  reelsScrolled: number;
  reelsLiked: number;
  commentsReadOrPosted: number;
  sharesDmed: number;
  activeScrollSeconds: number;
  /** Fastest inter-swipe gap in ms (Android). 0 if unknown. */
  fastestSkipMs: number;
  longestRotStreakMins: number;
  deviceOs: DeviceOs;
  /**
   * Live Android-calibrated reels/min used for iOS conversion.
   * Defaults to 10.8 (~5.55s per Reel).
   */
  calibrationReelsPerMinute?: number;
  /**
   * When deviceOs is iOS and reelsScrolled is 0, convert active minutes
   * into estimated reels using calibration.
   */
  activeMinutesIos?: number;
  /** Hourly wage for "Potential Minimum Wage Lost" (USD default 7.25). */
  hourlyWage?: number;
  /** Currency label for wage formatting. */
  currencyCode?: string;
}

export interface PrimaryIgStats {
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
}

export type OfficialClassification =
  | "Gainfully Employed"
  | "Part-Time Nephew"
  | "Couch Custodian"
  | "Senior Facebook Marketplace Lowballer";

export interface DerivedUncTelemetry {
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
}

export interface UncAuditReport {
  primary: PrimaryIgStats;
  derived: DerivedUncTelemetry;
  computedAt: string;
}

export const DEFAULT_REELS_PER_MINUTE = 10.8;
export const METERS_PER_REEL_SWIPE = 0.115;
export const DEFAULT_HOURLY_WAGE = 7.25;
export const UNC_AGE_CAP = 74;
export const UNC_AGE_BASE = 18;

const CLASSIFICATION_BANDS: Array<{
  maxExclusive: number;
  label: OfficialClassification;
}> = [
  { maxExclusive: 51, label: "Gainfully Employed" },
  { maxExclusive: 201, label: "Part-Time Nephew" },
  { maxExclusive: 501, label: "Couch Custodian" },
  { maxExclusive: Number.POSITIVE_INFINITY, label: "Senior Facebook Marketplace Lowballer" },
];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resolve reel count: Android uses exact swipe count; iOS may convert
 * active Screen Time minutes through the Android-calibrated multiplier.
 */
export function resolveReelsScrolled(raw: RawTelemetry): {
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
    raw.activeMinutesIos ??
    Math.floor(Math.max(0, raw.activeScrollSeconds) / 60);
  const estimated = Math.floor(minutes * rpm);

  return { reels: Math.max(0, estimated), method: "calibrated_estimate" };
}

export function classifyUnc(reelsScrolled: number): OfficialClassification {
  const n = Math.max(0, reelsScrolled);
  for (const band of CLASSIFICATION_BANDS) {
    if (n < band.maxExclusive) return band.label;
  }
  return "Senior Facebook Marketplace Lowballer";
}

/**
 * Employment Probability: starts at 100%, drops exponentially per 50 Reels.
 * floor at <0.1% labeled Unemployable.
 *
 * P = 100 * e^(-k * reels/50) with k chosen so ~500 reels ≈ 0.1%.
 */
export function employmentProbability(reelsScrolled: number): {
  percent: number;
  label: string;
} {
  const reels = Math.max(0, reelsScrolled);
  const k = 0.69;
  const percent = 100 * Math.exp((-k * reels) / 50);

  if (percent < 0.1) {
    return { percent: 0.1, label: "<0.1% (Unemployable)" };
  }

  const rounded = percent >= 10 ? round1(percent) : round2(percent);
  return {
    percent: rounded,
    label: `${rounded.toFixed(rounded >= 10 ? 1 : 2)}%`,
  };
}

export function uncAgeEquivalent(
  reelsScrolled: number,
  longestRotStreakMins: number
): { years: number; label: string } {
  const raw =
    UNC_AGE_BASE +
    reelsScrolled * 0.08 +
    Math.max(0, longestRotStreakMins) * 0.25;
  const years = round1(Math.min(UNC_AGE_CAP, raw));

  if (years >= UNC_AGE_CAP) {
    return { years: UNC_AGE_CAP, label: "74 y/o Retired Balcony Uncle" };
  }

  return { years, label: `${years.toFixed(1)} y/o` };
}

export function thumbDistance(reelsScrolled: number): {
  meters: number;
  label: string;
} {
  const meters = round1(reelsScrolled * METERS_PER_REEL_SWIPE);
  if (meters >= 1000) {
    const km = round2(meters / 1000);
    return {
      meters,
      label: `${km.toFixed(2)}km — 0.0 calories burned`,
    };
  }
  return {
    meters,
    label: `${meters.toFixed(1)}m — 0.0 calories burned`,
  };
}

export function wageLost(
  activeScrollSeconds: number,
  hourlyWage = DEFAULT_HOURLY_WAGE,
  currencyCode = "USD"
): { amount: number; label: string } {
  const hours = Math.max(0, activeScrollSeconds) / 3600;
  const amount = round2(hours * hourlyWage);
  const symbol = currencyCode === "USD" ? "$" : `${currencyCode} `;
  return {
    amount,
    label: `${symbol}${amount.toFixed(2)} potential ${currencyCode} forfeited`,
  };
}

export function spineCurve(activeScrollSeconds: number): {
  degrees: number;
  label: string;
} {
  const degrees = round1(15 + Math.min(45, Math.max(0, activeScrollSeconds) / 180));
  return {
    degrees,
    label: `${degrees.toFixed(1)} deg cervical flexion (est.)`,
  };
}

export function avgAttentionSpan(
  reelsScrolled: number,
  activeScrollSeconds: number,
  fastestSkipMs: number
): { seconds: number; label: string; fastestLabel: string } {
  if (reelsScrolled <= 0 || activeScrollSeconds <= 0) {
    return {
      seconds: 0,
      label: "n/a — insufficient sample",
      fastestLabel: fastestSkipMs > 0 ? `${fastestSkipMs}ms` : "n/a",
    };
  }
  const seconds = round1(activeScrollSeconds / reelsScrolled);
  return {
    seconds,
    label: `${seconds.toFixed(1)}s / Reel`,
    fastestLabel: fastestSkipMs > 0 ? `${fastestSkipMs}ms` : "n/a",
  };
}

function postureIndex(
  spineDegrees: number,
  longestRotStreakMins: number
): DerivedUncTelemetry["postureDegradationIndex"] {
  const score = spineDegrees + longestRotStreakMins * 0.4;
  if (score >= 70) return "Catastrophic";
  if (score >= 50) return "Severe";
  if (score >= 35) return "Moderate";
  return "Mild";
}

/**
 * Full audit pipeline: raw telemetry → primary IG stats + derived Unc metrics.
 */
export function computeUncAudit(raw: RawTelemetry): UncAuditReport {
  const { reels, method } = resolveReelsScrolled(raw);
  const likes = Math.max(0, Math.floor(raw.reelsLiked));
  const comments = Math.max(0, Math.floor(raw.commentsReadOrPosted));
  const shares = Math.max(0, Math.floor(raw.sharesDmed));
  const activeSeconds = Math.max(0, Math.floor(raw.activeScrollSeconds));
  const fastest = Math.max(0, Math.floor(raw.fastestSkipMs));
  const rotMins = Math.max(0, Math.floor(raw.longestRotStreakMins));
  const wage = raw.hourlyWage ?? DEFAULT_HOURLY_WAGE;
  const currency = raw.currencyCode ?? "USD";

  const attention = avgAttentionSpan(reels, activeSeconds, fastest);
  const thumb = thumbDistance(reels);
  const lost = wageLost(activeSeconds, wage, currency);
  const age = uncAgeEquivalent(reels, rotMins);
  const spine = spineCurve(activeSeconds);
  const employ = employmentProbability(reels);
  const classification = classifyUnc(reels);
  const posture = postureIndex(spine.degrees, rotMins);
  const couchMm = round1(clamp(reels * 0.006 + rotMins * 0.08, 0, 42));

  return {
    computedAt: new Date().toISOString(),
    primary: {
      reelsScrolledToday: reels,
      reelsScrolledLabel:
        method === "exact"
          ? `${reels} (exact)`
          : `${reels} (calibrated estimate)`,
      doubleTapLikesIssued: likes,
      commentsInspectedOrPosted: comments,
      reelsForwardedToBros: shares,
      avgAttentionSpanSeconds: attention.seconds,
      avgAttentionSpanLabel: attention.label,
      fastestSkipMs: fastest,
      fastestSkipLabel: attention.fastestLabel,
      measurementMethod: method,
    },
    derived: {
      thumbDistanceMeters: thumb.meters,
      thumbDistanceLabel: thumb.label,
      potentialWageLost: lost.amount,
      potentialWageLostLabel: lost.label,
      uncAgeYears: age.years,
      uncAgeLabel: age.label,
      spineCurveDegrees: spine.degrees,
      spineCurveLabel: spine.label,
      employmentProbabilityPercent: employ.percent,
      employmentProbabilityLabel: employ.label,
      officialClassification: classification,
      couchIndentationMm: couchMm,
      couchIndentationLabel: `+${couchMm.toFixed(1)}mm`,
      postureDegradationIndex: posture,
    },
  };
}

/** Compact floating pill copy for the Android overlay. */
export function formatUncPill(reels: number, uncAgeYears: number): string {
  const age = Math.min(UNC_AGE_CAP, Math.round(uncAgeYears));
  return `[UNC: ${reels} REELS | ${age} Y/O]`;
}

/** Receipt header timestamp helpers. */
export function formatAuditTimestamp(date = new Date()): {
  dateLine: string;
  timeLine: string;
} {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return {
    dateLine: `${y}-${m}-${d}`,
    timeLine: `${hh}:${mm}:${ss}`,
  };
}
