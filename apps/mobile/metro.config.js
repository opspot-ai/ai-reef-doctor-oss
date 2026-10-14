// Metro config for an Expo app inside a pnpm monorepo.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so @reef/shared (TS source) is bundled.
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

// Resolve from the app's node_modules first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// pnpm's symlinked layout can resolve DUPLICATE copies of singletons, which
// breaks the module runtime (e.g. "Property 'MessageQueue' doesn't exist").
// Force every import of these to the app's single copy.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
};

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
