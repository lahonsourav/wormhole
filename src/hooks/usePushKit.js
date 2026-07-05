import { useEffect } from 'react';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SignalingService from '../webrtc/signalingService';

export const usePushKit = ({ onWakeUp }) => {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const PushKitBridge = NativeModules.PushKitBridge;
    if (!PushKitBridge) return;

    const emitter = new NativeEventEmitter(PushKitBridge);

    const tokenSub = emitter.addListener('onVoIPTokenReceived', async (token) => {
      await AsyncStorage.setItem('iosVoIPToken', token);
      SignalingService.updateToken(token);
    });

    const wakeSub = emitter.addListener('onVoIPPushReceived', () => {
      onWakeUp?.();
    });

    return () => {
      tokenSub.remove();
      wakeSub.remove();
    };
  }, [onWakeUp]);
};
