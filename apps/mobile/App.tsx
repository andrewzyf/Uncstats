import "./global.css";
import React, { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from "@expo-google-fonts/space-mono";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "./src/state/SessionContext";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { LeaderboardScreen } from "./src/screens/LeaderboardScreen";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

type Route = "onboarding" | "dashboard" | "leaderboard";

function RootNavigator() {
  const { profile } = useSession();
  const [route, setRoute] = useState<Route>("onboarding");

  useEffect(() => {
    if (profile) setRoute("dashboard");
  }, [profile]);

  if (route === "onboarding" && !profile) {
    return <OnboardingScreen onComplete={() => setRoute("dashboard")} />;
  }
  if (route === "leaderboard") {
    return <LeaderboardScreen onBack={() => setRoute("dashboard")} />;
  }
  return (
    <DashboardScreen onOpenLeaderboard={() => setRoute("leaderboard")} />
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F4F4F0",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#FF4F00" />
        <Text
          style={{
            marginTop: 12,
            fontFamily: "monospace",
            fontSize: 11,
            color: "#111111",
            letterSpacing: 1,
          }}
        >
          LOADING AUDIT TYPEFACE
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <SessionProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SessionProvider>
      </View>
    </SafeAreaProvider>
  );
}
