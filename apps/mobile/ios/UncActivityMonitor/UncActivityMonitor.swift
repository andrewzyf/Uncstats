import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

/// Shared App Group for Screen Time minute counters + calibration multiplier.
enum UncAppGroup {
    static let id = "group.com.uncstats.app"
    static let minutesKey = "unc_instagram_active_minutes"
    static let lastThresholdKey = "unc_last_threshold_at"
    static let reelsPerMinuteKey = "unc_reels_per_minute"
    static let supabaseUrlKey = "unc_supabase_url"
    static let supabaseAnonKey = "unc_supabase_anon_key"
    static let userIdKey = "unc_user_id"
    static let defaultReelsPerMinute = 10.8

    static var defaults: UserDefaults {
        UserDefaults(suiteName: id) ?? .standard
    }
}

/// DeviceActivityMonitor extension — fires every 1 minute of Instagram activity.
public class UncActivityMonitor: DeviceActivityMonitor {
    public override init() {
        super.init()
    }

    public override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        // Daily window opened — keep existing cumulative minutes for the calendar day.
        let calendar = Calendar.current
        let dayKey = Self.dayStamp()
        let storedDay = UncAppGroup.defaults.string(forKey: "unc_day_stamp")
        if storedDay != dayKey {
            UncAppGroup.defaults.set(0, forKey: UncAppGroup.minutesKey)
            UncAppGroup.defaults.set(dayKey, forKey: "unc_day_stamp")
        }
    }

    public override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
    }

    public override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.eventDidReachThreshold(event, activity: activity)

        let defaults = UncAppGroup.defaults
        let minutes = defaults.integer(forKey: UncAppGroup.minutesKey) + 1
        defaults.set(minutes, forKey: UncAppGroup.minutesKey)
        defaults.set(Date().timeIntervalSince1970, forKey: UncAppGroup.lastThresholdKey)

        let rpm = defaults.double(forKey: UncAppGroup.reelsPerMinuteKey)
        let multiplier = rpm > 0 ? rpm : UncAppGroup.defaultReelsPerMinute
        let estimatedReels = Int((Double(minutes) * multiplier).rounded(.down))

        // Persist estimated reels for the RN bridge to read on next foreground.
        defaults.set(estimatedReels, forKey: "unc_estimated_reels")
        defaults.set(minutes * 60, forKey: "unc_active_scroll_seconds")

        postToSupabase(
            activeMinutes: minutes,
            estimatedReels: estimatedReels,
            activeScrollSeconds: minutes * 60
        )
    }

    public override func eventWillReachThresholdWarning(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.eventWillReachThresholdWarning(event, activity: activity)
    }

    private func postToSupabase(
        activeMinutes: Int,
        estimatedReels: Int,
        activeScrollSeconds: Int
    ) {
        let defaults = UncAppGroup.defaults
        guard
            let base = defaults.string(forKey: UncAppGroup.supabaseUrlKey),
            let anon = defaults.string(forKey: UncAppGroup.supabaseAnonKey),
            let userId = defaults.string(forKey: UncAppGroup.userIdKey),
            !base.isEmpty,
            !anon.isEmpty,
            !userId.isEmpty,
            let url = URL(string: "\(base.trimmingCharacters(in: CharacterSet(charactersIn: "/")))/rest/v1/rpc/upsert_daily_stats")
        else {
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(anon, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anon)", forHTTPHeaderField: "Authorization")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")

        // Send a 1-minute delta so the SQL upsert increments correctly.
        // We track last_posted_minutes to compute the delta.
        let lastPosted = defaults.integer(forKey: "unc_last_posted_minutes")
        let deltaMinutes = max(1, activeMinutes - lastPosted)
        let rpm = defaults.double(forKey: UncAppGroup.reelsPerMinuteKey)
        let multiplier = rpm > 0 ? rpm : UncAppGroup.defaultReelsPerMinute
        let deltaReels = Int((Double(deltaMinutes) * multiplier).rounded(.down))

        let body: [String: Any] = [
            "p_user_id": userId,
            "p_reels_scrolled": deltaReels,
            "p_reels_liked": 0,
            "p_comments_read_or_posted": 0,
            "p_shares_dmed": 0,
            "p_active_scroll_seconds": deltaMinutes * 60,
            "p_fastest_skip_ms": NSNull(),
            "p_longest_rot_streak_mins": activeMinutes,
        ]

        request.httpBody = try? JSONSerialization.data(withJSONObject: body, options: [])

        let task = URLSession.shared.dataTask(with: request) { _, response, _ in
            if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                defaults.set(activeMinutes, forKey: "unc_last_posted_minutes")
            }
        }
        task.resume()
    }

    private static func dayStamp() -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
}

extension DeviceActivityName {
    static let uncDaily = Self("uncstats.daily")
}

extension DeviceActivityEvent.Name {
    static let uncMinute = Self("uncstats.minute")
}
