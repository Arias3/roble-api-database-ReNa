const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 👇 Permite a Metro procesar el código de tu librería
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

config.resolver.sourceExts.push('cjs'); // soporta archivos CommonJS
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-babel-transformer'),
};

module.exports = config;
