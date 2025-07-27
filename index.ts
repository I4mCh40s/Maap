// index.js (or index.ts)
import { registerRootComponent } from 'expo';

import App from './App'; // This points to your App.tsx file

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up correctly
registerRootComponent(App);