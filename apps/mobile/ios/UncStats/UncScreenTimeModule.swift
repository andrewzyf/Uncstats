import DeviceActivity
import FamilyControls
import Foundation
import React
import SwiftUI

@objc(UncScreenTime)
class UncScreenTimeModule: NSObject {

    private let center = AuthorizationCenter.shared
    private let activityCenter = DeviceActivityCenter()
    private let encoder = PropertyListEncoder()

    @objc
    static func requiresMainQueueSetup() -> Bool { true }

    @objc
    func requestAuthorization(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        Task { @MainActor in
            do {
                try await center.requestAuthorization(for: .individual)
                resolve([
                    "status": Self.statusString(center.authorizationStatus),
                    "authorized": center.authorizationStatus == .approved,
                ])
            } catch {
                reject("UNC_SCREENTIME_AUTH", error.localizedDescription, error)
            }
        }
    }

    @objc
    func getAuthorizationStatus(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve([
            "status": Self.statusString(center.authorizationStatus),
            "authorized": center.authorizationStatus == .approved,
        ])
    }

    /// Persist FamilyActivitySelection tokens from the picker + schedule 1-min events.
    @objc
    func saveSelectionAndSchedule(
        _ selectionBase64: String,
        resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            guard let data = Data(base64Encoded: selectionBase64) else {
                reject("UNC_SELECTION", "Invalid selection payload", nil)
                return
            }
            let selection = try PropertyListDecoder().decode(
                FamilyActivitySelection.self,
                from: data
            )
            let defaults = UncAppGroup.defaults
            defaults.set(data, forKey: "unc_family_selection")

            try scheduleDailyMinuteThresholds(selection: selection)
            resolve(["scheduled": true, "apps": selection.applicationTokens.count])
        } catch {
            reject("UNC_SCHEDULE", error.localizedDescription, error)
        }
    }

    @objc
    func scheduleWithStoredSelection(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            guard
                let data = UncAppGroup.defaults.data(forKey: "unc_family_selection")
            else {
                reject("UNC_SELECTION_MISSING", "No FamilyActivitySelection stored", nil)
                return
            }
            let selection = try PropertyListDecoder().decode(
                FamilyActivitySelection.self,
                from: data
            )
            try scheduleDailyMinuteThresholds(selection: selection)
            resolve(["scheduled": true])
        } catch {
            reject("UNC_SCHEDULE", error.localizedDescription, error)
        }
    }

    @objc
    func configureBridge(
        _ config: NSDictionary,
        resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let defaults = UncAppGroup.defaults
        if let url = config["supabaseUrl"] as? String {
            defaults.set(url, forKey: UncAppGroup.supabaseUrlKey)
        }
        if let key = config["supabaseAnonKey"] as? String {
            defaults.set(key, forKey: UncAppGroup.supabaseAnonKey)
        }
        if let userId = config["userId"] as? String {
            defaults.set(userId, forKey: UncAppGroup.userIdKey)
        }
        if let rpm = config["reelsPerMinute"] as? Double {
            defaults.set(rpm, forKey: UncAppGroup.reelsPerMinuteKey)
        } else if defaults.double(forKey: UncAppGroup.reelsPerMinuteKey) == 0 {
            defaults.set(
                UncAppGroup.defaultReelsPerMinute,
                forKey: UncAppGroup.reelsPerMinuteKey
            )
        }
        resolve(true)
    }

    @objc
    func getSnapshot(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let defaults = UncAppGroup.defaults
        let minutes = defaults.integer(forKey: UncAppGroup.minutesKey)
        let rpm = defaults.double(forKey: UncAppGroup.reelsPerMinuteKey)
        let multiplier = rpm > 0 ? rpm : UncAppGroup.defaultReelsPerMinute
        let estimated = defaults.object(forKey: "unc_estimated_reels") as? Int
            ?? Int((Double(minutes) * multiplier).rounded(.down))

        resolve([
            "activeMinutes": minutes,
            "activeScrollSeconds": minutes * 60,
            "reelsScrolled": estimated,
            "reelsLiked": 0,
            "commentsReadOrPosted": 0,
            "sharesDmed": 0,
            "fastestSkipMs": 0,
            "longestRotStreakMins": minutes,
            "calibrationReelsPerMinute": multiplier,
            "deviceOs": "ios",
        ])
    }

    private func scheduleDailyMinuteThresholds(selection: FamilyActivitySelection) throws {
        activityCenter.stopMonitoring([.uncDaily])

        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 0, minute: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59),
            repeats: true
        )

        // Threshold every 1 minute of Instagram (or selected apps) activity.
        var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
        // Register progressive 1..180 minute thresholds for the day.
        for minute in 1...180 {
            let name = DeviceActivityEvent.Name("uncstats.minute.\(minute)")
            events[name] = DeviceActivityEvent(
                applications: selection.applicationTokens,
                categories: selection.categoryTokens,
                webDomains: selection.webDomainTokens,
                threshold: DateComponents(minute: minute)
            )
        }

        try activityCenter.startMonitoring(.uncDaily, during: schedule, events: events)
    }

    private static func statusString(_ status: AuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .approved: return "approved"
        @unknown default: return "unknown"
        }
    }
}
