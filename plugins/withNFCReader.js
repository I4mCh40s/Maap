// plugins/withNFCModule.js
const { withPlugins, withMainApplication, AndroidConfig } = require('@expo/config-plugins');
const withNFCModuleFiles = require('./withNFCModuleFiles'); // We'll create this next

// Helper function to add lines to a file if they don't already exist.
function addLines(content, linesToAdd) {
  let newContent = content;
  linesToAdd.forEach(line => {
    if (!newContent.includes(line)) {
      newContent = newContent.replace(/return packages/, `${line}\n            return packages`);
    }
  });
  return newContent;
}

const withNFCPackage = (config) => {
  return withMainApplication(config, async (config) => {
    let content = config.modResults.contents;

    // Add the import statement
    if (!content.includes('import com.vitalyiam.Maap.NFCPackage;')) {
      content = content.replace(
        /package com\.vitalyiam\.Maap/,
        `package com.vitalyiam.Maap\n\nimport com.vitalyiam.Maap.NFCPackage;`
      );
    }
    
    // Add the package to the list
    const linesToAdd = [
      '            packages.add(NFCPackage())'
    ];
    content = addLines(content, linesToAdd);

    config.modResults.contents = content;
    return config;
  });
};

// We chain our plugins together. The file copier runs first, then the package registration.
module.exports = (config) => withPlugins(config, [withNFCModuleFiles, withNFCPackage]);