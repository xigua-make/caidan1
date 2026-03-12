'use client';

import React, { useState, useRef, ChangeEvent, DragEvent, useEffect, useMemo, useCallback } from 'react';

// 导入像素化工具和类型
import {
  PixelationMode,
  calculatePixelGrid,
  RgbColor,
  PaletteColor,
  MappedPixel,
  hexToRgb,
  colorDistance,
  findClosestPaletteColor
} from '../../utils/pixelation';

// 导入类型和组件
import { GridDownloadOptions } from '../../types/downloadTypes';
import DownloadSettingsModal, { gridLineColorOptions } from '../../components/DownloadSettingsModal';
import { downloadImage } from '../../utils/imageDownloader';

import { 
  colorSystemOptions, 
  convertPaletteToColorSystem, 
  getColorKeyByHex,
  getMardToHexMapping,
  sortColorsByHue,
  ColorSystem 
} from '../../utils/colorSystemUtils';

// 导入组件
import PixelatedPreviewCanvas from '../../components/PixelatedPreviewCanvas';
import GridTooltip from '../../components/GridTooltip';
import CustomPaletteEditor from '../../components/CustomPaletteEditor';
import FloatingColorPalette from '../../components/FloatingColorPalette';
import FloatingToolbar from '../../components/FloatingToolbar';
import { loadPaletteSelections, savePaletteSelections, presetToSelections, PaletteSelections } from '../../utils/localStorageUtils';
import { TRANSPARENT_KEY, transparentColorData } from '../../utils/pixelEditingUtils';

// 工作台模式类型
type WorkstationMode = 'auto' | 'manual' | 'focus';

// Helper function for sorting color keys
function sortColorKeys(a: string, b: string): number {
  const regex = /^([A-Z]+)(\d+)$/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);

  if (matchA && matchB) {
    const prefixA = matchA[1];
    const numA = parseInt(matchA[2], 10);
    const prefixB = matchB[1];
    const numB = parseInt(matchB[2], 10);

    if (prefixA !== prefixB) {
      return prefixA.localeCompare(prefixB);
    }
    return numA - numB;
  }
  return a.localeCompare(b);
}

// 从colorSystemMapping.json获取所有MARD色号
const mardToHexMapping = getMardToHexMapping();

// 预处理完整调色板数据
const fullBeadPalette: PaletteColor[] = Object.entries(mardToHexMapping)
  .map(([mardKey, hex]) => {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      console.warn(`Invalid hex code "${hex}" for MARD key "${mardKey}". Skipping.`);
      return null;
    }
    return { key: hex, hex, rgb };
  })
  .filter((color): color is PaletteColor => color !== null);

export default function Workstation() {
  // 工作台模式状态
  const [workstationMode, setWorkstationMode] = useState<WorkstationMode>('auto');
  
  // 图片和像素化状态
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<number>(100);
  const [granularityInput, setGranularityInput] = useState<string>("100");
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(30);
  const [similarityThresholdInput, setSimilarityThresholdInput] = useState<string>("30");
  const [pixelationMode, setPixelationMode] = useState<PixelationMode>(PixelationMode.Dominant);
  
  // 色号系统选择状态
  const [selectedColorSystem, setSelectedColorSystem] = useState<ColorSystem>('MARD');
  
  // 调色板状态
  const [activeBeadPalette, setActiveBeadPalette] = useState<PaletteColor[]>(() => {
    return fullBeadPalette;
  });
  const [excludedColorKeys, setExcludedColorKeys] = useState<Set<string>>(new Set());
  const [showExcludedColors, setShowExcludedColors] = useState<boolean>(false);
  const [initialGridColorKeys, setInitialGridColorKeys] = useState<Set<string>>(new Set());
  
  // 像素数据状态
  const [mappedPixelData, setMappedPixelData] = useState<MappedPixel[][] | null>(null);
  const [gridDimensions, setGridDimensions] = useState<{ N: number; M: number } | null>(null);
  const [colorCounts, setColorCounts] = useState<{ [key: string]: { count: number; color: string } } | null>(null);
  const [totalBeadCount, setTotalBeadCount] = useState<number>(0);
  const [tooltipData, setTooltipData] = useState<{ x: number, y: number, key: string, color: string } | null>(null);
  const [remapTrigger, setRemapTrigger] = useState<number>(0);
  
  // 手动编辑模式状态
  const [isManualColoringMode, setIsManualColoringMode] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<MappedPixel | null>(null);
  const [isEraseMode, setIsEraseMode] = useState<boolean>(false);
  
  // 自定义色板状态
  const [customPaletteSelections, setCustomPaletteSelections] = useState<PaletteSelections>({});
  const [isCustomPaletteEditorOpen, setIsCustomPaletteEditorOpen] = useState<boolean>(false);
  const [isCustomPalette, setIsCustomPalette] = useState<boolean>(false);
  
  // 下载设置状态
  const [isDownloadSettingsOpen, setIsDownloadSettingsOpen] = useState<boolean>(false);
  const [downloadOptions, setDownloadOptions] = useState<GridDownloadOptions>({
    showGrid: true,
    gridInterval: 10,
    showCoordinates: true,
    showCellNumbers: true,
    gridLineColor: gridLineColorOptions[0].value,
    includeStats: true,
    exportCsv: false
  });

  // 高亮相关状态
  const [highlightColorKey, setHighlightColorKey] = useState<string | null>(null);
  const [showFullPalette, setShowFullPalette] = useState<boolean>(false);
  
  // 颜色替换状态
  const [colorReplaceState, setColorReplaceState] = useState<{
    isActive: boolean;
    step: 'select-source' | 'select-target';
    sourceColor?: { key: string; color: string };
  }>({
    isActive: false,
    step: 'select-source'
  });

  // 组件挂载状态
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // 悬浮调色盘状态
  const [isFloatingPaletteOpen, setIsFloatingPaletteOpen] = useState<boolean>(true);

  // 活跃工具层级管理
  const [activeFloatingTool, setActiveFloatingTool] = useState<'palette' | 'magnifier' | null>(null);

  // Refs
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const pixelatedCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importPaletteInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // 当前网格颜色
  const currentGridColors = useMemo(() => {
    if (!mappedPixelData) return [];
    const uniqueColorsMap = new Map<string, MappedPixel>();
    mappedPixelData.flat().forEach(cell => {
      if (cell && cell.color && !cell.isExternal) {
        const hexKey = cell.color.toUpperCase();
        if (!uniqueColorsMap.has(hexKey)) {
          uniqueColorsMap.set(hexKey, { key: cell.key, color: cell.color });
        }
      }
    });
    
    const originalColors = Array.from(uniqueColorsMap.values());
    const colorData = originalColors.map(color => {
      const displayKey = getColorKeyByHex(color.color.toUpperCase(), selectedColorSystem);
      return { key: displayKey, color: color.color };
    });

    return sortColorsByHue(colorData);
  }, [mappedPixelData, selectedColorSystem]);

  // 初始化时从本地存储加载自定义色板选择
  useEffect(() => {
    const savedSelections = loadPaletteSelections();
    if (savedSelections && Object.keys(savedSelections).length > 0) {
      const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
      const validSelections: PaletteSelections = {};
      let hasValidData = false;
      
      Object.entries(savedSelections).forEach(([key, value]) => {
        if (/^#[0-9A-F]{6}$/i.test(key) && allHexValues.includes(key.toUpperCase())) {
          validSelections[key.toUpperCase()] = value;
          hasValidData = true;
        }
      });
      
      if (hasValidData) {
        setCustomPaletteSelections(validSelections);
        setIsCustomPalette(true);
      } else {
        localStorage.removeItem('customPerlerPaletteSelections');
        const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
        const initialSelections = presetToSelections(allHexValues, allHexValues);
        setCustomPaletteSelections(initialSelections);
        setIsCustomPalette(false);
      }
    } else {
      const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
      const initialSelections = presetToSelections(allHexValues, allHexValues);
      setCustomPaletteSelections(initialSelections);
      setIsCustomPalette(false);
    }
  }, []);

  // 更新 activeBeadPalette
  useEffect(() => {
    const newActiveBeadPalette = fullBeadPalette.filter(color => {
      const normalizedHex = color.hex.toUpperCase();
      const isSelectedInCustomPalette = customPaletteSelections[normalizedHex];
      const isNotExcluded = !excludedColorKeys.has(normalizedHex);
      return isSelectedInCustomPalette && isNotExcluded;
    });
    const convertedPalette = convertPaletteToColorSystem(newActiveBeadPalette, selectedColorSystem);
    setActiveBeadPalette(convertedPalette);
  }, [customPaletteSelections, excludedColorKeys, remapTrigger, selectedColorSystem]);

  // 同步输入框值
  useEffect(() => {
    setGranularityInput(granularity.toString());
    setSimilarityThresholdInput(similarityThreshold.toString());
  }, [granularity, similarityThreshold]);

  // 设置组件挂载状态
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 模式切换处理
  useEffect(() => {
    if (workstationMode === 'manual') {
      setIsManualColoringMode(true);
    } else {
      setIsManualColoringMode(false);
    }
  }, [workstationMode]);

  // 像素化处理函数
  const pixelateImage = useCallback((
    imageSrc: string,
    detailLevel: number,
    threshold: number,
    currentPalette: PaletteColor[],
    mode: PixelationMode
  ) => {
    const originalCanvas = originalCanvasRef.current;
    const pixelatedCanvas = pixelatedCanvasRef.current;

    if (!originalCanvas || !pixelatedCanvas) return;
    
    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    if (!originalCtx) return;

    if (currentPalette.length === 0) {
      console.error("Cannot pixelate: The selected color palette is empty.");
      return;
    }

    // 找到备用颜色
    const t1FallbackColor = currentPalette.find(p => p.key === 'T1')
                         || currentPalette.find(p => p.hex.toUpperCase() === '#FFFFFF')
                         || currentPalette[0];

    const img = new window.Image();
    
    img.onerror = () => {
      alert("无法加载图片。");
      setOriginalImageSrc(null);
      setMappedPixelData(null);
      setGridDimensions(null);
      setColorCounts(null);
      setInitialGridColorKeys(new Set());
    };
    
    img.onload = () => {
      const aspectRatio = img.height / img.width;
      const N = detailLevel;
      const M = Math.max(1, Math.round(N * aspectRatio));
      if (N <= 0 || M <= 0) return;

      // 设置画布尺寸
      const baseWidth = 500;
      const minCellSize = 4;
      const recommendedCellSize = 6;
      
      let outputWidth = baseWidth;
      
      if (N > 100) {
        const requiredWidthForMinSize = N * minCellSize;
        const requiredWidthForRecommendedSize = N * recommendedCellSize;
        const maxWidth = Math.min(1200, typeof window !== 'undefined' ? window.innerWidth * 0.9 : 1200);
        outputWidth = Math.min(maxWidth, Math.max(baseWidth, requiredWidthForRecommendedSize));
        outputWidth = Math.max(outputWidth, requiredWidthForMinSize);
      }
      
      const outputHeight = Math.round(outputWidth * aspectRatio);
      
      originalCanvas.width = img.width;
      originalCanvas.height = img.height;
      pixelatedCanvas.width = outputWidth;
      pixelatedCanvas.height = outputHeight;

      originalCtx.drawImage(img, 0, 0, img.width, img.height);

      // 使用 calculatePixelGrid 进行初始颜色映射
      const initialMappedData = calculatePixelGrid(
        originalCtx,
        img.width,
        img.height,
        N,
        M,
        currentPalette,
        mode,
        t1FallbackColor
      );

      // 颜色合并逻辑
      const keyToRgbMap = new Map<string, RgbColor>();
      const keyToColorDataMap = new Map<string, PaletteColor>();
      currentPalette.forEach(p => {
        keyToRgbMap.set(p.key, p.rgb);
        keyToColorDataMap.set(p.key, p);
      });

      // 统计初始颜色数量
      const initialColorCounts: { [key: string]: number } = {};
      initialMappedData.flat().forEach(cell => {
        if (cell && cell.key && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
          initialColorCounts[cell.key] = (initialColorCounts[cell.key] || 0) + 1;
        }
      });

      // 创建颜色排序列表
      const colorsByFrequency = Object.entries(initialColorCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

      // 复制初始数据
      const mergedData: MappedPixel[][] = initialMappedData.map(row => 
        row.map(cell => ({ ...cell, isExternal: cell.isExternal ?? false }))
      );

      // 处理相似颜色合并
      const replacedColors = new Set<string>();
      
      for (let i = 0; i < colorsByFrequency.length; i++) {
        const currentKey = colorsByFrequency[i];
        if (replacedColors.has(currentKey)) continue;
        
        const currentRgb = keyToRgbMap.get(currentKey);
        if (!currentRgb) continue;
        
        for (let j = i + 1; j < colorsByFrequency.length; j++) {
          const lowerFreqKey = colorsByFrequency[j];
          if (replacedColors.has(lowerFreqKey)) continue;
          
          const lowerFreqRgb = keyToRgbMap.get(lowerFreqKey);
          if (!lowerFreqRgb) continue;
          
          const dist = colorDistance(currentRgb, lowerFreqRgb);
          
          if (dist < threshold) {
            replacedColors.add(lowerFreqKey);
            
            for (let r = 0; r < M; r++) {
              for (let c = 0; c < N; c++) {
                if (mergedData[r][c].key === lowerFreqKey) {
                  const colorData = keyToColorDataMap.get(currentKey);
                  if (colorData) {
                    mergedData[r][c] = {
                      key: currentKey,
                      color: colorData.hex,
                      isExternal: false
                    };
                  }
                }
              }
            }
          }
        }
      }

      // 更新状态
      setMappedPixelData(mergedData);
      setGridDimensions({ N, M });

      // 计算颜色统计
      const counts: { [key: string]: { count: number; color: string } } = {};
      let totalCount = 0;
      mergedData.flat().forEach(cell => {
        if (cell && cell.key && !cell.isExternal) {
          const hexKey = cell.color;
          if (!counts[hexKey]) {
            counts[hexKey] = { count: 0, color: cell.color };
          }
          counts[hexKey].count++;
          totalCount++;
        }
      });
      setColorCounts(counts);
      setTotalBeadCount(totalCount);
      setInitialGridColorKeys(new Set(Object.keys(counts)));
    };
    
    img.src = imageSrc;
    setIsManualColoringMode(false);
    setSelectedColor(null);
  }, [TRANSPARENT_KEY]);

  // 图片变化时触发像素化
  useEffect(() => {
    if (originalImageSrc && activeBeadPalette.length > 0) {
      const timeoutId = setTimeout(() => {
        if (originalImageSrc && originalCanvasRef.current && pixelatedCanvasRef.current && activeBeadPalette.length > 0) {
          pixelateImage(originalImageSrc, granularity, similarityThreshold, activeBeadPalette, pixelationMode);
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [originalImageSrc, granularity, similarityThreshold, activeBeadPalette, pixelationMode, pixelateImage]);

  // 文件输入触发函数
  const triggerFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  // 处理文件选择
  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setOriginalImageSrc(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // 拖放处理
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setOriginalImageSrc(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // 参数输入处理
  const handleGranularityInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setGranularityInput(e.target.value);
  }, []);

  const handleSimilarityThresholdInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSimilarityThresholdInput(e.target.value);
  }, []);

  const handleConfirmParameters = useCallback(() => {
    const newGranularity = parseInt(granularityInput, 10);
    const newThreshold = parseInt(similarityThresholdInput, 10);
    
    if (!isNaN(newGranularity) && newGranularity >= 10 && newGranularity <= 300) {
      setGranularity(newGranularity);
    }
    
    if (!isNaN(newThreshold) && newThreshold >= 0 && newThreshold <= 100) {
      setSimilarityThreshold(newThreshold);
    }
  }, [granularityInput, similarityThresholdInput]);

  // 像素化模式变更
  const handlePixelationModeChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setPixelationMode(e.target.value as PixelationMode);
  }, []);

  // 自动去背景
  const handleAutoRemoveBackground = useCallback(() => {
    if (!mappedPixelData || !gridDimensions) return;
    
    const newMappedPixelData = mappedPixelData.map(row => 
      row.map(cell => {
        if (cell.isExternal) return cell;
        return { ...cell, isExternal: true };
      })
    );
    
    setMappedPixelData(newMappedPixelData);
    recalculateColorCounts(newMappedPixelData);
  }, [mappedPixelData, gridDimensions]);

  // 重新计算颜色计数
  const recalculateColorCounts = useCallback((data: MappedPixel[][]) => {
    const counts: { [key: string]: { count: number; color: string } } = {};
    let total = 0;
    
    data.flat().forEach(cell => {
      if (cell && cell.color && !cell.isExternal) {
        const key = cell.key;
        if (!counts[key]) {
          counts[key] = { count: 0, color: cell.color };
        }
        counts[key].count++;
        total++;
      }
    });
    
    setColorCounts(counts);
    setTotalBeadCount(total);
  }, []);

  // 画布交互处理
  const handleCanvasInteraction = useCallback((
    clientX: number,
    clientY: number,
    pageX: number,
    pageY: number,
    isClick: boolean = false,
    isTouchEnd: boolean = false
  ) => {
    if (isTouchEnd) {
      setTooltipData(null);
      return;
    }

    const canvas = pixelatedCanvasRef.current;
    if (!canvas || !mappedPixelData || !gridDimensions) {
      setTooltipData(null);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    const { N, M } = gridDimensions;
    const cellWidthOutput = canvas.width / N;
    const cellHeightOutput = canvas.height / M;

    const i = Math.floor(canvasX / cellWidthOutput);
    const j = Math.floor(canvasY / cellHeightOutput);

    if (i >= 0 && i < N && j >= 0 && j < M) {
      const cellData = mappedPixelData[j][i];

      if (isClick && isEraseMode) {
        // 擦除模式
        const newMappedPixelData = [...mappedPixelData];
        newMappedPixelData[j] = [...newMappedPixelData[j]];
        newMappedPixelData[j][i] = { ...cellData, isExternal: true };
        setMappedPixelData(newMappedPixelData);
        recalculateColorCounts(newMappedPixelData);
        setTooltipData(null);
        return;
      }

      // 更新tooltip
      if (cellData && !cellData.isExternal) {
        setTooltipData({
          x: clientX,
          y: clientY,
          key: cellData.key,
          color: cellData.color
        });
      } else {
        setTooltipData(null);
      }
    } else {
      setTooltipData(null);
    }
  }, [mappedPixelData, gridDimensions, isEraseMode, recalculateColorCounts]);

  // 高亮完成处理
  const handleHighlightComplete = useCallback(() => {
    // 高亮完成后的处理
  }, []);

  // 下载请求处理
  const handleDownloadRequest = (options?: GridDownloadOptions) => {
    downloadImage({
      mappedPixelData,
      gridDimensions,
      colorCounts,
      totalBeadCount,
      options: options || downloadOptions,
      activeBeadPalette,
      selectedColorSystem
    });
  };

  // 颜色点击移除
  const handleColorClick = useCallback((key: string) => {
    setExcludedColorKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  // 获取排序后的颜色列表
  const sortedColorCounts = useMemo(() => {
    if (!colorCounts) return [];
    return Object.entries(colorCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([key, data]) => ({ key, ...data }));
  }, [colorCounts]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between px-4 py-2">
          {/* 左侧 Logo */}
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-4 gap-0.5 p-1 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
              {['bg-red-400', 'bg-blue-400', 'bg-yellow-400', 'bg-green-400',
                'bg-purple-400', 'bg-pink-400', 'bg-orange-400', 'bg-teal-400',
                'bg-indigo-400', 'bg-cyan-400', 'bg-lime-400', 'bg-amber-400',
                'bg-rose-400', 'bg-sky-400', 'bg-emerald-400', 'bg-violet-400'].map((color, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full ${color}`}></div>
              ))}
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500">
                小瓜
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">拼豆底稿生成器</span>
            </div>
          </div>

          {/* 中间模式切换 */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setWorkstationMode('auto')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                workstationMode === 'auto'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600'
              }`}
            >
              自动优化
            </button>
            <button
              onClick={() => setWorkstationMode('manual')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                workstationMode === 'manual'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600'
              }`}
            >
              手动编辑
            </button>
            <button
              onClick={() => setWorkstationMode('focus')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                workstationMode === 'focus'
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600'
              }`}
            >
              专心拼豆
            </button>
          </div>

          {/* 右侧功能按钮 */}
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full">
              {selectedColorSystem} {activeBeadPalette.length}
            </span>
            <button
              onClick={triggerFileInput}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            >
              导入
            </button>
            <button
              onClick={() => setIsDownloadSettingsOpen(true)}
              disabled={!mappedPixelData}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下载
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧画布区域 */}
        <main ref={mainRef} className="flex-1 overflow-auto p-4">
          {!originalImageSrc ? (
            /* 上传区域 */
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onClick={isMounted ? triggerFileInput : undefined}
              className={`h-full min-h-[400px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center ${
                isMounted ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800' : 'cursor-wait'
              } transition-all duration-300`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">拖放图片到此处，或点击选择文件</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">支持 JPG, PNG 图片格式</p>
            </div>
          ) : (
            /* 画布显示区域 */
            <div className="h-full flex flex-col">
              {/* 画布信息 */}
              {gridDimensions && (
                <div className="mb-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                  高精度网格 {gridDimensions.N}×{gridDimensions.M} · 支持拖拽/缩放
                </div>
              )}
              
              {/* 画布容器 */}
              <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow-inner overflow-hidden">
                <PixelatedPreviewCanvas
                  canvasRef={pixelatedCanvasRef}
                  mappedPixelData={mappedPixelData}
                  gridDimensions={gridDimensions}
                  isManualColoringMode={isManualColoringMode}
                  onInteraction={handleCanvasInteraction}
                  highlightColorKey={highlightColorKey}
                  onHighlightComplete={handleHighlightComplete}
                />
              </div>
            </div>
          )}

          {/* 隐藏的文件输入 */}
          <input
            type="file"
            accept="image/jpeg, image/png"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden"
          />
          
          {/* 隐藏的原始画布 */}
          <canvas ref={originalCanvasRef} className="hidden" />
        </main>

        {/* 右侧功能面板 */}
        <aside className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* 处理参数模块 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">处理参数</h3>
              
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400">横轴切割数量 (10-300):</label>
                <input
                  type="number"
                  value={granularityInput}
                  onChange={handleGranularityInputChange}
                  className="w-full mt-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  min="10"
                  max="300"
                />
              </div>
              
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400">颜色合并阈值 (0-100):</label>
                <input
                  type="number"
                  value={similarityThresholdInput}
                  onChange={handleSimilarityThresholdInputChange}
                  className="w-full mt-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  min="0"
                  max="100"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmParameters}
                  className="flex-1 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                >
                  应用数字
                </button>
                <button
                  onClick={handleAutoRemoveBackground}
                  disabled={!mappedPixelData || !gridDimensions}
                  className="flex-1 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  一键去背景
                </button>
              </div>
              
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400">处理模式:</label>
                <select
                  value={pixelationMode}
                  onChange={handlePixelationModeChange}
                  className="w-full mt-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value={PixelationMode.Dominant}>卡通 (主色)</option>
                  <option value={PixelationMode.Average}>真实 (平均)</option>
                </select>
              </div>
            </div>

            {/* 分隔线 */}
            <hr className="border-gray-200 dark:border-gray-700" />

            {/* 去除杂色模块 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">去除杂色</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">点击颜色可移除。总计: {totalBeadCount} 颗</p>
              
              <div className="max-h-48 overflow-y-auto space-y-1">
                {sortedColorCounts.slice(0, 20).map(({ key, color, count }) => (
                  <button
                    key={key}
                    onClick={() => handleColorClick(key)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                      excludedColorKeys.has(key)
                        ? 'opacity-40 bg-gray-100 dark:bg-gray-700'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: color }}
                      ></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{key}</span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{count}颗</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 工具提示 */}
      <GridTooltip
        tooltipData={tooltipData}
        selectedColorSystem={selectedColorSystem}
      />

      {/* 下载设置弹窗 */}
      <DownloadSettingsModal
        isOpen={isDownloadSettingsOpen}
        onClose={() => setIsDownloadSettingsOpen(false)}
        options={downloadOptions}
        onOptionsChange={setDownloadOptions}
        onDownload={handleDownloadRequest}
      />
    </div>
  );
}
