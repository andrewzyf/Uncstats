import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchSquadLeaderboard,
  isSupabaseConfigured,
  type LeaderboardRow,
} from "../lib/supabase";
import { useSession } from "../state/SessionContext";
import { uncAgeEquivalent } from "../utils/uncMetrics";

interface Props {
  onBack: () => void;
}

function demoRows(selfHandle: string, reels: number, rot: number): LeaderboardRow[] {
  const selfAge = uncAgeEquivalent(reels, rot).years;
  const rows: LeaderboardRow[] = [
    {
      user_id: "demo-1",
      username: "balcony_gary",
      ig_handle: "balcony_gary",
      device_os: "android",
      unc_tier: "Senior Facebook Marketplace Lowballer",
      squad_id: "default-squad",
      reels_scrolled: Math.max(reels + 120, 640),
      longest_rot_streak_mins: 94,
      unc_age: 74,
      updated_at: new Date().toISOString(),
    },
    {
      user_id: "demo-self",
      username: selfHandle,
      ig_handle: selfHandle,
      device_os: "android",
      unc_tier: "Couch Custodian",
      squad_id: "default-squad",
      reels_scrolled: reels,
      longest_rot_streak_mins: rot,
      unc_age: selfAge,
      updated_at: new Date().toISOString(),
    },
    {
      user_id: "demo-2",
      username: "part_time_nephew",
      ig_handle: "part_time_nephew",
      device_os: "ios",
      unc_tier: "Part-Time Nephew",
      squad_id: "default-squad",
      reels_scrolled: Math.max(80, Math.floor(reels * 0.45)),
      longest_rot_streak_mins: 22,
      unc_age: 28.4,
      updated_at: new Date().toISOString(),
    },
  ];
  return rows.sort((a, b) => b.reels_scrolled - a.reels_scrolled);
}

export function LeaderboardScreen({ onBack }: Props) {
  const { profile, audit, snapshot } = useSession();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "local-demo">("local-demo");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        const data = await fetchSquadLeaderboard(profile?.squadId);
        if (data.length > 0) {
          setRows(data);
          setSource("live");
          return;
        }
      }
      setRows(
        demoRows(
          profile?.igHandle ?? "you",
          audit.primary.reelsScrolledToday,
          snapshot.longestRotStreakMins
        )
      );
      setSource("local-demo");
    } catch {
      setRows(
        demoRows(
          profile?.igHandle ?? "you",
          audit.primary.reelsScrolledToday,
          snapshot.longestRotStreakMins
        )
      );
      setSource("local-demo");
    } finally {
      setLoading(false);
    }
  }, [profile, audit, snapshot]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4F0" }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#111111",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable onPress={onBack}>
          <Text
            style={{
              fontFamily: "SpaceMono_400Regular",
              fontSize: 11,
              color: "#111111",
            }}
          >
            BACK
          </Text>
        </Pressable>
        <Text
          style={{
            fontFamily: "SpaceMono_700Bold",
            fontSize: 13,
            color: "#111111",
            letterSpacing: 1,
          }}
        >
          LIVE SQUAD LEADERBOARD
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Text
        style={{
          fontFamily: "SpaceMono_400Regular",
          fontSize: 10,
          color: "#6B6B66",
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 4,
        }}
      >
        SOURCE: {source === "live" ? "SUPABASE REALTIME" : "LOCAL DEMO FEED"} —
        RANKED BY REELS SCROLLED / UNC AGE
      </Text>

      {loading && rows.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#FF4F00" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: "#C8C8C0" }} />
          )}
          renderItem={({ item, index }) => {
            const handle = (item.ig_handle || item.username).replace(/^@/, "");
            const isSelf =
              handle.toLowerCase() === (profile?.igHandle ?? "").toLowerCase();
            return (
              <View
                style={{
                  paddingVertical: 14,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 12,
                  backgroundColor: isSelf ? "#111111" : "transparent",
                  paddingHorizontal: isSelf ? 10 : 0,
                  marginHorizontal: isSelf ? -10 : 0,
                }}
              >
                <Text
                  style={{
                    fontFamily: "SpaceMono_700Bold",
                    fontSize: 14,
                    color: isSelf ? "#FF4F00" : "#111111",
                    width: 28,
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "SpaceMono_700Bold",
                      fontSize: 13,
                      color: isSelf ? "#F4F4F0" : "#111111",
                    }}
                  >
                    @{handle}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "SpaceMono_400Regular",
                      fontSize: 10,
                      color: isSelf ? "#C8C8C0" : "#6B6B66",
                      marginTop: 2,
                    }}
                  >
                    {item.unc_tier} · {item.device_os.toUpperCase()}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontFamily: "SpaceMono_700Bold",
                      fontSize: 13,
                      color: isSelf ? "#FF4F00" : "#111111",
                    }}
                  >
                    {item.reels_scrolled} REELS
                  </Text>
                  <Text
                    style={{
                      fontFamily: "SpaceMono_400Regular",
                      fontSize: 10,
                      color: isSelf ? "#C8C8C0" : "#6B6B66",
                      marginTop: 2,
                    }}
                  >
                    UNC AGE {Number(item.unc_age).toFixed(1)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

export default LeaderboardScreen;
