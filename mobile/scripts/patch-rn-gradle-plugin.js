const fs = require('fs');
const path = require('path');

const pluginFile = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'build.gradle.kts'
);

try {
  const original = fs.readFileSync(pluginFile, 'utf8');
  if (!original.includes('allWarningsAsErrors')) {
    console.log('[patch-rn-gradle-plugin] No allWarningsAsErrors flag found, skipping.');
    process.exit(0);
  }
  const updated = original.replace(
    /allWarningsAsErrors\s*=\s*true/g,
    'allWarningsAsErrors = false'
  );
  if (updated !== original) {
    fs.writeFileSync(pluginFile, updated);
    console.log('[patch-rn-gradle-plugin] Disabled allWarningsAsErrors in gradle plugin.');
  } else {
    console.log('[patch-rn-gradle-plugin] No changes needed.');
  }
} catch (error) {
  console.warn('[patch-rn-gradle-plugin] Failed to patch gradle plugin:', error.message);
}
