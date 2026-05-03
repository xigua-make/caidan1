'use client';

import React, { useState, useEffect } from 'react';
import { PaletteColor } from '../utils/pixelation';
import { PaletteSelections, saveSelectedPresetName, loadSelectedPresetName } from '../utils/localStorageUtils';
import { getDisplayColorKey, ColorSystem, getColorKeyByHex } from '../utils/colorSystemUtils';
import colorSystemMapping from '../app/colorSystemMapping.json';

// MARD色号系统的预设色板配置
const MARD_PRESET_PALETTES: { name: string; count: number; mardKeys: string[] }[] = [
  {
    name: '291色',
    count: 291,
    mardKeys: [] // 空数组表示全部颜色
  },
  {
    name: '221色',
    count: 221,
    mardKeys: [
      // A系列 (26色)
      'A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22','A23','A24','A25','A26',
      // B系列 (32色)
      'B01','B02','B03','B04','B05','B06','B07','B08','B09','B10','B11','B12','B13','B14','B15','B16','B17','B18','B19','B20','B21','B22','B23','B24','B25','B26','B27','B28','B29','B30','B31','B32',
      // C系列 (29色)
      'C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14','C15','C16','C17','C18','C19','C20','C21','C22','C23','C24','C25','C26','C27','C28','C29',
      // D系列 (26色)
      'D01','D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21','D22','D23','D24','D25','D26',
      // E系列 (24色)
      'E01','E02','E03','E04','E05','E06','E07','E08','E09','E10','E11','E12','E13','E14','E15','E16','E17','E18','E19','E20','E21','E22','E23','E24',
      // F系列 (25色)
      'F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25',
      // G系列 (21色)
      'G01','G02','G03','G04','G05','G06','G07','G08','G09','G10','G11','G12','G13','G14','G15','G16','G17','G18','G19','G20','G21',
      // H系列 (23色)
      'H01','H02','H03','H04','H05','H06','H07','H08','H09','H10','H11','H12','H13','H14','H15','H16','H17','H18','H19','H20','H21','H22','H23',
      // M系列 (15色)
      'M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M11','M12','M13','M14','M15'
    ]
  },
  {
    name: '144色',
    count: 144,
    mardKeys: [
      // A系列 (24色)
      'A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22','A23','A24',
      // B系列 (24色)
      'B01','B02','B03','B04','B05','B06','B07','B08','B09','B10','B11','B12','B13','B14','B15','B16','B17','B18','B19','B20','B21','B22','B23','B24',
      // C系列 (24色)
      'C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14','C15','C16','C17','C18','C19','C20','C21','C22','C23','C24',
      // D系列 (24色)
      'D01','D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21','D22','D23','D24',
      // E系列 (24色)
      'E01','E02','E03','E04','E05','E06','E07','E08','E09','E10','E11','E12','E13','E14','E15','E16','E17','E18','E19','E20','E21','E22','E23','E24',
      // F系列 (24色)
      'F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24'
    ]
  },
  {
    name: '120色',
    count: 120,
    mardKeys: [
      // A系列 (20色)
      'A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20',
      // B系列 (20色)
      'B01','B02','B03','B04','B05','B06','B07','B08','B09','B10','B11','B12','B13','B14','B15','B16','B17','B18','B19','B20',
      // C系列 (20色)
      'C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14','C15','C16','C17','C18','C19','C20',
      // D系列 (20色)
      'D01','D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20',
      // E系列 (20色)
      'E01','E02','E03','E04','E05','E06','E07','E08','E09','E10','E11','E12','E13','E14','E15','E16','E17','E18','E19','E20',
      // F系列 (20色)
      'F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20'
    ]
  }
];

// 对颜色进行分组的工具函数，按前缀分组
function groupColorsByPrefix(colors: PaletteColor[], selectedColorSystem: ColorSystem): Record<string, PaletteColor[]> {
  const groups: Record<string, PaletteColor[]> = {};
  
  colors.forEach(color => {
    const displayKey = getDisplayColorKey(color.hex, selectedColorSystem);
    
    let prefix: string;
    if (selectedColorSystem === '盼盼' || selectedColorSystem === '咪小窝') {
      // 对于纯数字的色号系统，按数字范围分组
      if (/^\d+$/.test(displayKey)) {
        const num = parseInt(displayKey, 10);
        if (num <= 20) {
          prefix = '1-20';
        } else if (num <= 50) {
          prefix = '21-50';
        } else if (num <= 100) {
          prefix = '51-100';
        } else if (num <= 200) {
          prefix = '101-200';
        } else {
          prefix = '200+';
        }
      } else {
        prefix = '其他';
      }
    } else {
      // 对于有字母前缀的色号系统，按字母前缀分组
      prefix = displayKey.match(/^[A-Z]+/)?.[0] || '其他';
    }
    
    if (!groups[prefix]) {
      groups[prefix] = [];
    }
    groups[prefix].push(color);
  });
  
  // 对每个组内的颜色按键进行排序
  Object.keys(groups).forEach(prefix => {
    groups[prefix].sort((a, b) => {
      const displayKeyA = getDisplayColorKey(a.hex, selectedColorSystem);
      const displayKeyB = getDisplayColorKey(b.hex, selectedColorSystem);
      
      if (selectedColorSystem === '盼盼' || selectedColorSystem === '咪小窝') {
        // 对于纯数字色号，按数字大小排序
        const numA = parseInt(displayKeyA, 10) || 0;
        const numB = parseInt(displayKeyB, 10) || 0;
        return numA - numB;
      } else {
        // 对于有字母前缀的色号，按字母+数字排序
        const numA = parseInt(displayKeyA.replace(/^[A-Z]+/, ''), 10) || 0;
        const numB = parseInt(displayKeyB.replace(/^[A-Z]+/, ''), 10) || 0;
      return numA - numB;
      }
    });
  });
  
  return groups;
}

// 色号系统选项
const colorSystemOptions = [
  { key: 'MARD', name: 'MARD' },
  { key: 'COCO', name: 'COCO' },
  { key: '漫漫', name: '漫漫' },
  { key: '盼盼', name: '盼盼' },
  { key: '咪小窝', name: '咪小窝' },
];

interface CustomPaletteEditorProps {
  allColors: PaletteColor[];
  currentSelections: PaletteSelections;
  onSelectionChange: (key: string, isSelected: boolean) => void;
  onSaveCustomPalette: () => void;
  onClose: () => void;
  onExportCustomPalette: () => void;
  onImportCustomPalette: () => void;
  selectedColorSystem: ColorSystem;
  onColorSystemChange: (colorSystem: ColorSystem) => void;
}

const CustomPaletteEditor: React.FC<CustomPaletteEditorProps> = ({
  allColors,
  currentSelections,
  onSelectionChange,
  onSaveCustomPalette,
  onClose,
  onExportCustomPalette,
  onImportCustomPalette,
  selectedColorSystem,
  onColorSystemChange,
}) => {
  // 用于跟踪当前展开的颜色组
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedPresetName, setSelectedPresetName] = useState<string | null>(() => {
    // 从 localStorage 读取保存的预设名称
    return loadSelectedPresetName();
  });
  
  // 计算已选择的颜色数量
  useEffect(() => {
    const count = Object.values(currentSelections).filter(Boolean).length;
    setSelectedCount(count);
  }, [currentSelections]);
  
  // 根据搜索词过滤颜色
  const filteredColors = searchTerm 
    ? allColors.filter(color => {
        const originalKey = color.key.toLowerCase();
        const displayKey = getDisplayColorKey(color.hex, selectedColorSystem).toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        return originalKey.includes(searchLower) || displayKey.includes(searchLower);
      })
    : allColors;
  
  // 对过滤后的颜色进行分组
  const colorGroups = groupColorsByPrefix(filteredColors, selectedColorSystem);
  
  // 切换组展开状态
  const toggleGroup = (prefix: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [prefix]: !prev[prefix]
    }));
  };
  
  // 切换所有颜色的选择状态
  const toggleAllColors = (selected: boolean) => {
    setSelectedPresetName(null); // 手动修改时清除预设选中状态
    saveSelectedPresetName(null);
    allColors.forEach(color => {
      onSelectionChange(color.hex.toUpperCase(), selected);
    });
  };
  
  // 切换一个组内所有颜色的选择状态
  const toggleGroupColors = (prefix: string, selected: boolean) => {
    setSelectedPresetName(null); // 手动修改时清除预设选中状态
    saveSelectedPresetName(null);
    colorGroups[prefix].forEach(color => {
      onSelectionChange(color.hex.toUpperCase(), selected);
    });
  };
  
  // 应用MARD预设色板
  const applyMardPreset = (preset: typeof MARD_PRESET_PALETTES[0]) => {
    // 设置选中的预设名称并保存到 localStorage
    setSelectedPresetName(preset.name);
    saveSelectedPresetName(preset.name);
    
    // 先取消所有选择
    allColors.forEach(color => {
      onSelectionChange(color.hex.toUpperCase(), false);
    });
    
    if (preset.mardKeys.length === 0) {
      // 空数组表示选择全部颜色
      allColors.forEach(color => {
        onSelectionChange(color.hex.toUpperCase(), true);
      });
    } else {
      // 根据 MARD 色号找到对应的 hex 值并选择
      const presetKeySet = new Set(preset.mardKeys);
      allColors.forEach(color => {
        const mardKey = getColorKeyByHex(color.hex.toUpperCase(), 'MARD');
        if (presetKeySet.has(mardKey)) {
          onSelectionChange(color.hex.toUpperCase(), true);
        }
      });
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 rounded-xl overflow-hidden" style={{ height: '100%', minHeight: '0', display: 'flex', flexDirection: 'column' }}>
      {/* 头部 - 现代化毛玻璃效果，固定在顶部 */}
      <div className="relative flex-shrink-0" style={{ flexShrink: '0' }}>
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-90"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-sm"></div>

        {/* 头部内容 - 增加内边距确保完整显示 */}
        <div className="relative flex justify-between items-center px-4 py-3.5 sm:px-6 sm:py-5 z-10">
          <h2 className="text-base sm:text-lg sm:text-xl font-bold text-white flex items-center tracking-wide">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 sm:h-6 sm:w-6 mr-1.5 sm:mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
            </svg>
            <span className="flex-shrink-0 text-sm sm:text-base">色板中心</span>
            <span className="ml-1.5 sm:ml-2 px-2 py-0.5 text-[10px] sm:text-xs font-semibold bg-white/20 backdrop-blur-sm rounded-full text-white border border-white/30 flex-shrink-0">
              {selectedCount} 色
            </span>
          </h2>
          <button
            onClick={onClose}
            className="group relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300 flex items-center justify-center border border-white/20 hover:border-white/40 flex-shrink-0 z-20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-white group-hover:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 搜索框 - 现代化设计，固定不滚动 */}
      <div className="flex-shrink-0 p-3 sm:p-4 pt-0" style={{ flexShrink: '0' }}>
        <div className="relative">
          <input
            type="text"
            placeholder="搜索色号..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pl-9 sm:pl-11 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md"
          />
          <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 色号系统选择 - 卡片式设计，固定不滚动 */}
      <div className="flex-shrink-0 px-3 sm:px-4 pb-4" style={{ flexShrink: '0' }}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2.5 sm:mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            色号系统
          </label>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {(['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'] as ColorSystem[]).map((system) => (
              <button
                key={system}
                onClick={() => {
                  onColorSystemChange(system);
                  setSelectedPresetName(null);
                  saveSelectedPresetName(null);
                }}
                className={`px-1 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs font-semibold rounded-lg sm:rounded-xl transition-all duration-300 leading-tight ${
                  selectedColorSystem === system
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {system}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MARD预设色板选择 - 只在MARD系统下显示，固定不滚动 */}
      {selectedColorSystem === 'MARD' && (
        <div className="flex-shrink-0 px-3 sm:px-4 pb-4" style={{ flexShrink: '0' }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2.5 sm:mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              预设色板
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {MARD_PRESET_PALETTES.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyMardPreset(preset)}
                  className={`px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs font-semibold rounded-lg sm:rounded-xl transition-all duration-300 leading-tight ${
                    selectedPresetName === preset.name
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 scale-105'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 说明文本 - 现代化提示框，固定不滚动 */}
      <div className="flex-shrink-0 px-3 sm:px-4 pb-4" style={{ flexShrink: '0' }}>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 sm:p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30">
          <p className="flex items-start text-[10px] sm:text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            在此选择要使用的拼豆色系。您可以选择预设色板，然后根据需要手动添加或删除特定色号。完成后点击底部的"保存并应用"按钮。
          </p>
        </div>
      </div>

      {/* 快捷操作按钮 - 现代化按钮组，固定不滚动 */}
      <div className="flex-shrink-0 px-3 sm:px-4 pb-3 sm:pb-4" style={{ flexShrink: '0' }}>
        <div className="flex gap-2">
          <button
            onClick={() => toggleAllColors(true)}
            className="flex-1 px-2.5 py-2 text-[10px] sm:text-xs font-semibold bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            全选
          </button>
          <button
            onClick={() => toggleAllColors(false)}
            className="flex-1 px-2.5 py-2 text-[10px] sm:text-xs font-semibold bg-gradient-to-r from-red-400 to-rose-500 text-white rounded-lg hover:shadow-lg hover:shadow-red-500/30 transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            全不选
          </button>
        </div>
      </div>

      {/* 颜色列表 - 只有这个区域可以滚动 */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4" style={{ minHeight: '0', flex: '1 1 0%' }}>
        {/* 系列导航 - 紧凑一行 */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {Object.keys(colorGroups).sort().map(prefix => (
              <button
                key={prefix}
                onClick={() => toggleGroup(prefix)}
                className={`group relative px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border-2 ${
                  expandedGroups[prefix]
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-blue-500 shadow-lg shadow-blue-500/30'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{prefix}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    expandedGroups[prefix]
                      ? 'bg-white/30 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {colorGroups[prefix].length}
                  </span>
                </span>
                {expandedGroups[prefix] && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 展开的系列内容 */}
        <div className="space-y-3">
          {Object.keys(colorGroups).sort().filter(prefix => expandedGroups[prefix]).map(prefix => (
            <div key={prefix} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-blue-200 dark:border-blue-800 overflow-hidden">
              {/* 操作栏 */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-100 dark:border-blue-800/30">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm shadow-blue-500/30"></div>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{prefix} 系列详情</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupColors(prefix, true);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    全选
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupColors(prefix, false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    全不选
                  </button>
                  <button
                    onClick={() => toggleGroup(prefix)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 色号列表 */}
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {colorGroups[prefix].map(color => (
                    <label
                      key={color.key}
                      className="group flex flex-col items-center gap-1.5 p-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-all duration-200 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!!currentSelections[color.hex.toUpperCase()]}
                        onChange={(e) => {
                          setSelectedPresetName(null);
                          saveSelectedPresetName(null);
                          onSelectionChange(color.hex.toUpperCase(), e.target.checked);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                      />
                      <div
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg border-2 border-gray-200 dark:border-gray-600 flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="text-[11px] sm:text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-full text-center">{getDisplayColorKey(color.hex, selectedColorSystem)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部按钮 - 现代化设计，固定在底部 */}
      <div className="flex-shrink-0 p-3 sm:p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700" style={{ flexShrink: '0' }}>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 text-xs sm:text-sm font-semibold transition-all duration-300"
          >
            取消
          </button>
          <button
            onClick={onSaveCustomPalette}
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-[1.02]"
          >
            保存并应用
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomPaletteEditor; 