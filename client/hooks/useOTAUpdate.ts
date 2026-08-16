import { useEffect, useRef, useState } from 'react';
import * as Updates from 'expo-updates';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

interface UseUpdateCheckerResult {
  status: UpdateStatus;
  message: string;
  checkNow: () => Promise<void>;
  applyUpdate: () => Promise<void>;
}

/**
 * OTA 更新检查 Hook
 * - 应用启动时自动检查更新
 * - 从后台恢复时重新检查
 * - 提供 checkNow() 和 applyUpdate() 方法
 */
export function useUpdateChecker(): UseUpdateCheckerResult {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [message, setMessage] = useState('');
  const isCheckingRef = useRef(false);

  const doCheck = async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      setStatus('checking');
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setStatus('available');
        setMessage('发现新版本');
      } else {
        setStatus('idle');
        setMessage('');
      }
    } catch {
      // Silently fail - OTA is optional, don't block app usage
      setStatus('idle');
      setMessage('');
    } finally {
      isCheckingRef.current = false;
    }
  };

  const checkNow = async () => {
    await doCheck();
  };

  const applyUpdate = async () => {
    try {
      setStatus('downloading');
      setMessage('正在下载更新...');
      await Updates.fetchUpdateAsync();
      setStatus('ready');
      setMessage('更新已就绪，正在重启...');
      setTimeout(async () => {
        await Updates.reloadAsync();
      }, 1000);
    } catch (error: any) {
      setStatus('error');
      setMessage(error?.message || '更新失败');
    }
  };

  useEffect(() => {
    // Auto-check on mount (production only, silently)
    doCheck();
  }, []);

  return { status, message, checkNow, applyUpdate };
}
