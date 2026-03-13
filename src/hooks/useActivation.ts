import { useState, useEffect, useCallback } from 'react';

const ACTIVATION_STORAGE_KEY = 'xiaogua_activation';
const DEVICE_ID_KEY = 'xiaogua_device_id';

export interface ActivationState {
  isActivated: boolean;
  isLoading: boolean;
  expiresAt: string | null;
  durationType: string | null;
  deviceId: string | null;
  isExpired: boolean;
}

// 生成设备ID
function generateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const id = 'device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

// 检查是否过期
function checkIsExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false; // 永久不过期
  return new Date(expiresAt) < new Date();
}

// 检查本地激活状态
function checkLocalActivation(): { valid: boolean; expiresAt: string | null; isExpired: boolean } {
  if (typeof window === 'undefined') return { valid: false, expiresAt: null, isExpired: false };
  
  const stored = localStorage.getItem(ACTIVATION_STORAGE_KEY);
  if (!stored) return { valid: false, expiresAt: null, isExpired: false };

  try {
    const data = JSON.parse(stored);
    // 永久激活
    if (!data.expiresAt) return { valid: true, expiresAt: null, isExpired: false };
    
    // 检查是否过期
    const expiresAt = new Date(data.expiresAt);
    const isExpired = expiresAt < new Date();
    
    if (!isExpired) {
      return { valid: true, expiresAt: data.expiresAt, isExpired: false };
    }
    
    // 已过期
    return { valid: false, expiresAt: data.expiresAt, isExpired: true };
  } catch {
    return { valid: false, expiresAt: null, isExpired: false };
  }
}

export function useActivation() {
  const [state, setState] = useState<ActivationState>({
    isActivated: false,
    isLoading: true,
    expiresAt: null,
    durationType: null,
    deviceId: null,
    isExpired: false,
  });

  // 初始化：检查本地激活状态
  useEffect(() => {
    const deviceId = generateDeviceId();
    const { valid, expiresAt, isExpired } = checkLocalActivation();

    if (valid) {
      setState({
        isActivated: true,
        isLoading: false,
        expiresAt,
        durationType: null,
        deviceId,
        isExpired: false,
      });
    } else if (isExpired) {
      // 已过期
      setState({
        isActivated: false,
        isLoading: false,
        expiresAt,
        durationType: null,
        deviceId,
        isExpired: true,
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
        const isExpired = checkIsExpired(data.expiresAt);
        
        // 保存到本地
        localStorage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify({
          expiresAt: data.expiresAt,
          verifiedAt: new Date().toISOString(),
        }));

        setState({
          isActivated: !isExpired,
          isLoading: false,
          expiresAt: data.expiresAt,
          durationType: data.durationType,
          deviceId,
          isExpired,
        });
      } else {
        setState({
          isActivated: false,
          isLoading: false,
          expiresAt: null,
          durationType: null,
          deviceId,
          isExpired: false,
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
          isExpired: false,
        }));

        return { success: true, message: '激活成功' };
      } else {
        return { success: false, message: data.error || '卡密验证失败' };
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

  // 清除激活状态
  const clearActivation = useCallback(() => {
    localStorage.removeItem(ACTIVATION_STORAGE_KEY);
    setState(prev => ({
      ...prev,
      isActivated: false,
      expiresAt: null,
      isExpired: false,
    }));
  }, []);

  return {
    ...state,
    activate,
    checkActivation,
    clearActivation,
  };
}
