import { NativeEventEmitter, NativeModules, Platform } from "react-native";

export interface TelemetrySnapshot {
  reelsScrolled: number;
  reelsLiked: number;
  commentsReadOrPosted: number;
  sharesDmed: number;
  activeScrollSeconds: number;
  fastestSkipMs: number;
  longestRotStreakMins: number;
  inReelsSurface?: boolean;
  uncAgeYears?: number;
  serviceRunning?: boolean;
  activeMinutes?: number;
  calibrationReelsPerMinute?: number;
  deviceOs?: "android" | "ios";
}

type TelemetryListener = (snapshot: TelemetrySnapshot & { reason?: string }) => void;

const LINKING_ERROR =
  "UncTelemetry native module is unavailable. Run expo prebuild and a custom dev client.";

const AndroidModule = NativeModules.UncTelemetry as
  | {
      isAccessibilityEnabled: () => Promise<boolean>;
      openAccessibilitySettings: () => Promise<boolean>;
      getSnapshot: () => Promise<TelemetrySnapshot>;
      resetSession: () => Promise<boolean>;
    }
  | undefined;

const IosScreenTime = NativeModules.UncScreenTime as
  | {
      requestAuthorization: () => Promise<{ status: string; authorized: boolean }>;
      getAuthorizationStatus: () => Promise<{ status: string; authorized: boolean }>;
      saveSelectionAndSchedule: (
        selectionBase64: string
      ) => Promise<{ scheduled: boolean; apps?: number }>;
      scheduleWithStoredSelection: () => Promise<{ scheduled: boolean }>;
      configureBridge: (config: Record<string, string | number>) => Promise<boolean>;
      getSnapshot: () => Promise<TelemetrySnapshot>;
    }
  | undefined;

const IosPicker = NativeModules.UncFamilyPicker as
  | {
      presentPicker: () => Promise<{ selectionBase64?: string; cancelled?: boolean }>;
    }
  | undefined;

function requireAndroid() {
  if (!AndroidModule) throw new Error(LINKING_ERROR);
  return AndroidModule;
}

export async function enableUncTelemetry(): Promise<{
  platform: "android" | "ios";
  openedSettings?: boolean;
  authorized?: boolean;
  scheduled?: boolean;
}> {
  if (Platform.OS === "android") {
    const mod = requireAndroid();
    const enabled = await mod.isAccessibilityEnabled();
    if (!enabled) {
      await mod.openAccessibilitySettings();
      return { platform: "android", openedSettings: true };
    }
    return { platform: "android", openedSettings: false };
  }

  if (Platform.OS === "ios") {
    if (!IosScreenTime || !IosPicker) throw new Error(LINKING_ERROR);
    const auth = await IosScreenTime.requestAuthorization();
    if (!auth.authorized) {
      return { platform: "ios", authorized: false };
    }
    const picked = await IosPicker.presentPicker();
    if (picked.cancelled || !picked.selectionBase64) {
      return { platform: "ios", authorized: true, scheduled: false };
    }
    await IosScreenTime.saveSelectionAndSchedule(picked.selectionBase64);
    return { platform: "ios", authorized: true, scheduled: true };
  }

  throw new Error("Unsupported platform");
}

export async function getTelemetrySnapshot(): Promise<TelemetrySnapshot> {
  if (Platform.OS === "android") {
    return requireAndroid().getSnapshot();
  }
  if (Platform.OS === "ios") {
    if (!IosScreenTime) throw new Error(LINKING_ERROR);
    return IosScreenTime.getSnapshot();
  }
  return {
    reelsScrolled: 0,
    reelsLiked: 0,
    commentsReadOrPosted: 0,
    sharesDmed: 0,
    activeScrollSeconds: 0,
    fastestSkipMs: 0,
    longestRotStreakMins: 0,
  };
}

export async function configureIosBridge(config: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  userId: string;
  reelsPerMinute?: number;
}): Promise<void> {
  if (Platform.OS !== "ios" || !IosScreenTime) return;
  await IosScreenTime.configureBridge({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    userId: config.userId,
    reelsPerMinute: config.reelsPerMinute ?? 10.8,
  });
}

export function subscribeTelemetry(listener: TelemetryListener): () => void {
  if (Platform.OS !== "android" || !AndroidModule) {
    return () => undefined;
  }
  const emitter = new NativeEventEmitter(NativeModules.UncTelemetry);
  const sub = emitter.addListener("UncTelemetryUpdate", listener);
  return () => sub.remove();
}

export async function resetAndroidSession(): Promise<void> {
  if (Platform.OS === "android") {
    await requireAndroid().resetSession();
  }
}
