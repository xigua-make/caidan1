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
  codeId: number | null; // 添加codeId用于服务器验证
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

// 检查本地激活状态（仅用于快速显示，实际验证需要服务器）
function getLocalActivation(): { codeId: number | null; expiresAt: string | null } {
  if (typeof window === 'undefined') return { codeId: null, expiresAt: null };
  
  const stored = localStorage.getItem(ACTIVATION_STORAGE_KEY);
  if (!stored) return { codeId: null, expiresAt: null };

  try {
    const data = JSON.parse(stored);
    return { 
      codeId: data.codeId || null, 
      expiresAt: data.expiresAt || null 
    };
  } catch {
    return { codeId: null, expiresAt: null };
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
    codeId: null,
  });

  // 从服务器验证激活状态
  const verifyWithServer = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/activate?deviceId=${deviceId}`, {
        // 添加缓存控制
        cache: 'no-store',
      });
      const data = await res.json();

      if (data.success && data.activated) {
        const isExpired = checkIsExpired(data.expiresAt);
        
        // 保存到本地
        localStorage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify({
          codeId: data.codeId,
          expiresAt: data.expiresAt,
          verifiedAt: new Date().toISOString(),
        }));

        setState(prev => ({
          ...prev,
          isActivated: !isExpired,
          isLoading: false,
          expiresAt: data.expiresAt,
          durationType: data.durationType,
          codeId: data.codeId || null,
          isExpired,
        }));
        
        return !isExpired;
      } else {
        // 服务器返回未激活，清除本地缓存
        localStorage.removeItem(ACTIVATION_STORAGE_KEY);
        setState(prev => ({
          ...prev,
          isActivated: false,
          isLoading: false,
          expiresAt: null,
          durationType: null,
          codeId: null,
          isExpired: false,
        }));
        return false;
      }
    } catch (error) {
      console.error('验证激活状态失败:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, []);

  // 初始化
  useEffect(() => {
    const deviceId = generateDeviceId();
    const local = getLocalActivation();
    
    setState(prev => ({
      ...prev,
      deviceId,
      expiresAt: local.expiresAt,
      codeId: local.codeId,
    }));

    // 始终从服务器验证激活状态（检查是否被禁用）
    verifyWithServer(deviceId);
  }, [verifyWithServer]);

  // 激活
  const activate = useCallback(async (code: string): Promise<{ success: boolean; message: string; expiresAt?: string | null; durationType?: string }> => {
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
          codeId: data.codeId,
          expiresAt: data.expiresAt,
          verifiedAt: new Date().toISOString(),
        }));

        setState(prev => ({
          ...prev,
          isActivated: true,
          expiresAt: data.expiresAt,
          durationType: data.durationType,
          codeId: data.codeId || null,
          isExpired: false,
        }));

        return { 
          success: true, 
          message: '激活成功',
          expiresAt: data.expiresAt,
          durationType: data.durationType,
        };
      } else {
        return { success: false, message: data.error || '卡密验证失败' };
      }
    } catch (error) {
      console.error('激活失败:', error);
      return { success: false, message: '网络错误，请稍后重试' };
    }
  }, [state.deviceId]);

  // 强制从服务器验证激活状态（用于关键操作前）
  const checkActivation = useCallback(async (): Promise<boolean> => {
    if (!state.deviceId) return false;
    return await verifyWithServer(state.deviceId);
  }, [state.deviceId, verifyWithServer]);

  // 清除激活状态
  const clearActivation = useCallback(() => {
    localStorage.removeItem(ACTIVATION_STORAGE_KEY);
    setState(prev => ({
      ...prev,
      isActivated: false,
      expiresAt: null,
      isExpired: false,
      codeId: null,
    }));
  }, []);

  return {
    ...state,
    activate,
    checkActivation,
    clearActivation,
  };
}
