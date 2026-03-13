'use client';

import React, { useState, useEffect } from 'react';
import { PaletteColor } from '../utils/pixelation';
import { PaletteSelections } from '../utils/localStorageUtils';
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
      // E系列 (26色)
      'E01','E02','E03','E04','E05','E06','E07','E08','E09','E10','E11','E12','E13','E14','E15','E16','E17','E18','E19','E20','E21','E22','E23','E24','E25','E26',
      // F系列 (26色)
      'F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26',
      // G系列 (24色)
      'G01','G02','G03','G04','G05','G06','G07','G08','G09','G10','G11','G12','G13','G14','G15','G16','G17','G18','G19','G20','G21','G22','G23','G24',
      // H系列 (26色)
      'H01','H02','H03','H04','H05','H06','H07','H08','H09','H10','H11','H12','H13','H14','H15','H16','H17','H18','H19','H20','H21','H22','H23','H24','H25','H26',
      // I系列 (16色)
      'I01','I02','I03','I04','I05','I06','I07','I08','I09','I10','I11','I12','I13','I14','I15','I16',
      // J系列 (10色)
      'J01','J02','J03','J04','J05','J06','J07','J08','J09','J10'
    ]
  },
  {
    name: '144色',
    count: 144,
    mardKeys: [
      // A系列常用
      'A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22','A23','A24',
      // B系列常用
      'B01','B02','B03','B04','B05','B06','B07','B08','B09','B10','B11','B12','B13','B14','B15','B16','B17','B18','B19','B20','B21','B22','B23','B24',
      // C系列常用
      'C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14','C15','C16','C17','C18','C19','C20','C21','C22','C23','C24',
      // D系列常用
      'D01','D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21','D22','D23','D24',
      // E系列常用
      'E01','E02','E03','E04','E05','E06','E07','E08','E09','E10','E11','E12','E13','E14','E15','E16','E17','E18','E19','E20','E21','E22','E23','E24',
      // F系列常用
      'F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24'
    ]
  },
  {
    name: '120色',
    count: 120,
    mardKeys: [
      // A系列精选
      'A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20',
      // B系列精选
      'B01','B02','B03','B04','B05','B06','B07','B08','B09','B10','B11','B12','B13','B14','B15','B16','B17','B18','B19','B20',
      // C系列精选
      'C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14','C15','C16','C17','C18','C19','C20',
      // D系列精选
      'D01','D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20',
      // E系列精选
      'E01','E02','E03','E04','E05','E06','E07','E08','E09','E10','E11','E12','E13','E14','E15','E16','E17','E18','E19','E20',
      // F系列精选
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
    allColors.forEach(color => {
      onSelectionChange(color.hex.toUpperCase(), selected);
    });
  };
  
  // 切换一个组内所有颜色的选择状态
  const toggleGroupColors = (prefix: string, selected: boolean) => {
    colorGroups[prefix].forEach(color => {
      onSelectionChange(color.hex.toUpperCase(), selected);
    });
  };
  
  // 应用MARD预设色板
  const applyMardPreset = (preset: typeof MARD_PRESET_PALETTES[0]) => {
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
    <div className="flex flex-col h-full max-h-[calc(90vh-80px)]">
      {/* 头部 */}
      <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3 mb-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
          </svg>
          色板管理中心 <span className="ml-2 text-sm text-blue-500 dark:text-blue-400">({selectedCount} 色)</span>
        </h2>
        <button 
          onClick={onClose}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* 搜索框 */}
      <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索色号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 pl-9 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
        </div>
      </div>
      
      {/* 色号系统选择 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">色号系统</label>
        <div className="flex flex-wrap gap-2">
          {(['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'] as ColorSystem[]).map((system) => (
            <button
              key={system}
              onClick={() => onColorSystemChange(system)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                selectedColorSystem === system
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {system}
            </button>
          ))}
        </div>
      </div>
      
      {/* MARD预设色板选择 - 只在MARD系统下显示 */}
      {selectedColorSystem === 'MARD' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">预设色板</label>
          <div className="flex flex-wrap gap-2">
            {MARD_PRESET_PALETTES.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyMardPreset(preset)}
                className="px-3 py-1.5 text-xs rounded-md transition-colors bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* 说明文本 */}
      <div className="mb-4 text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md border border-blue-100 dark:border-blue-800/30">
        <p className="flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          在此选择要使用的拼豆色系。您可以选择预设色板，然后根据需要手动添加或删除特定色号。完成后点击底部的&quot;保存并应用&quot;按钮。
        </p>
      </div>
      
      {/* 快捷操作按钮 */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <button
          onClick={() => toggleAllColors(true)}
          className="px-3 py-1.5 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50"
        >
          全选
        </button>
        <button
          onClick={() => toggleAllColors(false)}
          className="px-3 py-1.5 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50"
        >
          全不选
        </button>
        <button
          onClick={onImportCustomPalette}
          className="px-3 py-1.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          导入配置
        </button>
        <button
          onClick={onExportCustomPalette}
          className="px-3 py-1.5 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出配置
        </button>
      </div>
      
      {/* 颜色列表 */}
      <div className="flex-1 overflow-y-auto pr-1">
        {Object.keys(colorGroups).sort().map(prefix => (
          <div key={prefix} className="mb-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* 组标题 */}
            <div 
              className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750"
              onClick={() => toggleGroup(prefix)}
            >
              <div className="flex items-center">
                <span className="font-medium text-gray-800 dark:text-gray-200">{prefix} 系列</span>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  ({colorGroups[prefix].length} 色)
                </span>
              </div>
              
              <div className="flex items-center">
                {/* 组操作按钮 */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroupColors(prefix, true);
                  }}
                  className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 mr-2"
                >
                  全选
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroupColors(prefix, false);
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 mr-2"
                >
                  全不选
                </button>
                
                {/* 展开/收起图标 */}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 text-gray-500 dark:text-gray-400 transform transition-transform ${expandedGroups[prefix] ? 'rotate-180' : ''}`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {/* 组内容 */}
            {expandedGroups[prefix] && (
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {colorGroups[prefix].map(color => (
                  <label 
                    key={color.key} 
                    className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-750 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!currentSelections[color.hex.toUpperCase()]}
                      onChange={(e) => onSelectionChange(color.hex.toUpperCase(), e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                    />
                    <div
                      className="w-6 h-6 rounded-sm border border-gray-300 dark:border-gray-600 flex-shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{getDisplayColorKey(color.hex, selectedColorSystem)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* 底部按钮 */}
      <div className="mt-4 pt-3 border-t dark:border-gray-700 flex justify-between">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          取消
        </button>
        <button
          onClick={onSaveCustomPalette}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          保存并应用
        </button>
      </div>
    </div>
  );
};

export default CustomPaletteEditor; 