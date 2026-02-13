const path = require('path');
const fs = require('fs');

function requireExpoMetroConfig() {
  try {
    return require('expo/metro-config');
  } catch (err) {
    const mobileNodeModules = path.resolve(__dirname, 'mobile', 'node_modules');
    const rootNodeModules = path.resolve(__dirname, 'node_modules');
    const resolved = require.resolve('expo/metro-config', {
      paths: [mobileNodeModules, rootNodeModules],
    });
    return require(resolved);
  }
}

const { getDefaultConfig } = requireExpoMetroConfig();

const workspaceRoot = __dirname;
const mobileRoot = path.resolve(workspaceRoot, 'mobile');
const projectRoot = fs.existsSync(mobileRoot) ? mobileRoot : workspaceRoot;

const config = getDefaultConfig(projectRoot);
config.watchFolders = projectRoot === workspaceRoot ? [] : [workspaceRoot];
config.resolver.nodeModulesPaths = Array.from(
  new Set([
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ])
);
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
