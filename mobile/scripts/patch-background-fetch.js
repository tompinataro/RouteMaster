#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const bgFetchCandidatePaths = [
  path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-background-fetch',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'backgroundfetch',
    'BackgroundFetchTaskConsumer.java'
  ),
  path.join(
    __dirname,
    '..',
    'node_modules',
    'expo',
    'node_modules',
    'expo-background-fetch',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'backgroundfetch',
    'BackgroundFetchTaskConsumer.java'
  ),
];

const executeBlockNeedles = [
  '      TaskManagerUtilsInterface taskManagerUtils = getTaskManagerUtils();\n\n      if (context != null) {\n        taskManagerUtils.executeTask(mTask, null, null);\n      }',
  '      TaskManagerUtilsInterface taskManagerUtils = getTaskManagerUtils();\n\n      if (context != null) {\n        Bundle emptyData = new Bundle();\n        taskManagerUtils.executeTask(mTask, emptyData, null);\n      }',
  '      TaskManagerUtilsInterface taskManagerUtils = getTaskManagerUtils();\n\n      if (context != null) {\n        Bundle emptyData = new Bundle();\n        taskManagerUtils.executeTask(mTask, emptyData);\n      }'
];

const replacementBlock =
  '      if (context != null) {\n' +
  '        mTask.execute(null, null, new TaskExecutionCallback() {\n' +
  '          @Override\n' +
  '          public void onFinished(Map<String, Object> response) {\n' +
  '            // no-op\n' +
  '          }\n' +
  '        });\n' +
  '      }';

let appliedToAny = false;

for (const filePath of bgFetchCandidatePaths) {
  if (!fs.existsSync(filePath)) {
    continue;
  }

  let source = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  let blockReplaced = false;
  for (const needle of executeBlockNeedles) {
    if (source.includes(needle)) {
      source = source.replace(needle, replacementBlock);
      blockReplaced = true;
      break;
    }
  }
  if (blockReplaced) {
    modified = true;
    source = source.replace(
      '      TaskManagerUtilsInterface taskManagerUtils = getTaskManagerUtils();\n\n      if (context != null) {\n        mTask.execute(null, null, new TaskExecutionCallback() {\n',
      '      if (context != null) {\n        mTask.execute(null, null, new TaskExecutionCallback() {\n'
    );
    source = source.replace('import android.os.Bundle;\n', '');
  }

  if (modified) {
    fs.writeFileSync(filePath, source, 'utf8');
    appliedToAny = true;
    console.log('[patch-background-fetch] Patched', filePath);
  }
}

const permissionsPaths = [
  path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-modules-core',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'adapters',
    'react',
    'permissions',
    'PermissionsService.kt'
  ),
  path.join(
    __dirname,
    '..',
    'node_modules',
    'expo',
    'node_modules',
    'expo-modules-core',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'adapters',
    'react',
    'permissions',
    'PermissionsService.kt'
  ),
];

const permissionNeedle = '        return requestedPermissions.contains(permission)';
const permissionReplacement = '        return requestedPermissions?.contains(permission) == true';

let permissionsPatched = false;

for (const filePath of permissionsPaths) {
  if (!fs.existsSync(filePath)) {
    continue;
  }

  let source = fs.readFileSync(filePath, 'utf8');

  if (source.includes(permissionReplacement)) {
    permissionsPatched = true;
    continue;
  }

  if (source.includes(permissionNeedle)) {
    source = source.replace(permissionNeedle, permissionReplacement);
    fs.writeFileSync(filePath, source, 'utf8');
    permissionsPatched = true;
    console.log('[patch-background-fetch] Patched', filePath);
  }
}

if (!appliedToAny && !permissionsPatched) {
  console.log('[patch-background-fetch] No changes applied.');
}
