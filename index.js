/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

console.log('🚀 index.js: Starting app registration');
console.log('🚀 index.js: App name:', appName);
console.log('🚀 index.js: Registering component...');

AppRegistry.registerComponent(appName, () => {
  console.log('🚀 index.js: AppRegistry.registerComponent callback called');
  return App;
});

console.log('🚀 index.js: Component registered');
