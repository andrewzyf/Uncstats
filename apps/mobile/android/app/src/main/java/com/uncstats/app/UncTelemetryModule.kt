package com.uncstats.app

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject

class UncTelemetryModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val EVENT_NAME = "UncTelemetryUpdate"

        @Volatile
        private var sharedContext: ReactApplicationContext? = null

        fun emitTelemetry(statsJson: String, reason: String) {
            val ctx = sharedContext ?: return
            if (!ctx.hasActiveReactInstance()) return
            try {
                val json = JSONObject(statsJson)
                val map: WritableMap = Arguments.createMap()
                map.putString("reason", reason)
                map.putInt("reelsScrolled", json.optInt("reelsScrolled", 0))
                map.putInt("reelsLiked", json.optInt("reelsLiked", 0))
                map.putInt("commentsReadOrPosted", json.optInt("commentsReadOrPosted", 0))
                map.putInt("sharesDmed", json.optInt("sharesDmed", 0))
                map.putInt("activeScrollSeconds", json.optInt("activeScrollSeconds", 0))
                map.putInt("fastestSkipMs", json.optInt("fastestSkipMs", 0))
                map.putInt("longestRotStreakMins", json.optInt("longestRotStreakMins", 0))
                map.putBoolean("inReelsSurface", json.optBoolean("inReelsSurface", false))
                map.putDouble("uncAgeYears", json.optDouble("uncAgeYears", 18.0))
                map.putString("raw", statsJson)

                ctx
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_NAME, map)
            } catch (_: Exception) {
            }
        }
    }

    init {
        sharedContext = reactContext
    }

    override fun getName(): String = "UncTelemetry"

    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        try {
            promise.resolve(UncAccessibilityService.isRunning())
        } catch (e: Exception) {
            promise.reject("UNC_A11Y_STATUS", e)
        }
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UNC_A11Y_SETTINGS", e)
        }
    }

    @ReactMethod
    fun getSnapshot(promise: Promise) {
        try {
            val service = UncAccessibilityService.instance
            if (service == null) {
                val empty = Arguments.createMap()
                empty.putInt("reelsScrolled", 0)
                empty.putInt("reelsLiked", 0)
                empty.putInt("commentsReadOrPosted", 0)
                empty.putInt("sharesDmed", 0)
                empty.putInt("activeScrollSeconds", 0)
                empty.putInt("fastestSkipMs", 0)
                empty.putInt("longestRotStreakMins", 0)
                empty.putBoolean("serviceRunning", false)
                promise.resolve(empty)
                return
            }
            val json = JSONObject(service.getStatsJson())
            val map = Arguments.createMap()
            map.putInt("reelsScrolled", json.optInt("reelsScrolled", 0))
            map.putInt("reelsLiked", json.optInt("reelsLiked", 0))
            map.putInt("commentsReadOrPosted", json.optInt("commentsReadOrPosted", 0))
            map.putInt("sharesDmed", json.optInt("sharesDmed", 0))
            map.putInt("activeScrollSeconds", json.optInt("activeScrollSeconds", 0))
            map.putInt("fastestSkipMs", json.optInt("fastestSkipMs", 0))
            map.putInt("longestRotStreakMins", json.optInt("longestRotStreakMins", 0))
            map.putBoolean("inReelsSurface", json.optBoolean("inReelsSurface", false))
            map.putDouble("uncAgeYears", json.optDouble("uncAgeYears", 18.0))
            map.putBoolean("serviceRunning", true)
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("UNC_SNAPSHOT", e)
        }
    }

    @ReactMethod
    fun resetSession(promise: Promise) {
        try {
            UncAccessibilityService.instance?.resetStats()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UNC_RESET", e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN built-in EventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN built-in EventEmitter
    }
}
