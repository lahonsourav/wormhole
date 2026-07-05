import 'react-native-get-random-values';
import 'fast-text-encoding';
import {Buffer} from 'buffer';
global.Buffer = Buffer;
import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
