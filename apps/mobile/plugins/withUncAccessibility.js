const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
  AndroidConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SERVICE_NAME = "com.uncstats.app.UncAccessibilityService";
const PACKAGE_CLASS = "com.uncstats.app.UncTelemetryPackage";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyTree(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else {
      ensureDir(path.dirname(to));
      fs.copyFileSync(from, to);
    }
  }
}

function injectPackage(contents) {
  if (contents.includes("UncTelemetryPackage")) return contents;

  // Kotlin MainApplication (Expo SDK 52+)
  if (contents.includes("PackageList(this).packages.apply")) {
    return contents.replace(
      /PackageList\(this\)\.packages\.apply\s*\{/,
      `PackageList(this).packages.apply {\n              add(${PACKAGE_CLASS}())`
    );
  }
  if (contents.includes("return PackageList(this).packages")) {
    return contents.replace(
      "return PackageList(this).packages",
      `val packages = PackageList(this).packages\n            packages.add(${PACKAGE_CLASS}())\n            return packages`
    );
  }

  // Java MainApplication
  if (contents.includes("packages.add(")) {
    return contents.replace(
      /packages\.add\(([^)]+)\);/,
      (match) => `${match}\n      packages.add(new ${PACKAGE_CLASS}());`
    );
  }
  if (contents.includes("return packages;")) {
    return contents.replace(
      "return packages;",
      `packages.add(new ${PACKAGE_CLASS}());\n    return packages;`
    );
  }
  return contents;
}

/**
 * Expo config plugin: wires UncAccessibilityService, resources, and RN package.
 */
const withUncAccessibility = (config) => {
  config = AndroidConfig.Permissions.withPermissions(config, [
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.INTERNET",
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    if (!app.service) app.service = [];
    const exists = app.service.some(
      (s) => s.$?.["android:name"] === SERVICE_NAME
    );
    if (!exists) {
      app.service.push({
        $: {
          "android:name": SERVICE_NAME,
          "android:exported": "false",
          "android:label": "@string/unc_accessibility_service_label",
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "android.accessibilityservice.AccessibilityService",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": "@xml/accessibility_service_config",
            },
          },
        ],
      });
    }

    return cfg;
  });

  config = withMainApplication(config, (cfg) => {
    cfg.modResults.contents = injectPackage(cfg.modResults.contents);
    return cfg;
  });

  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const androidRoot = cfg.modRequest.platformProjectRoot;
      const srcJava = path.join(
        projectRoot,
        "android/app/src/main/java/com/uncstats/app"
      );
      const destJava = path.join(
        androidRoot,
        "app/src/main/java/com/uncstats/app"
      );
      const srcRes = path.join(projectRoot, "android/app/src/main/res");
      const destRes = path.join(androidRoot, "app/src/main/res");

      copyTree(srcJava, destJava);
      const xmlSrc = path.join(srcRes, "xml");
      const valuesSrc = path.join(srcRes, "values");
      if (fs.existsSync(xmlSrc)) copyTree(xmlSrc, path.join(destRes, "xml"));
      if (fs.existsSync(valuesSrc)) {
        const stringsSrc = path.join(valuesSrc, "strings.xml");
        const stringsDest = path.join(destRes, "values/strings.xml");
        if (fs.existsSync(stringsSrc)) {
          ensureDir(path.dirname(stringsDest));
          if (fs.existsSync(stringsDest)) {
            let existing = fs.readFileSync(stringsDest, "utf8");
            const incoming = fs.readFileSync(stringsSrc, "utf8");
            const uncDesc = incoming.match(
              /<string name="unc_accessibility_service_description">[\s\S]*?<\/string>/
            );
            const uncLabel = incoming.match(
              /<string name="unc_accessibility_service_label">[\s\S]*?<\/string>/
            );
            if (
              uncDesc &&
              !existing.includes("unc_accessibility_service_description")
            ) {
              existing = existing.replace(
                "</resources>",
                `    ${uncDesc[0]}\n</resources>`
              );
            }
            if (
              uncLabel &&
              !existing.includes("unc_accessibility_service_label")
            ) {
              existing = existing.replace(
                "</resources>",
                `    ${uncLabel[0]}\n</resources>`
              );
            }
            fs.writeFileSync(stringsDest, existing);
          } else {
            fs.copyFileSync(stringsSrc, stringsDest);
          }
        }
      }
      return cfg;
    },
  ]);

  return config;
};

module.exports = withUncAccessibility;
