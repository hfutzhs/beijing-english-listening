import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = '@exam_device_id';

let cachedDeviceId: string | null = null;

/**
 * Get or create a unique device ID for the current device.
 * The ID is generated once and stored in AsyncStorage for subsequent use.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = Crypto.randomUUID();
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    cachedDeviceId = id;
    return id!;
  } catch (e) {
    console.error('Failed to get/create device ID:', e);
    // Fallback to a random ID
    const fallback = `fallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    cachedDeviceId = fallback;
    return fallback;
  }
}

/**
 * Hook to get the device ID, with loading state
 */
export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  return deviceId;
}
