import {
  classifyUnc,
  computeUncAudit,
  employmentProbability,
  formatUncPill,
  thumbDistance,
  uncAgeEquivalent,
  wageLost,
} from "./uncMetrics";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const audit = computeUncAudit({
  reelsScrolled: 214,
  reelsLiked: 18,
  commentsReadOrPosted: 7,
  sharesDmed: 3,
  activeScrollSeconds: 214 * 5,
  fastestSkipMs: 420,
  longestRotStreakMins: 46,
  deviceOs: "android",
});

assert(audit.primary.reelsScrolledToday === 214, "reels");
assert(audit.derived.officialClassification === "Couch Custodian", "class");
assert(audit.primary.avgAttentionSpanLabel.includes("s / Reel"), "attention");
assert(thumbDistance(214).label.includes("m"), "thumb");
assert(wageLost(3600).amount === 7.25, "wage");
assert(uncAgeEquivalent(700, 100).label.includes("Retired Balcony"), "age cap");
assert(employmentProbability(5000).label.includes("Unemployable"), "employ");
assert(classifyUnc(10) === "Gainfully Employed", "tier0");
assert(classifyUnc(100) === "Part-Time Nephew", "tier1");
assert(classifyUnc(300) === "Couch Custodian", "tier2");
assert(classifyUnc(501) === "Senior Facebook Marketplace Lowballer", "tier3");
assert(formatUncPill(214, 58).includes("214 REELS"), "pill");

const ios = computeUncAudit({
  reelsScrolled: 0,
  reelsLiked: 0,
  commentsReadOrPosted: 0,
  sharesDmed: 0,
  activeScrollSeconds: 600,
  fastestSkipMs: 0,
  longestRotStreakMins: 10,
  deviceOs: "ios",
  activeMinutesIos: 10,
  calibrationReelsPerMinute: 10.8,
});
assert(ios.primary.reelsScrolledToday === 108, "ios calibrate");
assert(ios.primary.measurementMethod === "calibrated_estimate", "ios method");

console.log("uncMetrics.selftest: OK");
