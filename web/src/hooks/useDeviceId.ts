import { useState, useEffect } from 'react';
import { getDeviceId } from '../lib/device';

export function useDeviceId(): string {
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  return deviceId;
}
