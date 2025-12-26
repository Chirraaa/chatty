// plugins/withAndroidPiP.js - Expo config plugin for Android PiP
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidPiP(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // Find the main activity
    const mainApplication = androidManifest.manifest.application[0];
    const mainActivity = mainApplication.activity?.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      // Enable PiP support
      mainActivity.$['android:supportsPictureInPicture'] = 'true';
      
      // Prevent activity from restarting when entering/exiting PiP
      const currentConfigChanges = mainActivity.$['android:configChanges'] || '';
      const requiredChanges = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation'];
      
      const configChanges = currentConfigChanges
        .split('|')
        .filter(Boolean)
        .concat(requiredChanges)
        .filter((value, index, self) => self.indexOf(value) === index)
        .join('|');
      
      mainActivity.$['android:configChanges'] = configChanges;

      console.log('✅ Android PiP configuration added to MainActivity');
    }

    return config;
  });
};