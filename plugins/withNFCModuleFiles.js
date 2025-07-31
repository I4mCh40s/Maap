// plugins/withNFCModuleFiles.js
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNFCModuleFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;
      const sourceDir = path.join(config.modRequest.projectRoot, 'native-files');
      const destinationDir = path.join(
        androidRoot, 'app', 'src', 'main', 'java', 'com', 'vitalyiam', 'Maap'
      );
      // Ensure the destination directory exists
      fs.mkdirSync(destinationDir, { recursive: true });

      const filesToCopy = fs.readdirSync(sourceDir);

      filesToCopy.forEach((fileName) => {
        const sourcePath = path.join(sourceDir, fileName);
        const destinationPath = path.join(destinationDir, fileName);
        console.log(`Copying NFC module file from ${sourcePath} to ${destinationPath}`);
        fs.copyFileSync(sourcePath, destinationPath);
      });
      return config;
    },
  ]);
};

module.exports = withNFCModuleFiles;