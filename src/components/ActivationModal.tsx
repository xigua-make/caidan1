'use client';

import React, { useState } from 'react';

interface ActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: (code: string) => Promise<{ success: boolean; message: string }>;
  expiresAt?: string | null;
  expiredMessage?: string;
}

export default function ActivationModal({ isOpen, onClose, onActivate, expiredMessage }: ActivationModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setError('请输入卡密');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await onActivate(code);
      if (result.success) {
        setCode('');
        onClose();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('验证失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">卡密验证</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 说明文字 */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs text-gray-500">
            你上传图片使用拼豆图生成器需要输入卡密验证使用
          </p>
        </div>

        {/* 过期提示 */}
        {expiredMessage && (
          <div className="px-5 pb-2">
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
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
          </div>

          {error && (
            <div className="text-red-500 text-xs text-center py-1">{error}</div>
          )}

          {/* 按钮组 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              购买卡密
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '验证中...' : '验证卡密上传'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
