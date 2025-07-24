// Ensure this is at the very top of the file!
import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import App from './App'; // Make sure this path is correct

// Use a direct require() statement for the JSON file, which works
// better with the Metro bundler and TypeScript's new setting.
const appConfig = require('./app.json');

AppRegistry.registerComponent(appConfig.name, () => App);