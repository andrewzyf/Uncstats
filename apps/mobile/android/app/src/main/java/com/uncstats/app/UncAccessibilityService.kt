package com.uncstats.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.TextView
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Exact Instagram Reels telemetry via AccessibilityService.
 * Targets com.instagram.android only (see accessibility_service_config.xml).
 */
class UncAccessibilityService : AccessibilityService() {

    companion object {
        const val IG_PACKAGE = "com.instagram.android"
        const val SCROLL_DEBOUNCE_MS = 350L
        const val REELS_PAGER_ID = "clips_viewer_view_pager"
        const val LIKE_ID = "row_feed_button_like"
        const val COMMENT_ID = "row_feed_button_comment"
        const val SHARE_ID = "row_feed_button_share"

        @Volatile
        var instance: UncAccessibilityService? = null
            private set

        fun isRunning(): Boolean = instance != null
    }

    data class SessionStats(
        var reelsScrolled: Int = 0,
        var reelsLiked: Int = 0,
        var commentsReadOrPosted: Int = 0,
        var sharesDmed: Int = 0,
        var activeScrollSeconds: Int = 0,
        var fastestSkipMs: Int = 0,
        var longestRotStreakMins: Int = 0,
        var lastSwipeAtMs: Long = 0L,
        var sessionStartedAtMs: Long = 0L,
        var currentRotStartedAtMs: Long = 0L,
    )

    private val mainHandler = Handler(Looper.getMainLooper())
    private val stats = SessionStats()
    private val pillVisible = AtomicBoolean(false)

    private var windowManager: WindowManager? = null
    private var pillView: TextView? = null
    private var pillParams: WindowManager.LayoutParams? = null
    private var lastScrollAcceptedAt = 0L
    private var inReelsSurface = false
    private var activeTickRunnable: Runnable? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this

        serviceInfo = serviceInfo?.apply {
            eventTypes =
                AccessibilityEvent.TYPE_VIEW_SCROLLED or
                AccessibilityEvent.TYPE_VIEW_CLICKED or
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = flags or
                AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or
                AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            packageNames = arrayOf(IG_PACKAGE)
            notificationTimeout = 100
        }

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        ensurePill()
        startActiveTicker()
        emitSnapshot("service_connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.packageName?.toString() != IG_PACKAGE) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                inReelsSurface = detectReelsSurface(rootInActiveWindow)
                updatePillVisibility()
            }
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> handleScroll(event)
            AccessibilityEvent.TYPE_VIEW_CLICKED -> handleClick(event)
        }
    }

    override fun onInterrupt() {
        // no-op — service may resume
    }

    override fun onDestroy() {
        stopActiveTicker()
        removePill()
        instance = null
        super.onDestroy()
    }

    fun getStatsJson(): String {
        syncActiveSeconds()
        return JSONObject()
            .put("reelsScrolled", stats.reelsScrolled)
            .put("reelsLiked", stats.reelsLiked)
            .put("commentsReadOrPosted", stats.commentsReadOrPosted)
            .put("sharesDmed", stats.sharesDmed)
            .put("activeScrollSeconds", stats.activeScrollSeconds)
            .put("fastestSkipMs", stats.fastestSkipMs)
            .put("longestRotStreakMins", stats.longestRotStreakMins)
            .put("inReelsSurface", inReelsSurface)
            .put("uncAgeYears", computeUncAge())
            .toString()
    }

    fun resetStats() {
        stats.reelsScrolled = 0
        stats.reelsLiked = 0
        stats.commentsReadOrPosted = 0
        stats.sharesDmed = 0
        stats.activeScrollSeconds = 0
        stats.fastestSkipMs = 0
        stats.longestRotStreakMins = 0
        stats.lastSwipeAtMs = 0L
        stats.sessionStartedAtMs = 0L
        stats.currentRotStartedAtMs = 0L
        updatePillText()
        emitSnapshot("reset")
    }

    private fun handleScroll(event: AccessibilityEvent) {
        val source = event.source
        val isReelsPager = isReelsScrollSource(source, event)
        source?.recycle()

        if (!isReelsPager && !inReelsSurface) return
        if (!isVerticalScroll(event)) return

        val now = SystemClock.elapsedRealtime()
        if (now - lastScrollAcceptedAt < SCROLL_DEBOUNCE_MS) return
        lastScrollAcceptedAt = now

        inReelsSurface = true
        if (stats.sessionStartedAtMs == 0L) {
            stats.sessionStartedAtMs = now
            stats.currentRotStartedAtMs = now
        }

        if (stats.lastSwipeAtMs > 0L) {
            val delta = (now - stats.lastSwipeAtMs).toInt()
            if (delta > 0 && (stats.fastestSkipMs == 0 || delta < stats.fastestSkipMs)) {
                stats.fastestSkipMs = delta
            }
            // Rot streak breaks if idle > 90s between swipes
            if (delta > 90_000) {
                finalizeRotStreak(stats.lastSwipeAtMs)
                stats.currentRotStartedAtMs = now
            }
        } else {
            stats.currentRotStartedAtMs = now
        }

        stats.lastSwipeAtMs = now
        stats.reelsScrolled += 1
        updatePillVisibility()
        updatePillText()
        emitSnapshot("reel_scrolled")
    }

    private fun handleClick(event: AccessibilityEvent) {
        val source = event.source ?: return
        try {
            val viewId = source.viewIdResourceName?.lowercase().orEmpty()
            val desc = (source.contentDescription?.toString() ?: "").lowercase()
            val text = collectNodeText(source).lowercase()
            val blob = "$viewId $desc $text"

            when {
                viewId.contains(LIKE_ID) || blob.contains("like") && !blob.contains("unlike") -> {
                    stats.reelsLiked += 1
                    emitSnapshot("like")
                }
                viewId.contains(COMMENT_ID) || blob.contains("comment") -> {
                    stats.commentsReadOrPosted += 1
                    emitSnapshot("comment")
                }
                viewId.contains(SHARE_ID) || blob.contains("share") || blob.contains("send") -> {
                    stats.sharesDmed += 1
                    emitSnapshot("share")
                }
            }
            updatePillText()
        } finally {
            source.recycle()
        }
    }

    private fun isReelsScrollSource(source: AccessibilityNodeInfo?, event: AccessibilityEvent): Boolean {
        val className = event.className?.toString().orEmpty()
        val sourceId = source?.viewIdResourceName.orEmpty()

        if (sourceId.contains(REELS_PAGER_ID, ignoreCase = true)) return true
        if (className.contains("ViewPager", ignoreCase = true)) return true
        if (className.contains("RecyclerView", ignoreCase = true) && inReelsSurface) return true

        // Walk ancestors for clips viewer pager id
        var node = source
        var depth = 0
        while (node != null && depth < 8) {
            val id = node.viewIdResourceName.orEmpty()
            if (id.contains(REELS_PAGER_ID, ignoreCase = true)) return true
            val parent = node.parent
            if (node !== source) node.recycle()
            node = parent
            depth++
        }
        return false
    }

    private fun isVerticalScroll(event: AccessibilityEvent): Boolean {
        // Prefer vertical deltas; Instagram Reels are vertical pagers.
        if (event.scrollDeltaY != 0) return true
        // Some OEMs omit deltas — accept scroll events inside Reels surface.
        return inReelsSurface || event.itemCount > 0
    }

    private fun detectReelsSurface(root: AccessibilityNodeInfo?): Boolean {
        if (root == null) return false
        try {
            val nodes = root.findAccessibilityNodeInfosByViewId("$IG_PACKAGE:id/$REELS_PAGER_ID")
            if (!nodes.isNullOrEmpty()) {
                nodes.forEach { it.recycle() }
                return true
            }
            // Fallback: full-screen pager / "Reels" chrome
            val reelsLabels = root.findAccessibilityNodeInfosByText("Reels")
            val found = !reelsLabels.isNullOrEmpty()
            reelsLabels?.forEach { it.recycle() }
            return found
        } finally {
            root.recycle()
        }
    }

    private fun collectNodeText(node: AccessibilityNodeInfo): String {
        val parts = mutableListOf<String>()
        node.text?.let { parts.add(it.toString()) }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            child.text?.let { parts.add(it.toString()) }
            child.recycle()
        }
        return parts.joinToString(" ")
    }

    private fun finalizeRotStreak(endedAtMs: Long) {
        if (stats.currentRotStartedAtMs <= 0L) return
        val mins = ((endedAtMs - stats.currentRotStartedAtMs) / 60_000L).toInt()
        if (mins > stats.longestRotStreakMins) {
            stats.longestRotStreakMins = mins
        }
    }

    private fun syncActiveSeconds() {
        if (stats.sessionStartedAtMs <= 0L) return
        val now = SystemClock.elapsedRealtime()
        // Only count time while recently swiping (within 90s)
        if (stats.lastSwipeAtMs > 0L && now - stats.lastSwipeAtMs <= 90_000L) {
            val span = ((now - stats.sessionStartedAtMs) / 1000L).toInt()
            stats.activeScrollSeconds = span
            finalizeRotStreak(now)
        }
    }

    private fun computeUncAge(): Double {
        val age = 18.0 + stats.reelsScrolled * 0.08 + stats.longestRotStreakMins * 0.25
        return minOf(74.0, age)
    }

    private fun startActiveTicker() {
        stopActiveTicker()
        val runnable = object : Runnable {
            override fun run() {
                syncActiveSeconds()
                updatePillText()
                mainHandler.postDelayed(this, 5_000L)
            }
        }
        activeTickRunnable = runnable
        mainHandler.postDelayed(runnable, 5_000L)
    }

    private fun stopActiveTicker() {
        activeTickRunnable?.let { mainHandler.removeCallbacks(it) }
        activeTickRunnable = null
    }

    private fun ensurePill() {
        if (pillView != null) return
        val tv = TextView(this).apply {
            text = "[UNC: 0 REELS | 18 Y/O]"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#111111"))
            setPadding(28, 16, 28, 16)
            textSize = 12f
            typeface = Typeface.MONOSPACE
            setShadowLayer(0f, 0f, 0f, 0)
            alpha = 0.92f
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = 120
        }

        var dragX = 0
        var dragY = 0
        tv.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    dragX = event.rawX.toInt()
                    dragY = event.rawY.toInt()
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX.toInt() - dragX
                    val dy = event.rawY.toInt() - dragY
                    dragX = event.rawX.toInt()
                    dragY = event.rawY.toInt()
                    params.x += dx
                    params.y += dy
                    // switch to absolute once dragged
                    params.gravity = Gravity.TOP or Gravity.START
                    windowManager?.updateViewLayout(v, params)
                    true
                }
                else -> false
            }
        }

        // Accent separator via spannable-like color: orange count prefix
        tv.setTextColor(Color.WHITE)

        pillView = tv
        pillParams = params
    }

    private fun updatePillVisibility() {
        val wm = windowManager ?: return
        val view = pillView ?: return
        val params = pillParams ?: return

        if (inReelsSurface) {
            if (pillVisible.compareAndSet(false, true)) {
                try {
                    wm.addView(view, params)
                } catch (_: Exception) {
                    pillVisible.set(false)
                }
            }
        } else {
            if (pillVisible.compareAndSet(true, false)) {
                try {
                    wm.removeView(view)
                } catch (_: Exception) {
                    // already removed
                }
            }
        }
    }

    private fun updatePillText() {
        val age = computeUncAge().toInt()
        val text = "[UNC: ${stats.reelsScrolled} REELS | $age Y/O]"
        mainHandler.post {
            pillView?.apply {
                this.text = text
                // Warning orange for the numeric emphasis via full tint pulse
                setTextColor(
                    if (stats.reelsScrolled >= 200) Color.parseColor("#FF4F00")
                    else Color.WHITE
                )
            }
        }
    }

    private fun removePill() {
        val wm = windowManager
        val view = pillView
        if (wm != null && view != null && pillVisible.get()) {
            try {
                wm.removeView(view)
            } catch (_: Exception) {
            }
        }
        pillVisible.set(false)
        pillView = null
        pillParams = null
    }

    private fun emitSnapshot(reason: String) {
        UncTelemetryModule.emitTelemetry(getStatsJson(), reason)
    }
}
