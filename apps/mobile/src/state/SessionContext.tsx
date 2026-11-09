import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import {
  computeUncAudit,
  UncAuditReport,
  type DeviceOs,
} from "../utils/uncMetrics";
import {
  getTelemetrySnapshot,
  subscribeTelemetry,
  type TelemetrySnapshot,
} from "../native/UncTelemetry";
import { fetchCalibrationReelsPerMinute } from "../lib/supabase";

export interface UserProfile {
  username: string;
  igHandle: string;
  userId: string;
  squadId: string;
  telemetryEnabled: boolean;
}

interface SessionState {
  profile: UserProfile | null;
  setProfile: (p: UserProfile) => void;
  snapshot: TelemetrySnapshot;
  audit: UncAuditReport;
  calibrationRpm: number;
  rivalHandle: string;
  setRivalHandle: (h: string) => void;
  refreshSnapshot: () => Promise<void>;
}

const defaultSnapshot: TelemetrySnapshot = {
  reelsScrolled: 0,
  reelsLiked: 0,
  commentsReadOrPosted: 0,
  sharesDmed: 0,
  activeScrollSeconds: 0,
  fastestSkipMs: 0,
  longestRotStreakMins: 0,
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>(defaultSnapshot);
  const [calibrationRpm, setCalibrationRpm] = useState(10.8);
  const [rivalHandle, setRivalHandle] = useState("your_employed_friend");

  const refreshSnapshot = useCallback(async () => {
    try {
      const next = await getTelemetrySnapshot();
      setSnapshot(next);
    } catch {
      // Native module absent in Expo Go — keep last snapshot / zeros.
    }
  }, []);

  useEffect(() => {
    fetchCalibrationReelsPerMinute().then(setCalibrationRpm).catch(() => undefined);
    refreshSnapshot();
    const unsub = subscribeTelemetry((event) => {
      setSnapshot((prev) => ({
        ...prev,
        reelsScrolled: event.reelsScrolled,
        reelsLiked: event.reelsLiked,
        commentsReadOrPosted: event.commentsReadOrPosted,
        sharesDmed: event.sharesDmed,
        activeScrollSeconds: event.activeScrollSeconds,
        fastestSkipMs: event.fastestSkipMs,
        longestRotStreakMins: event.longestRotStreakMins,
        inReelsSurface: event.inReelsSurface,
        uncAgeYears: event.uncAgeYears,
      }));
    });
    const id = setInterval(() => {
      refreshSnapshot();
    }, 15_000);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [refreshSnapshot]);

  const deviceOs: DeviceOs = Platform.OS === "ios" ? "ios" : "android";

  const audit = useMemo(
    () =>
      computeUncAudit({
        reelsScrolled: snapshot.reelsScrolled,
        reelsLiked: snapshot.reelsLiked,
        commentsReadOrPosted: snapshot.commentsReadOrPosted,
        sharesDmed: snapshot.sharesDmed,
        activeScrollSeconds: snapshot.activeScrollSeconds,
        fastestSkipMs: snapshot.fastestSkipMs,
        longestRotStreakMins: snapshot.longestRotStreakMins,
        deviceOs,
        calibrationReelsPerMinute: calibrationRpm,
        activeMinutesIos: snapshot.activeMinutes,
      }),
    [snapshot, deviceOs, calibrationRpm]
  );

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      snapshot,
      audit,
      calibrationRpm,
      rivalHandle,
      setRivalHandle,
      refreshSnapshot,
    }),
    [profile, snapshot, audit, calibrationRpm, rivalHandle, refreshSnapshot]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
