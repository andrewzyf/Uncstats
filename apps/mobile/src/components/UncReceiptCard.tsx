import React, { forwardRef, useMemo } from "react";
import { Text, TextInput, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import {
  formatAuditTimestamp,
  type UncAuditReport,
} from "../utils/uncMetrics";

export interface UncReceiptCardProps {
  igHandle: string;
  audit: UncAuditReport;
  rivalHandle: string;
  onRivalHandleChange?: (value: string) => void;
  editableRival?: boolean;
}

function Row({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 4,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontFamily: "SpaceMono_400Regular",
          fontSize: 11,
          color: "#111111",
          textTransform: "uppercase",
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: emphasize
            ? "SpaceMono_700Bold"
            : "SpaceMono_400Regular",
          fontSize: 11,
          color: emphasize ? "#FF4F00" : "#111111",
          textAlign: "right",
          maxWidth: "48%",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Divider({ dashed = false }: { dashed?: boolean }) {
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: "#111111",
        borderStyle: dashed ? "dashed" : "solid",
        marginVertical: 10,
        opacity: dashed ? 0.55 : 1,
      }}
    />
  );
}

function Barcode() {
  const bars = useMemo(() => {
    const out: number[] = [];
    let seed = 2147483647;
    for (let i = 0; i < 48; i++) {
      seed = (seed * 48271) % 2147483647;
      out.push(1 + (seed % 3));
    }
    return out;
  }, []);

  let x = 0;
  return (
    <Svg width="100%" height={42} viewBox="0 0 240 42">
      {bars.map((w, i) => {
        const rect = (
          <Rect
            key={i}
            x={x}
            y={0}
            width={w}
            height={42}
            fill={i % 2 === 0 ? "#111111" : "#F4F4F0"}
          />
        );
        x += w + 1;
        return rect;
      })}
    </Svg>
  );
}

/**
 * Thermal-receipt / municipal citation card for Story capture.
 */
export const UncReceiptCard = forwardRef<View, UncReceiptCardProps>(
  function UncReceiptCard(
    {
      igHandle,
      audit,
      rivalHandle,
      onRivalHandleChange,
      editableRival = true,
    },
    ref
  ) {
    const { dateLine, timeLine } = formatAuditTimestamp(
      new Date(audit.computedAt)
    );
    const handle = igHandle.startsWith("@") ? igHandle : `@${igHandle}`;
    const rival = rivalHandle.replace(/^@/, "");

    return (
      <View
        ref={ref}
        collapsable={false}
        style={{
          backgroundColor: "#F4F4F0",
          paddingHorizontal: 18,
          paddingTop: 22,
          paddingBottom: 18,
          borderWidth: 1,
          borderColor: "#111111",
          transform: [{ rotate: "-0.4deg" }],
          shadowColor: "#111111",
          shadowOpacity: 0.18,
          shadowRadius: 0,
          shadowOffset: { width: 3, height: 3 },
        }}
      >
        <Text
          style={{
            fontFamily: "SpaceMono_700Bold",
            fontSize: 13,
            color: "#111111",
            letterSpacing: 1.2,
            textAlign: "center",
          }}
        >
          OFFICIAL UNC AUDIT
        </Text>
        <Text
          style={{
            fontFamily: "SpaceMono_400Regular",
            fontSize: 10,
            color: "#111111",
            textAlign: "center",
            marginTop: 2,
            letterSpacing: 0.8,
          }}
        >
          // DEPT. OF UNEMPLOYMENT
        </Text>

        <Divider />

        <Row label="Subject" value={handle} emphasize />
        <Row label="Date" value={dateLine} />
        <Row label="Time" value={timeLine} />
        <Row
          label="Classification"
          value={audit.derived.officialClassification}
          emphasize
        />
        <Row
          label="Measurement"
          value={
            audit.primary.measurementMethod === "exact"
              ? "ANDROID EXACT"
              : "IOS CALIBRATED"
          }
        />

        <Divider dashed />

        <Text
          style={{
            fontFamily: "SpaceMono_700Bold",
            fontSize: 10,
            color: "#111111",
            marginBottom: 6,
            letterSpacing: 1,
          }}
        >
          INSTAGRAM TELEMETRY
        </Text>
        <Row
          label="Reels Scrolled Today"
          value={String(audit.primary.reelsScrolledToday)}
          emphasize
        />
        <Row
          label="Double-Tap Likes Issued"
          value={String(audit.primary.doubleTapLikesIssued)}
        />
        <Row
          label="Comments Inspected / Posted"
          value={String(audit.primary.commentsInspectedOrPosted)}
        />
        <Row
          label="Reels Forwarded to Bros"
          value={String(audit.primary.reelsForwardedToBros)}
        />
        <Row
          label="Avg Attention Span"
          value={audit.primary.avgAttentionSpanLabel}
        />
        <Row label="Fastest Skip" value={audit.primary.fastestSkipLabel} />

        <Divider dashed />

        <Text
          style={{
            fontFamily: "SpaceMono_700Bold",
            fontSize: 10,
            color: "#111111",
            marginBottom: 6,
            letterSpacing: 1,
          }}
        >
          DERIVED UNC TELEMETRY
        </Text>
        <Row
          label="Thumb Distance Traveled"
          value={audit.derived.thumbDistanceLabel}
        />
        <Row
          label="Potential Min. Wage Lost"
          value={audit.derived.potentialWageLostLabel}
        />
        <Row label="Unc Age Equivalent" value={audit.derived.uncAgeLabel} emphasize />
        <Row
          label="Spine Curve / Neck Angle"
          value={audit.derived.spineCurveLabel}
        />
        <Row
          label="Employment Probability"
          value={audit.derived.employmentProbabilityLabel}
          emphasize
        />
        <Row
          label="Couch Indentation Depth"
          value={audit.derived.couchIndentationLabel}
        />
        <Row
          label="Posture Degradation Index"
          value={audit.derived.postureDegradationIndex}
        />

        <Divider />

        <View style={{ marginBottom: 8 }}>
          <Barcode />
        </View>

        <Text
          style={{
            fontFamily: "SpaceMono_400Regular",
            fontSize: 10,
            color: "#111111",
            textAlign: "center",
            lineHeight: 16,
          }}
        >
          CERTIFIED MORE UNEMPLOYED THAN:
        </Text>
        {editableRival && onRivalHandleChange ? (
          <TextInput
            value={`@${rival}`}
            onChangeText={(t) => onRivalHandleChange(t.replace(/^@/, ""))}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              fontFamily: "SpaceMono_700Bold",
              fontSize: 13,
              color: "#FF4F00",
              textAlign: "center",
              marginTop: 4,
              paddingVertical: 4,
              borderBottomWidth: 1,
              borderBottomColor: "#C8C8C0",
            }}
          />
        ) : (
          <Text
            style={{
              fontFamily: "SpaceMono_700Bold",
              fontSize: 13,
              color: "#FF4F00",
              textAlign: "center",
              marginTop: 4,
            }}
          >
            @{rival}
          </Text>
        )}

        <Text
          style={{
            fontFamily: "SpaceMono_400Regular",
            fontSize: 9,
            color: "#6B6B66",
            textAlign: "center",
            marginTop: 14,
            letterSpacing: 1.4,
          }}
        >
          UNCSTATS.COM
        </Text>
      </View>
    );
  }
);

export default UncReceiptCard;
