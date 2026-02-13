import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

// Suppress noisy dev warnings to keep flow unblocked
import { LogBox } from 'react-native';
if (__DEV__) {
  LogBox.ignoreLogs([
    'Possible unhandled promise rejection',
    'Require cycle:',
  ]);
  // To silence everything temporarily, uncomment this line:
  // LogBox.ignoreAllLogs(true);
}

import App from './src/shared/App';
registerRootComponent(App);
