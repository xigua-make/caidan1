'use client';

import React, { useState, useMemo } from 'react';
import { MappedPixel } from '../utils/pixelation';
import { ColorSystem, getColorKeyByHex } from '../utils/colorSystemUtils';

interface ReplaceColorsPanelProps {
  colorCounts: Record<string, { color: string; count: number }> | null;
  totalBeadCount: number;
  selectedColorSystem: ColorSystem;
  fullPaletteColors: { key: string; hex: string; mardKey?: string }[];
  onColorReplace: (sourceColor: { key: string; color: string }, targetColor: { key: string; color: string }) => void;
  onHighlightColor: (colorHex: string) => void;
  replaceHistory?: Array<{ sourceColor: string; targetColor: string; timestamp: number }>;
  onRestoreReplace?: (sourceColor: string, targetColor: string) => void;
}

// 阈值：少于这个数量的颜色被认为是杂色
const RARE_COLOR_THRESHOLD = 10;

const ReplaceColorsPanel: React.FC<ReplaceColorsPanelProps> = ({
  colorCounts,
  totalBeadCount,
  selectedColorSystem,
  fullPaletteColors,
  onColorReplace,
  onHighlightColor,
  replaceHistory = [],
  onRestoreReplace
}) => {
  const [isSelectingTarget, setIsSelectingTarget] = useState(false);
  const [selectedSourceColor, setSelectedSourceColor] = useState<{ key: string; color: string } | null>(null);

  // 获取杂色列表（数量少于阈值的颜色）
  const rareColors = useMemo(() => {
    if (!colorCounts) return [];
    return Object.entries(colorCounts)
      .filter(([, data]) => data.count < RARE_COLOR_THRESHOLD && data.count > 0)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([key, data]) => ({ key, ...data }));
  }, [colorCounts]);

  // 计算杂色总数量
  const rareColorTotalCount = useMemo(() => {
    return rareColors.reduce((sum, item) => sum + item.count, 0);
  }, [rareColors]);

  // 处理点击杂色条目
  const handleRareColorClick = (colorData: { key: string; color: string }) => {
    setSelectedSourceColor(colorData);
    setIsSelectingTarget(true);
    onHighlightColor(colorData.color);
  };

  // 处理选择目标颜色
  const handleSelectTargetColor = (targetColor: { key: string; color: string }) => {
    if (selectedSourceColor) {
      onColorReplace(selectedSourceColor, targetColor);
      setIsSelectingTarget(false);
      setSelectedSourceColor(null);
    }
  };

  // 判断颜色深浅
  const isLightColor = (hexColor: string) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  };

  if (rareColors.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 overflow-hidden">
      {/* 标题 */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-600">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 text-center">
          替换杂色
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
          点击颜色替换为想要的颜色。总计: <span className="text-gray-800 dark:text-gray-200 font-medium">{rareColorTotalCount} 颗</span>
        </p>
      </div>

      {/* 选择目标颜色模式 */}
      {isSelectingTarget && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
            选择目标颜色：
          </p>
          <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto">
            {fullPaletteColors.map((colorItem) => {
              const hexColor = colorItem.hex;
              return (
                <button
                  key={hexColor}
                  onClick={() => handleSelectTargetColor({ key: colorItem.key, color: hexColor })}
                  className="w-6 h-6 rounded border border-gray-300 dark:border-gray-500 hover:scale-110 transition-transform"
                  style={{ backgroundColor: hexColor }}
                  title={`${colorItem.key} - ${hexColor}`}
                >
                  <span className={`text-[8px] font-bold ${isLightColor(hexColor) ? 'text-gray-800' : 'text-white'}`}>
                    {colorItem.key}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => {
              setIsSelectingTarget(false);
              setSelectedSourceColor(null);
            }}
            className="w-full mt-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            取消
          </button>
        </div>
      )}

      {/* 杂色列表 */}
      <div className="max-h-48 overflow-y-auto">
        {rareColors.map(({ key, color, count }) => {
          const displayKey = getColorKeyByHex(color, selectedColorSystem);
          return (
            <button
              key={key}
              onClick={() => handleRareColorClick({ key, color })}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border-b border-gray-50 dark:border-gray-600 last:border-b-0"
            >
              {/* 颜色方块 */}
              <div
                className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: color }}
              >
                <span className={`text-[10px] font-bold ${isLightColor(color) ? 'text-gray-800' : 'text-white'}`}>
                  {displayKey}
                </span>
              </div>
              
              {/* 色号 */}
              <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 text-left">
                {displayKey}
              </span>
              
              {/* 数量 */}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {count} 颗
              </span>
            </button>
          );
        })}
      </div>

      {/* 替换历史与恢复 */}
      {replaceHistory.length > 0 && onRestoreReplace && (
        <div className="border-t border-gray-100 dark:border-gray-600">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-600/50">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">最近替换：</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {replaceHistory.slice(-5).reverse().map((item, index) => {
                const sourceKey = getColorKeyByHex(item.sourceColor, selectedColorSystem);
                const targetKey = getColorKeyByHex(item.targetColor, selectedColorSystem);
                return (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 flex-1">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: item.sourceColor }}
                      />
                      <span className="text-gray-600 dark:text-gray-400">{sourceKey}</span>
                      <span className="text-gray-400">→</span>
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: item.targetColor }}
                      />
                      <span className="text-gray-600 dark:text-gray-400">{targetKey}</span>
                    </div>
                    <button
                      onClick={() => onRestoreReplace(item.sourceColor, item.targetColor)}
                      className="px-2 py-0.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    >
                      恢复
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReplaceColorsPanel;
