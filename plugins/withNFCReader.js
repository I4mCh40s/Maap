// plugins/withNFCReader.js
const {
  withAndroidManifest,
  withMainApplication,
  createRunOncePlugin,
  AndroidConfig,
  withDangerousMod, // <-- We need this one for file copying
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const pkg = require('../package.json');

const withNFCReader = (config) => {
  // 1. Add the NFC permission to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    AndroidConfig.Permissions.addPermission(
      config.modResults,
      'android.permission.NFC'
    );
    return config;
  });

  // 2. Add our NFCPackage() to the getPackages() method in MainApplication.kt
  config = withMainApplication(config, (config) => {
    const mainApplication = config.modResults;
    // Get the package name from the config, which is safer
    const packageName = config.android.package;

    // Ensure imports are added using the correct package name
    if (!mainApplication.contents.includes(`import ${packageName}.NFCPackage`)) {
        mainApplication.contents = mainApplication.contents.replace(
            /import expo\.modules\.ReactNativeHostWrapper/g,
            `import expo.modules.ReactNativeHostWrapper\nimport ${packageName}.NFCPackage`
        );
    }

    // Add the package to the list
    if (!mainApplication.contents.includes('packages.add(NFCPackage())')) {
        mainApplication.contents = mainApplication.contents.replace(
            /val packages = PackageList\(this\)\.packages/g,
            `val packages = PackageList(this).packages\n            packages.add(NFCPackage())`
        );
    }
    return config;
  });

  // 3. This is the CORRECTED part for copying native files
  config = withDangerousMod(config, [
    'android', // We specify we're making an Android change
    (config) => {
      // Here we have safe access to the project root
      const projectRoot = config.modRequest.projectRoot;
      
      const androidRoot = path.join(projectRoot, 'android');
      const nativeFilesDir = path.join(projectRoot, 'native-files');

      // It's safer to get the package name from the config
      const packageName = config.android.package; 
      if (!packageName) {
        throw new Error("Could not find Android package name in app.json");
      }

      const destinationDir = path.join(
        androidRoot, 'app', 'src', 'main', 'java', ...packageName.split('.')
      );
      
      // Ensure the destination directory exists
      fs.mkdirSync(destinationDir, { recursive: true });

      // Copy each file
      fs.copyFileSync(
        path.join(nativeFilesDir, 'NFCModule.kt'),
        path.join(destinationDir, 'NFCModule.kt')
      );
      fs.copyFileSync(
        path.join(nativeFilesDir, 'NFCPackage.kt'),
        path.join(destinationDir, 'NFCPackage.kt')
      );
      
      return config;
    },
  ]);

  return config;
};

module.exports = createRunOncePlugin(withNFCReader, pkg.name, pkg.version);