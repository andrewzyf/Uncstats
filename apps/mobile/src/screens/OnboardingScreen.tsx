import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { enableUncTelemetry } from "../native/UncTelemetry";
import { useSession } from "../state/SessionContext";

interface Props {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: Props) {
  const { setProfile } = useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [igHandle, setIgHandle] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState(
    Platform.OS === "android"
      ? "Android: AccessibilityService required for exact Reels counts."
      : "iOS: Screen Time authorization + Instagram selection required."
  );

  const cleaned = igHandle.trim().replace(/^@/, "");

  const continueFromHandle = () => {
    if (!cleaned) return;
    setStep(2);
  };

  const onToggleTelemetry = async (value: boolean) => {
    setEnabled(value);
    if (!value) return;
    setBusy(true);
    try {
      const result = await enableUncTelemetry();
      if (result.platform === "android") {
        setStatusLine(
          result.openedSettings
            ? "Accessibility settings opened. Enable UncStats Telemetry, then return."
            : "UncStats AccessibilityService already active."
        );
      } else {
        if (!result.authorized) {
          setStatusLine("Screen Time authorization denied. Telemetry inactive.");
          setEnabled(false);
        } else if (!result.scheduled) {
          setStatusLine("Instagram selection cancelled. Telemetry inactive.");
          setEnabled(false);
        } else {
          setStatusLine("1-minute Instagram thresholds scheduled.");
        }
      }
    } catch (err) {
      setEnabled(false);
      setStatusLine(
        err instanceof Error
          ? err.message
          : "Native bridge unavailable. Use a custom Expo dev client."
      );
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    if (!cleaned || !enabled) return;
    const username = cleaned.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setProfile({
      username,
      igHandle: cleaned,
      userId: `local-${username}`,
      squadId: "default-squad",
      telemetryEnabled: true,
    });
    onComplete();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4F0" }}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 28 }}>
        <Text
          style={{
            fontFamily: "SpaceMono_700Bold",
            fontSize: 22,
            color: "#111111",
            letterSpacing: 1,
          }}
        >
          UNCSTATS
        </Text>
        <Text
          style={{
            fontFamily: "SpaceMono_400Regular",
            fontSize: 12,
            color: "#6B6B66",
            marginTop: 6,
            lineHeight: 18,
          }}
        >
          Unemployed Uncle Statistics. Clinical audit of terminal Reels
          exposure. No slang. No encouragement.
        </Text>

        <View
          style={{
            marginTop: 28,
            borderWidth: 1,
            borderColor: "#111111",
            padding: 16,
          }}
        >
          <Text
            style={{
              fontFamily: "SpaceMono_700Bold",
              fontSize: 11,
              color: "#FF4F00",
              letterSpacing: 1,
            }}
          >
            STEP {step} / 2
          </Text>

          {step === 1 ? (
            <View style={{ marginTop: 16 }}>
              <Text
                style={{
                  fontFamily: "SpaceMono_400Regular",
                  fontSize: 12,
                  color: "#111111",
                  marginBottom: 10,
                }}
              >
                Enter Instagram handle for the audit subject.
              </Text>
              <TextInput
                value={igHandle}
                onChangeText={setIgHandle}
                placeholder="@unc_on_couch"
                placeholderTextColor="#C8C8C0"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  fontFamily: "SpaceMono_400Regular",
                  fontSize: 16,
                  color: "#111111",
                  borderBottomWidth: 2,
                  borderBottomColor: "#111111",
                  paddingVertical: 10,
                }}
              />
              <Pressable
                onPress={continueFromHandle}
                disabled={!cleaned}
                style={{
                  marginTop: 24,
                  backgroundColor: cleaned ? "#111111" : "#C8C8C0",
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "SpaceMono_700Bold",
                    fontSize: 12,
                    color: "#F4F4F0",
                    letterSpacing: 1,
                  }}
                >
                  CONTINUE
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <Text
                style={{
                  fontFamily: "SpaceMono_400Regular",
                  fontSize: 12,
                  color: "#111111",
                  marginBottom: 16,
                  lineHeight: 18,
                }}
              >
                Enable Unc Telemetry. {Platform.OS === "android"
                  ? "Opens system Accessibility settings for exact scroll/like/share capture."
                  : "Requests Screen Time access and FamilyActivityPicker for Instagram."}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: "#C8C8C0",
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: "SpaceMono_700Bold",
                    fontSize: 12,
                    color: "#111111",
                    letterSpacing: 0.6,
                    flex: 1,
                    paddingRight: 12,
                  }}
                >
                  ENABLE UNC TELEMETRY
                </Text>
                {busy ? (
                  <ActivityIndicator color="#FF4F00" />
                ) : (
                  <Switch
                    value={enabled}
                    onValueChange={onToggleTelemetry}
                    trackColor={{ false: "#C8C8C0", true: "#FF4F00" }}
                    thumbColor="#F4F4F0"
                  />
                )}
              </View>

              <Text
                style={{
                  fontFamily: "SpaceMono_400Regular",
                  fontSize: 11,
                  color: "#6B6B66",
                  marginTop: 14,
                  lineHeight: 16,
                }}
              >
                {statusLine}
              </Text>

              <Pressable
                onPress={finish}
                disabled={!enabled}
                style={{
                  marginTop: 24,
                  backgroundColor: enabled ? "#FF4F00" : "#C8C8C0",
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "SpaceMono_700Bold",
                    fontSize: 12,
                    color: "#F4F4F0",
                    letterSpacing: 1,
                  }}
                >
                  BEGIN AUDIT
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default OnboardingScreen;
