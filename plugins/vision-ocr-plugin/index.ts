import { ConfigPlugin, withDangerousMod } from '@expo/config-plugins';
import fs from 'fs';
import path from 'path';

const copyIfExists = (src: string, dest: string) => {
  if (!fs.existsSync(src)) return;
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
};

const plugin: ConfigPlugin = config => {
  // iOS: copy VisionOCR.swift and VisionOCRBridge.m into ios/ directory
  config = withDangerousMod(config, ["ios", async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const srcSwift = path.join(projectRoot, 'native', 'ios', 'VisionOCR.swift');
    const srcBridge = path.join(projectRoot, 'native', 'ios', 'VisionOCRBridge.m');
    const destSwift = path.join(projectRoot, 'ios', 'VisionOCR.swift');
    const destBridge = path.join(projectRoot, 'ios', 'VisionOCRBridge.m');
    try {
      copyIfExists(srcSwift, destSwift);
      copyIfExists(srcBridge, destBridge);
    } catch (e) {
      console.warn('VisionOCR plugin iOS copy failed', e);
    }
    return config;
  }]);

  // Android: copy all kotlin sources from native/android into the app java package
  config = withDangerousMod(config, ["android", async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const srcDir = path.join(projectRoot, 'native', 'android');
    const destDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'healthdiary', 'ocr');
    try {
      if (fs.existsSync(srcDir)) {
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const files = fs.readdirSync(srcDir);
        for (const f of files) {
          if (f.endsWith('.kt') || f.endsWith('.java')) {
            copyIfExists(path.join(srcDir, f), path.join(destDir, f));
          }
        }
      }
    } catch (e) {
      console.warn('VisionOCR plugin Android copy failed', e);
    }
    return config;
  }]);

  // Patch android/app/build.gradle to add ML Kit dependency if present
  config = withDangerousMod(config, ["android", async (config) => {
    try {
      const projectRoot = config.modRequest.projectRoot;
      const buildGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
      if (fs.existsSync(buildGradlePath)) {
        let content = fs.readFileSync(buildGradlePath, 'utf8');
        if (!content.match(/com\.google\.mlkit[: ]text-recognition/)) {
          // Try to safely insert implementation into the dependencies block
          const depBlockMatch = content.match(/dependencies\s*\{[\s\S]*?\n\}/);
          if (depBlockMatch) {
            const depBlock = depBlockMatch[0];
            const newDepBlock = depBlock.replace(/\n\}/, '\n    implementation "com.google.mlkit:text-recognition:16.0.0"\n}');
            content = content.replace(depBlock, newDepBlock);
            fs.writeFileSync(buildGradlePath, content, 'utf8');
          } else {
            // Fallback: append implementation at end
            content += '\ndependencies {\n    implementation "com.google.mlkit:text-recognition:16.0.0"\n}\n';
            fs.writeFileSync(buildGradlePath, content, 'utf8');
          }
        }
      }
    } catch (e) {
      console.warn('VisionOCR plugin patch build.gradle failed', e);
    }
    return config;
  }]);

  return config;
};

export default plugin;
