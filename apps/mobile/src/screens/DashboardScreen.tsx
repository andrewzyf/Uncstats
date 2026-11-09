import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { UncReceiptCard } from "../components/UncReceiptCard";
import { useSession } from "../state/SessionContext";

interface Props {
  onOpenLeaderboard: () => void;
}

async function shareToInstagramStory(uri: string): Promise<void> {
  const attribution = "uncstats";
  if (Platform.OS === "ios") {
    const url =
      `instagram-stories://share?source_application=${attribution}` +
      `&backgroundImage=${encodeURIComponent(uri)}`;
    const can = await Linking.canOpenURL("instagram-stories://share");
    if (can) {
      // iOS pasteboard-based share is preferred via Sharing when URL scheme fails;
      // attempt scheme first, then fall back to system share sheet.
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // fall through
      }
    }
  }

  if (Platform.OS === "android") {
    // Instagram Stories Android intent via generic share; dedicated package target.
    const can = await Linking.canOpenURL("instagram://story-camera");
    if (can) {
      // Capture is shared through the system sheet filtered toward Instagram.
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      dialogTitle: "POST TO IG STORY",
      UTI: "public.png",
    });
    return;
  }

  throw new Error("Sharing unavailable on this device");
}

export function DashboardScreen({ onOpenLeaderboard }: Props) {
  const { profile, audit, rivalHandle, setRivalHandle, refreshSnapshot } =
    useSession();
  const shotRef = useRef<ViewShot>(null);
  const [posting, setPosting] = useState(false);

  const onPostStory = useCallback(async () => {
    if (!shotRef.current?.capture) return;
    setPosting(true);
    try {
      await refreshSnapshot();
      const uri = await shotRef.current.capture();
      await shareToInstagramStory(uri);
    } catch (err) {
      Alert.alert(
        "STORY EXPORT FAILED",
        err instanceof Error ? err.message : "Unable to capture receipt"
      );
    } finally {
      setPosting(false);
    }
  }, [refreshSnapshot]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4F0" }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 8,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: "#111111",
        }}
      >
        <Text
          style={{
            fontFamily: "SpaceMono_700Bold",
            fontSize: 14,
            color: "#111111",
            letterSpacing: 1,
          }}
        >
          UNCSTATS
        </Text>
        <Pressable onPress={onOpenLeaderboard}>
          <Text
            style={{
              fontFamily: "SpaceMono_400Regular",
              fontSize: 11,
              color: "#FF4F00",
              letterSpacing: 0.8,
            }}
          >
            SQUAD BOARD
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontFamily: "SpaceMono_400Regular",
            fontSize: 11,
            color: "#6B6B66",
            marginBottom: 12,
          }}
        >
          LIVE AUDIT — {audit.derived.officialClassification.toUpperCase()}
        </Text>

        <ViewShot
          ref={shotRef}
          options={{ format: "png", quality: 1, result: "tmpfile" }}
        >
          <UncReceiptCard
            igHandle={profile?.igHandle ?? "unknown"}
            audit={audit}
            rivalHandle={rivalHandle}
            onRivalHandleChange={setRivalHandle}
            editableRival
          />
        </ViewShot>

        <Pressable
          onPress={onPostStory}
          disabled={posting}
          style={{
            marginTop: 20,
            backgroundColor: "#111111",
            paddingVertical: 16,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {posting ? (
            <ActivityIndicator color="#FF4F00" />
          ) : (
            <Text
              style={{
                fontFamily: "SpaceMono_700Bold",
                fontSize: 13,
                color: "#F4F4F0",
                letterSpacing: 1.2,
              }}
            >
              POST TO IG STORY
            </Text>
          )}
        </Pressable>

        <Text
          style={{
            marginTop: 10,
            fontFamily: "SpaceMono_400Regular",
            fontSize: 10,
            color: "#6B6B66",
            textAlign: "center",
            lineHeight: 15,
          }}
        >
          Captures PNG via react-native-view-shot. Opens Instagram Stories share
          when available; otherwise system share sheet.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default DashboardScreen;
