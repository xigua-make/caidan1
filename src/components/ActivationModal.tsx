'use client';

import React, { useState } from 'react';

interface ActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: (code: string) => Promise<{ success: boolean; message: string; expiresAt?: string | null; durationType?: string }>;
  expiredMessage?: string;
}

// 格式化到期时间显示
function formatExpiresAt(expiresAt: string | null, durationType: string): string {
  if (!expiresAt) {
    return '永久有效';
  }
  
  const date = new Date(expiresAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  
  // 已过期
  if (diffMs <= 0) {
    return '已到期';
  }
  
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const diffHours = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const diffMinutes = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
  const diffSeconds = Math.max(0, Math.floor((diffMs % (1000 * 60)) / 1000));
  
  // 显示具体日期
  const dateStr = date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: durationType === '30s' ? '2-digit' : undefined,
  });
  
  if (durationType === 'permanent') {
    return '永久有效';
  }
  
  // 30秒测试码显示秒数
  if (durationType === '30s') {
    return `${dateStr}（剩余 ${diffSeconds}秒）`;
  }
  
  if (diffDays > 0) {
    return `${dateStr}（剩余 ${diffDays}天${diffHours > 0 ? diffHours + '小时' : ''}）`;
  } else if (diffHours > 0) {
    return `${dateStr}（剩余 ${diffHours}小时${diffMinutes > 0 ? diffMinutes + '分钟' : ''}）`;
  } else {
    return `${dateStr}（剩余 ${diffMinutes}分钟）`;
  }
}

// 判断是否已过期
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  const now = new Date();
  return date.getTime() <= now.getTime();
}

// 获取有效期类型标签
function getDurationLabel(durationType: string): string {
  switch (durationType) {
    case '30s':
      return '30秒(测试)';
    case '1d':
      return '1天';
    case '7d':
      return '7天';
    case 'permanent':
      return '永久';
    default:
      return durationType;
  }
}

export default function ActivationModal({ isOpen, onClose, onActivate, expiredMessage }: ActivationModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    expiresAt: string | null;
    durationType: string;
  } | null>(null);
  // 新增：激活码已耗尽/过期状态
  const [isExpiredCode, setIsExpiredCode] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setError('请输入卡密');
      return;
    }

    setLoading(true);
    setError('');
    setIsExpiredCode(false);

    try {
      const result = await onActivate(code);
      if (result.success) {
        // 验证成功，显示成功信息
        setSuccess(true);
        setSuccessInfo({
          expiresAt: result.expiresAt || null,
          durationType: result.durationType || '1d',
        });
        setCode('');
      } else {
        // 检查是否是已耗尽/过期错误
        const expiredKeywords = ['已耗尽', '已过期', '已到期', '已被禁用'];
        const isExpired = expiredKeywords.some(keyword => result.message.includes(keyword));
        
        if (isExpired) {
          setIsExpiredCode(true);
        } else {
          setError(result.message);
        }
      }
    } catch (err) {
      setError('验证失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError('');
    setSuccess(false);
    setSuccessInfo(null);
    setIsExpiredCode(false);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">卡密验证</h3>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 验证成功状态 */}
        {success && successInfo ? (
          <div className="px-5 py-6">
            {/* 成功图标和提示 */}
            <div className="flex flex-col items-center mb-6">
              {isExpired(successInfo.expiresAt) ? (
                <>
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-1">卡密已到期</h4>
                  <p className="text-sm text-gray-500 text-center">您的卡密已过期，请续费后继续使用</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-1">验证成功</h4>
                  <p className="text-sm text-gray-500">您的卡密已成功激活</p>
                </>
              )}
            </div>

            {/* 到期时间信息 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">有效期类型</span>
                <span className="text-sm font-semibold text-indigo-600">
                  {getDurationLabel(successInfo.durationType)}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm text-gray-500">到期时间</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-800 block">
                    {formatExpiresAt(successInfo.expiresAt, successInfo.durationType)}
                  </span>
                </div>
              </div>
            </div>

            {/* 确认/购买按钮 */}
            {isExpired(successInfo.expiresAt) ? (
              <a
                href="https://afdian.net/a/jianer290"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 text-center bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-colors font-medium"
              >
                前往购买续费
              </a>
            ) : (
              <button
                onClick={handleClose}
                className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                开始使用
              </button>
            )}
          </div>
        ) : isExpiredCode ? (
          /* 验证失败：卡密已耗尽/过期 - 显示卡片提示 */
          <div className="px-5 py-6">
            {/* 失败图标和提示 */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-gray-800 mb-1">卡密已到期</h4>
              <p className="text-sm text-gray-500 text-center">您的卡密已耗尽，请重新购买后继续使用</p>
            </div>

            {/* 购买按钮 - 橙色渐变样式 */}
            <a
              href="https://xhslink.com/m/H5QFiv6GUJ"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 text-center bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-colors font-medium"
            >
              购买卡密
            </a>
          </div>
        ) : (
          <>
            {/* 说明文字 */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs text-gray-500">
                你上传图片使用拼豆图生成器需要输入卡密验证使用
              </p>
            </div>

            {/* 过期/错误提示 */}
            {expiredMessage && (
              <div className="px-5 pb-2">
                <p className="text-xs text-white bg-red-500 px-3 py-2 rounded-lg">
                  {expiredMessage}
                </p>
              </div>
            )}

            {/* 表单 */}
            <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  卡密
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError('');
                  }}
                  placeholder="请输入卡密"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400"
                />
                {error && (
                  <div className="flex items-center gap-1 mt-2 text-red-500 text-xs">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* 按钮组 */}
              <div className="flex gap-3">
                <a
                  href="https://xhslink.com/m/H5QFiv6GUJ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 text-sm text-center bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  购买卡密
                </a>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '验证中...' : '验证卡密上传'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
