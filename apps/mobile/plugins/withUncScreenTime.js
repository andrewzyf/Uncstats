const {
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const APP_GROUP = "group.com.uncstats.app";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * Expo config plugin: FamilyControls entitlements, App Group, and Swift bridge copy.
 */
const withUncScreenTime = (config) => {
  config = withEntitlementsPlist(config, (cfg) => {
    cfg.modResults["com.apple.developer.family-controls"] = true;
    const groups = cfg.modResults["com.apple.security.application-groups"] || [];
    if (!groups.includes(APP_GROUP)) {
      cfg.modResults["com.apple.security.application-groups"] = [...groups, APP_GROUP];
    }
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.NSFamilyControlsUsageDescription =
      cfg.modResults.NSFamilyControlsUsageDescription ||
      "UncStats measures Instagram Screen Time thresholds to estimate Reels doomscrolling for your Official Unc Audit.";
    return cfg;
  });

  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const srcDir = path.join(projectRoot, "ios/UncStats");
      const monitorSrc = path.join(projectRoot, "ios/UncActivityMonitor");
      const destDir = path.join(iosRoot, "UncStatsNative");
      const monitorDest = path.join(iosRoot, "UncActivityMonitor");

      ensureDir(destDir);
      ensureDir(monitorDest);

      for (const file of [
        "UncScreenTimeModule.swift",
        "UncScreenTimeModule.m",
        "FamilyActivityPickerBridge.swift",
        "UncFamilyPicker.m",
      ]) {
        copyFile(path.join(srcDir, file), path.join(destDir, file));
      }
      copyFile(
        path.join(monitorSrc, "UncActivityMonitor.swift"),
        path.join(monitorDest, "UncActivityMonitor.swift")
      );

      // Extension Info.plist
      const extPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>UncActivityMonitor</string>
  <key>CFBundleIdentifier</key>
  <string>com.uncstats.app.UncActivityMonitor</string>
  <key>CFBundleName</key>
  <string>UncActivityMonitor</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.deviceactivity.monitor-extension</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).UncActivityMonitor</string>
  </dict>
</dict>
</plist>
`;
      fs.writeFileSync(path.join(monitorDest, "Info.plist"), extPlist);

      const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.developer.family-controls</key>
  <true/>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP}</string>
  </array>
</dict>
</plist>
`;
      fs.writeFileSync(
        path.join(monitorDest, "UncActivityMonitor.entitlements"),
        entitlements
      );

      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    // Files are copied into the ios tree; developers add the DeviceActivity
    // monitor target once via Xcode (Family Controls capability required).
    // The Swift sources under UncStatsNative compile with the main app target
    // when using continuous native prebuild / CNG with autolinking stubs.
    cfg.modResults.addKnownRegion?.("en");
    return cfg;
  });

  return config;
};

module.exports = withUncScreenTime;
