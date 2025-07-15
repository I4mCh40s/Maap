const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // This is the key part:
  // We are telling the Webpack Dev Server to listen on all network interfaces.
  if (config.devServer) {
    config.devServer.host = '0.0.0.0';
  }

  return config;
};