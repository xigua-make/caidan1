import { useState, useEffect, useCallback } from 'react';

const ACTIVATION_STORAGE_KEY = 'xiaogua_activation';
const DEVICE_ID_KEY = 'xiaogua_device_id';

export interface ActivationState {
  isActivated: boolean;
  isLoading: boolean;
  expiresAt: string | null;
  durationType: string | null;
  deviceId: string | null;
}

// 生成设备ID
function generateDeviceId(): string {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const id = 'device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

// 检查本地激活状态
function checkLocalActivation(): { valid: boolean; expiresAt: string | null } {
  const stored = localStorage.getItem(ACTIVATION_STORAGE_KEY);
  if (!stored) return { valid: false, expiresAt: null };

  try {
    const data = JSON.parse(stored);
    // 永久激活
    if (!data.expiresAt) return { valid: true, expiresAt: null };
    
    // 检查是否过期
    const expiresAt = new Date(data.expiresAt);
    if (expiresAt > new Date()) {
      return { valid: true, expiresAt: data.expiresAt };
    }
    
    // 已过期，清除本地存储
    localStorage.removeItem(ACTIVATION_STORAGE_KEY);
    return { valid: false, expiresAt: null };
  } catch {
    return { valid: false, expiresAt: null };
  }
}

export function useActivation() {
  const [state, setState] = useState<ActivationState>({
    isActivated: false,
    isLoading: true,
    expiresAt: null,
    durationType: null,
    deviceId: null,
  });

  // 初始化：检查本地激活状态
  useEffect(() => {
    const deviceId = generateDeviceId();
    const { valid, expiresAt } = checkLocalActivation();

    if (valid) {
      setState({
        isActivated: true,
        isLoading: false,
        expiresAt,
        durationType: null,
        deviceId,
      });
    } else {
      // 如果本地没有激活信息，尝试从服务器验证
      verifyWithServer(deviceId);
    }
  }, []);

  // 从服务器验证激活状态
  const verifyWithServer = async (deviceId: string) => {
    try {
      const res = await fetch(`/api/activate?deviceId=${deviceId}`);
      const data = await res.json();

      if (data.success && data.activated) {
        // 保存到本地
        localStorage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify({
          expiresAt: data.expiresAt,
          verifiedAt: new Date().toISOString(),
        }));

        setState({
          isActivated: true,
          isLoading: false,
          expiresAt: data.expiresAt,
          durationType: data.durationType,
          deviceId,
        });
      } else {
        setState({
          isActivated: false,
          isLoading: false,
          expiresAt: null,
          durationType: null,
          deviceId,
        });
      }
    } catch (error) {
      console.error('验证激活状态失败:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // 激活
  const activate = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
    if (!state.deviceId) {
      return { success: false, message: '设备ID获取失败' };
    }

    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, deviceId: state.deviceId }),
      });

      const data = await res.json();

      if (data.success) {
        // 保存到本地
        localStorage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify({
          expiresAt: data.expiresAt,
          verifiedAt: new Date().toISOString(),
        }));

        setState(prev => ({
          ...prev,
          isActivated: true,
          expiresAt: data.expiresAt,
          durationType: data.durationType,
        }));

        return { success: true, message: '激活成功' };
      } else {
        return { success: false, message: data.error || '激活失败' };
      }
    } catch (error) {
      console.error('激活失败:', error);
      return { success: false, message: '网络错误，请稍后重试' };
    }
  }, [state.deviceId]);

  // 检查激活状态（强制从服务器验证）
  const checkActivation = useCallback(async () => {
    if (!state.deviceId) return;
    await verifyWithServer(state.deviceId);
  }, [state.deviceId]);

  return {
    ...state,
    activate,
    checkActivation,
  };
}
