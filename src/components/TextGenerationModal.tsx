'use client';

import React, { useState, useEffect } from 'react';

interface TextGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (text: string, gridSize: number) => void;
  defaultGridSize?: number;
}

const TextGenerationModal: React.FC<TextGenerationModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  defaultGridSize = 95
}) => {
  const [text, setText] = useState('');
  const [gridSize, setGridSize] = useState(defaultGridSize.toString());

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setText('');
      setGridSize(defaultGridSize.toString());
    }
  }, [isOpen, defaultGridSize]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    
    const size = parseInt(gridSize, 10);
    if (isNaN(size) || size < 10 || size > 300) return;
    
    onGenerate(trimmedText, size);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && text.trim()) {
      handleGenerate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-[90%] max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* 标题区域 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">文字生成</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 说明文字 */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          在空白画板上自动生成最多5个字的拼豆格子图
        </p>

        {/* 输入文字 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            输入文字（最多5个字）
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 5))}
            placeholder="例如：拼豆图"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={5}
          />
        </div>

        {/* 画布尺寸 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            画布尺寸（横向格子数，10-300）
          </label>
          <input
            type="number"
            value={gridSize}
            onChange={(e) => setGridSize(e.target.value)}
            min={10}
            max={300}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleGenerate}
            disabled={!text.trim()}
            className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            生成拼豆图
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextGenerationModal;
