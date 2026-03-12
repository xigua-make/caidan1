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

// 工具类型
type ToolType = 'brush' | 'eraser' | 'picker' | 'fill' | 'line' | 'rectangle' | 'select' | 'move' | 'hand';

// 选区类型
interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// 剪贴板类型
interface Clipboard {
  width: number;
  height: number;
  pixels: { row: number; col: number; pixel: MappedPixel }[];
}

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

// 西瓜预览组件 - 支持拖拽和缩放
function WatermelonPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // 处理鼠标按下
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  
  // 处理鼠标移动
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);
  
  // 处理鼠标释放
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // 处理滚轮缩放
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);
  
  // 添加事件监听
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleWheel]);
  
  return (
    <div 
      ref={containerRef}
      className="h-full min-h-[400px] flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 via-white to-green-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-lg overflow-hidden relative select-none"
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-20 h-20 bg-pink-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-green-400 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-blue-400 rounded-full blur-3xl"></div>
      </div>
      
      {/* 可拖拽的像素风西瓜 */}
      <div 
        className="relative cursor-grab active:cursor-grabbing transition-transform"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 像素风格西瓜图片 */}
        <img 
          src="/logo.png" 
          alt="小瓜拼豆" 
          className="w-64 h-64 sm:w-80 sm:h-80 object-contain drop-shadow-2xl"
        />
        
        {/* 装饰星星 */}
        <div className="absolute -top-4 -right-4 w-6 h-6 bg-gradient-to-br from-yellow-400 to-pink-500 rounded-full animate-ping"></div>
        <div className="absolute -bottom-4 -left-4 w-5 h-5 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full animate-bounce"></div>
        <div className="absolute top-0 -left-3 w-3 h-3 bg-gradient-to-br from-green-400 to-teal-500 rotate-45 animate-pulse"></div>
        <div className="absolute -top-2 right-8 w-2 h-2 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full animate-spin"></div>
      </div>
      
      {/* 提示文字 */}
      <div className="absolute bottom-8 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          🎨 点击顶部「导入」按钮开始创作
        </p>
        <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
          可拖拽/滚轮缩放预览图
        </p>
      </div>
    </div>
  );
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
    return { key: hex, hex, rgb, mardKey } as PaletteColor;
  })
  .filter((color): color is PaletteColor => color !== null);

export default function Workstation() {
  // 工作台模式状态
  const [workstationMode, setWorkstationMode] = useState<WorkstationMode>('auto');
  
  // 图片和像素化状态
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  // 图纸尺寸：宽和高
  const [gridWidth, setGridWidth] = useState<number>(100);
  const [gridHeight, setGridHeight] = useState<number>(100);
  const [gridWidthInput, setGridWidthInput] = useState<string>("100");
  const [gridHeightInput, setGridHeightInput] = useState<string>("100");
  const [aspectRatioLocked, setAspectRatioLocked] = useState<boolean>(true); // 是否锁定宽高比
  const [originalAspectRatio, setOriginalAspectRatio] = useState<number | null>(null); // 原始图片宽高比
  
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
  
  // 手动编辑工具状态
  const [currentTool, setCurrentTool] = useState<ToolType>('brush');
  
  // 笔刷大小
  const [brushSize, setBrushSize] = useState<number>(1);
  
  // 历史记录（撤销/重做）
  const [history, setHistory] = useState<MappedPixel[][][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  // 选区状态
  const [selection, setSelection] = useState<Selection | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  
  // 矩形填充模式
  const [rectangleFilled, setRectangleFilled] = useState<boolean>(false);
  
  // 绘制状态（用于拖拽绘制）
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStartPos, setDrawStartPos] = useState<{ row: number; col: number } | null>(null);
  const [drawEndPos, setDrawEndPos] = useState<{ row: number; col: number } | null>(null);
  const lastDrawPosRef = useRef<{ row: number; col: number } | null>(null);
  
  // 默认颜色（当没有选择颜色时使用）
  const defaultColor = fullBeadPalette.length > 0 ? fullBeadPalette[0].hex : '#FFFFFF';
  
  // 参考图层状态
  const [referenceOpacity, setReferenceOpacity] = useState<number>(25);
  const [showReferenceLayer, setShowReferenceLayer] = useState<boolean>(true);
  
  // 色板显示状态
  const [showFullPalette, setShowFullPalette] = useState<boolean>(true);
  
  // 颜色替换状态
  const [colorReplaceState, setColorReplaceState] = useState<{
    isActive: boolean;
    step: 'select-source' | 'select-target';
    sourceColor?: { key: string; color: string };
  }>({
    isActive: false,
    step: 'select-source'
  });
  
  // 高亮颜色状态
  const [highlightColorKey, setHighlightColorKey] = useState<string | null>(null);
  
  // 自定义色板状态
  const [customPaletteSelections, setCustomPaletteSelections] = useState<PaletteSelections>({});
  const [isCustomPaletteEditorOpen, setIsCustomPaletteEditorOpen] = useState<boolean>(false);
  const [isCustomPalette, setIsCustomPalette] = useState<boolean>(false);
  
  // 移动端面板状态
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState<boolean>(false);
  const [isMobileColorSystemOpen, setIsMobileColorSystemOpen] = useState<boolean>(false);
  
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

  // 更新 activeBeadPalette - 不进行色号系统转换，保持 key 为 hex 值
  useEffect(() => {
    const newActiveBeadPalette = fullBeadPalette.filter(color => {
      const normalizedHex = color.hex.toUpperCase();
      const isSelectedInCustomPalette = customPaletteSelections[normalizedHex];
      const isNotExcluded = !excludedColorKeys.has(normalizedHex);
      return isSelectedInCustomPalette && isNotExcluded;
    });
    // 不进行色号系统转换，保持原始的MARD色号和hex值
    setActiveBeadPalette(newActiveBeadPalette);
  }, [customPaletteSelections, excludedColorKeys, remapTrigger]);

  // 同步输入框值
  useEffect(() => {
    setGridWidthInput(gridWidth.toString());
    setGridHeightInput(gridHeight.toString());
    setSimilarityThresholdInput(similarityThreshold.toString());
  }, [gridWidth, gridHeight, similarityThreshold]);

  // 设置组件挂载状态
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 防止移动端手势导致的页面退出或刷新
  useEffect(() => {
    // 防止双指缩放导致的页面行为
    const preventDefaultTouchMove = (e: TouchEvent) => {
      // 只在有图片时阻止默认行为
      if (originalImageSrc && mappedPixelData) {
        // 双指触摸时阻止默认行为
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }
    };

    // 防止双击缩放
    const preventDoubleClick = (e: MouseEvent) => {
      if (originalImageSrc && mappedPixelData) {
        e.preventDefault();
      }
    };

    // 添加事件监听
    document.addEventListener('touchmove', preventDefaultTouchMove, { passive: false });
    document.addEventListener('dblclick', preventDoubleClick, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventDefaultTouchMove);
      document.removeEventListener('dblclick', preventDoubleClick);
    };
  }, [originalImageSrc, mappedPixelData]);

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
    widthCells: number,
    heightCells: number,
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
      // 保存原始宽高比
      const aspectRatio = img.height / img.width;
      setOriginalAspectRatio(aspectRatio);
      
      // 使用用户指定的宽和高
      const N = widthCells;
      const M = heightCells;
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
      
      // 根据用户指定的网格比例计算输出高度
      const outputHeight = Math.round(outputWidth * (M / N));
      
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
    
    // 重置历史记录
    setHistory([]);
    setHistoryIndex(-1);
  }, [TRANSPARENT_KEY]);

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

  // 保存历史记录
  const saveToHistory = useCallback((data: MappedPixel[][]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(data.map(row => row.map(cell => ({ ...cell }))));
    // 限制历史记录数量
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // 撤销
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevData = history[newIndex];
      setMappedPixelData(prevData.map(row => row.map(cell => ({ ...cell }))));
      recalculateColorCounts(prevData);
    }
  }, [history, historyIndex, recalculateColorCounts]);

  // 重做
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextData = history[newIndex];
      setMappedPixelData(nextData.map(row => row.map(cell => ({ ...cell }))));
      recalculateColorCounts(nextData);
    }
  }, [history, historyIndex, recalculateColorCounts]);

  // 图片变化时触发像素化
  // 注意：依赖 customPaletteSelections 而不是 activeBeadPalette，避免排除颜色时触发重新像素化
  useEffect(() => {
    if (originalImageSrc && activeBeadPalette.length > 0) {
      const timeoutId = setTimeout(() => {
        if (originalImageSrc && originalCanvasRef.current && pixelatedCanvasRef.current && activeBeadPalette.length > 0) {
          pixelateImage(originalImageSrc, gridWidth, gridHeight, similarityThreshold, activeBeadPalette, pixelationMode);
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalImageSrc, gridWidth, gridHeight, similarityThreshold, customPaletteSelections, pixelationMode, remapTrigger]);

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
  const handleGridWidthInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setGridWidthInput(e.target.value);
  }, []);

  const handleGridHeightInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setGridHeightInput(e.target.value);
  }, []);

  const handleSimilarityThresholdInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSimilarityThresholdInput(e.target.value);
  }, []);

  const handleConfirmParameters = useCallback(() => {
    const minGrid = 10;
    const maxGrid = 300;
    
    // 处理宽度
    let newWidth = parseInt(gridWidthInput, 10);
    if (isNaN(newWidth) || newWidth < minGrid) {
      newWidth = minGrid;
    } else if (newWidth > maxGrid) {
      newWidth = maxGrid;
    }

    // 处理高度
    let newHeight = parseInt(gridHeightInput, 10);
    if (isNaN(newHeight) || newHeight < minGrid) {
      newHeight = minGrid;
    } else if (newHeight > maxGrid) {
      newHeight = maxGrid;
    }

    const minSimilarity = 0;
    const maxSimilarity = 100;
    let newSimilarity = parseInt(similarityThresholdInput, 10);
    
    if (isNaN(newSimilarity) || newSimilarity < minSimilarity) {
      newSimilarity = minSimilarity;
    } else if (newSimilarity > maxSimilarity) {
      newSimilarity = maxSimilarity;
    }

    const gridChanged = newWidth !== gridWidth || newHeight !== gridHeight;
    const similarityChanged = newSimilarity !== similarityThreshold;
    
    if (gridChanged) {
      setGridWidth(newWidth);
      setGridHeight(newHeight);
    }
    
    if (similarityChanged) {
      setSimilarityThreshold(newSimilarity);
    }
    
    // 只有在有值变化时才触发重映射
    if (gridChanged || similarityChanged) {
      setRemapTrigger(prev => prev + 1);
      setIsManualColoringMode(false);
      setSelectedColor(null);
    }

    setGridWidthInput(newWidth.toString());
    setGridHeightInput(newHeight.toString());
    setSimilarityThresholdInput(newSimilarity.toString());
  }, [gridWidthInput, gridHeightInput, similarityThresholdInput, gridWidth, gridHeight, similarityThreshold]);

  // 像素化模式变更
  // 绘制单个像素
  const drawPixel = useCallback((pixelData: MappedPixel[][], row: number, col: number, color: string | null) => {
    const newPixelData = [...pixelData];
    const height = pixelData.length;
    const width = pixelData[0]?.length || 0;
    
    if (row >= 0 && row < height && col >= 0 && col < width) {
      newPixelData[row] = [...newPixelData[row]];
      if (color === null) {
        // 删除像素（透明）
        newPixelData[row][col] = { ...transparentColorData };
      } else {
        const key = getColorKeyByHex(color, selectedColorSystem);
        newPixelData[row][col] = {
          ...newPixelData[row][col],
          color,
          key
        };
      }
    }
    
    return newPixelData;
  }, [selectedColorSystem]);

  // 水平镜像翻转整个图纸
  const flipHorizontal = useCallback(() => {
    if (!mappedPixelData) return;
    
    saveToHistory(mappedPixelData);
    
    const height = mappedPixelData.length;
    const width = mappedPixelData[0]?.length || 0;
    
    const newPixelData: MappedPixel[][] = [];
    
    for (let row = 0; row < height; row++) {
      newPixelData[row] = [];
      for (let col = 0; col < width; col++) {
        // 水平镜像：左右翻转
        newPixelData[row][col] = { ...mappedPixelData[row][width - 1 - col] };
      }
    }
    
    setMappedPixelData(newPixelData);
    recalculateColorCounts(newPixelData);
  }, [mappedPixelData, saveToHistory, recalculateColorCounts]);

  // 绘制直线（Bresenham算法）
  const drawLine = useCallback((
    pixelData: MappedPixel[][],
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    color: string | null
  ) => {
    let newPixelData = [...pixelData];
    const dx = Math.abs(endCol - startCol);
    const dy = Math.abs(endRow - startRow);
    const sx = startCol < endCol ? 1 : -1;
    const sy = startRow < endRow ? 1 : -1;
    let err = dx - dy;
    let currentCol = startCol;
    let currentRow = startRow;

    while (true) {
      newPixelData = drawPixel(newPixelData, currentRow, currentCol, color);
      
      if (currentCol === endCol && currentRow === endRow) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        currentCol += sx;
      }
      if (e2 < dx) {
        err += dx;
        currentRow += sy;
      }
    }
    
    return newPixelData;
  }, [drawPixel]);

  // 绘制矩形
  const drawRectangle = useCallback((
    pixelData: MappedPixel[][],
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    color: string | null,
    filled: boolean = false
  ) => {
    let newPixelData = [...pixelData];
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    
    if (filled) {
      // 实心矩形：填充整个区域
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          newPixelData = drawPixel(newPixelData, row, col, color);
        }
      }
    } else {
      // 空心矩形：绘制四条边
      for (let col = minCol; col <= maxCol; col++) {
        newPixelData = drawPixel(newPixelData, minRow, col, color);
        newPixelData = drawPixel(newPixelData, maxRow, col, color);
      }
      for (let row = minRow; row <= maxRow; row++) {
        newPixelData = drawPixel(newPixelData, row, minCol, color);
        newPixelData = drawPixel(newPixelData, row, maxCol, color);
      }
    }
    
    return newPixelData;
  }, [drawPixel]);

  // 处理手动绘制
  const handleManualDraw = useCallback((row: number, col: number) => {
    if (!mappedPixelData) return;
    
    // 保存历史记录
    saveToHistory(mappedPixelData);
    
    let newPixelData = [...mappedPixelData];
    const height = mappedPixelData.length;
    const width = mappedPixelData[0]?.length || 0;
    
    // 根据当前工具处理
    switch (currentTool) {
      case 'brush':
        // 画笔：绘制笔刷范围内的所有像素
        for (let dr = -(brushSize - 1); dr < brushSize; dr++) {
          for (let dc = -(brushSize - 1); dc < brushSize; dc++) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
              newPixelData = drawPixel(newPixelData, nr, nc, selectedColor?.color || null);
            }
          }
        }
        break;
        
      case 'eraser':
        // 橡皮擦：清除笔刷范围内的所有像素
        for (let dr = -(brushSize - 1); dr < brushSize; dr++) {
          for (let dc = -(brushSize - 1); dc < brushSize; dc++) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
              newPixelData = drawPixel(newPixelData, nr, nc, null);
            }
          }
        }
        break;
        
      case 'picker':
        // 取色器：获取点击位置的颜色并设为当前颜色
        if (row >= 0 && row < height && col >= 0 && col < width) {
          const pixel = mappedPixelData[row][col];
          if (pixel.color) {
            setSelectedColor({ key: pixel.key || '', color: pixel.color, isExternal: false });
            setCurrentTool('brush'); // 切换回画笔工具
          }
        }
        return; // 取色不修改数据
        
      case 'fill':
        // 填充：使用洪水填充算法
        if (row >= 0 && row < height && col >= 0 && col < width) {
          const targetColor = mappedPixelData[row][col].color;
          const fillColor = selectedColor?.color || null;
          
          if (targetColor !== fillColor) {
            const stack = [[row, col]];
            const visited = new Set<string>();
            
            while (stack.length > 0) {
              const [r, c] = stack.pop()!;
              const visitKey = `${r},${c}`;
              
              if (visited.has(visitKey)) continue;
              if (r < 0 || r >= height || c < 0 || c >= width) continue;
              if (mappedPixelData[r][c].color !== targetColor) continue;
              
              visited.add(visitKey);
              
              // 填充当前像素（不使用镜像）
              newPixelData[r] = [...newPixelData[r]];
              if (fillColor) {
                const colorKey = getColorKeyByHex(fillColor, selectedColorSystem);
                newPixelData[r][c] = { ...newPixelData[r][c], color: fillColor, key: colorKey };
              } else {
                newPixelData[r][c] = { ...transparentColorData };
              }
              
              // 添加相邻像素
              stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
            }
          }
        }
        break;
        
      case 'line':
      case 'rectangle':
        // 直线和矩形在mouseup时处理
        return;
        
      case 'select':
        // 选择工具：创建选区
        return;
        
      case 'move':
        // 移动工具：在选区内移动
        return;
    }
    
    setMappedPixelData(newPixelData);
    recalculateColorCounts(newPixelData);
  }, [mappedPixelData, currentTool, brushSize, selectedColor, selectedColorSystem, drawPixel, recalculateColorCounts, saveToHistory]);

  // 处理形状绘制（鼠标释放时）
  const handleShapeDraw = useCallback((startRow: number, startCol: number, endRow: number, endCol: number) => {
    if (!mappedPixelData) return;
    
    saveToHistory(mappedPixelData);
    
    let newPixelData = [...mappedPixelData];
    
    switch (currentTool) {
      case 'line':
        newPixelData = drawLine(newPixelData, startRow, startCol, endRow, endCol, selectedColor?.color || null);
        break;
        
      case 'rectangle':
        newPixelData = drawRectangle(newPixelData, startRow, startCol, endRow, endCol, selectedColor?.color || null, rectangleFilled);
        break;
        
      case 'select':
        // 创建选区
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);
        
        setSelection({
          startRow: minRow,
          startCol: minCol,
          endRow: maxRow,
          endCol: maxCol
        });
        return; // 选择不修改数据
    }
    
    setMappedPixelData(newPixelData);
    recalculateColorCounts(newPixelData);
  }, [mappedPixelData, currentTool, selectedColor, drawLine, drawRectangle, rectangleFilled, recalculateColorCounts, saveToHistory]);

  // 处理选区复制
  const handleCopySelection = useCallback(() => {
    if (!selection || !mappedPixelData) return;
    
    const copiedPixels: { row: number; col: number; pixel: MappedPixel }[] = [];
    
    for (let r = selection.startRow; r <= selection.endRow; r++) {
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        if (mappedPixelData[r] && mappedPixelData[r][c]) {
          copiedPixels.push({
            row: r - selection.startRow,
            col: c - selection.startCol,
            pixel: { ...mappedPixelData[r][c] }
          });
        }
      }
    }
    
    setClipboard({
      width: selection.endCol - selection.startCol + 1,
      height: selection.endRow - selection.startRow + 1,
      pixels: copiedPixels
    });
  }, [selection, mappedPixelData]);

  // 处理选区剪切
  const handleCutSelection = useCallback(() => {
    if (!selection || !mappedPixelData) return;
    
    saveToHistory(mappedPixelData);
    
    // 先复制
    handleCopySelection();
    
    // 再清除选区内容
    const newPixelData = mappedPixelData.map(row => row.map(pixel => ({ ...pixel })));
    
    for (let r = selection.startRow; r <= selection.endRow; r++) {
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        if (newPixelData[r] && newPixelData[r][c]) {
          newPixelData[r][c] = { ...transparentColorData };
        }
      }
    }
    
    setMappedPixelData(newPixelData);
    recalculateColorCounts(newPixelData);
  }, [selection, mappedPixelData, handleCopySelection, saveToHistory, recalculateColorCounts]);

  // 处理选区粘贴
  const handlePasteSelection = useCallback(() => {
    if (!clipboard || !mappedPixelData) return;
    
    saveToHistory(mappedPixelData);
    
    const newPixelData = mappedPixelData.map(row => row.map(pixel => ({ ...pixel })));
    const pasteRow = selection?.startRow || 0;
    const pasteCol = selection?.startCol || 0;
    
    clipboard.pixels.forEach(({ row, col, pixel }) => {
      const targetRow = pasteRow + row;
      const targetCol = pasteCol + col;
      
      if (targetRow >= 0 && targetRow < newPixelData.length &&
          targetCol >= 0 && targetCol < newPixelData[0].length) {
        newPixelData[targetRow][targetCol] = { ...pixel };
      }
    });
    
    setMappedPixelData(newPixelData);
    recalculateColorCounts(newPixelData);
  }, [clipboard, mappedPixelData, selection, saveToHistory, recalculateColorCounts]);

  // 处理选区清空
  const handleClearSelection = useCallback(() => {
    if (!selection || !mappedPixelData) return;
    
    saveToHistory(mappedPixelData);
    
    const newPixelData = mappedPixelData.map(row => row.map(pixel => ({ ...pixel })));
    
    for (let r = selection.startRow; r <= selection.endRow; r++) {
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        if (newPixelData[r] && newPixelData[r][c]) {
          newPixelData[r][c] = { ...transparentColorData };
        }
      }
    }
    
    setMappedPixelData(newPixelData);
    recalculateColorCounts(newPixelData);
  }, [selection, mappedPixelData, saveToHistory, recalculateColorCounts]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 撤销: Ctrl+Z
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // 重做: Ctrl+Y 或 Ctrl+Shift+Z
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault();
        handleRedo();
      }
      // 复制: Ctrl+C
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        handleCopySelection();
      }
      // 剪切: Ctrl+X
      if (e.ctrlKey && e.key === 'x') {
        e.preventDefault();
        handleCutSelection();
      }
      // 粘贴: Ctrl+V
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        handlePasteSelection();
      }
      // 工具快捷键
      if (!e.ctrlKey && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'b': 
            setCurrentTool('brush'); 
            setIsManualColoringMode(true);
            if (!selectedColor && fullBeadPalette.length > 0) {
              setSelectedColor({ key: fullBeadPalette[0].key, color: fullBeadPalette[0].hex, isExternal: false });
            }
            break;
          case 'e': 
            setCurrentTool('eraser'); 
            setIsManualColoringMode(true);
            break;
          case 'i': 
            setCurrentTool('picker'); 
            setIsManualColoringMode(true);
            break;
          case 'f': 
            setCurrentTool('fill'); 
            setIsManualColoringMode(true);
            if (!selectedColor && fullBeadPalette.length > 0) {
              setSelectedColor({ key: fullBeadPalette[0].key, color: fullBeadPalette[0].hex, isExternal: false });
            }
            break;
          case 'l': 
            setCurrentTool('line'); 
            setIsManualColoringMode(true);
            if (!selectedColor && fullBeadPalette.length > 0) {
              setSelectedColor({ key: fullBeadPalette[0].key, color: fullBeadPalette[0].hex, isExternal: false });
            }
            break;
          case 'r': 
            setCurrentTool('rectangle'); 
            setIsManualColoringMode(true);
            if (!selectedColor && fullBeadPalette.length > 0) {
              setSelectedColor({ key: fullBeadPalette[0].key, color: fullBeadPalette[0].hex, isExternal: false });
            }
            break;
          case 's': 
            setCurrentTool('select'); 
            setIsManualColoringMode(true);
            break;
          case 'm': 
            setCurrentTool('move'); 
            setIsManualColoringMode(true);
            break;
          case 'h': 
            setCurrentTool('hand'); 
            setIsManualColoringMode(false);
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleCopySelection, handleCutSelection, handlePasteSelection, selectedColor, fullBeadPalette]);

  const handlePixelationModeChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value as PixelationMode;
    if (Object.values(PixelationMode).includes(newMode)) {
      setPixelationMode(newMode);
      setRemapTrigger(prev => prev + 1);
      setIsManualColoringMode(false);
      setSelectedColor(null);
    }
  }, []);

  // 处理自定义色板中单个颜色的选择变化
  const handleSelectionChange = useCallback((hexValue: string, isSelected: boolean) => {
    const normalizedHex = hexValue.toUpperCase();
    setCustomPaletteSelections(prev => ({
      ...prev,
      [normalizedHex]: isSelected
    }));
    setIsCustomPalette(true);
  }, []);

  // 保存自定义色板并应用
  const handleSaveCustomPalette = useCallback(() => {
    savePaletteSelections(customPaletteSelections);
    setIsCustomPalette(true);
    setIsCustomPaletteEditorOpen(false);
    setRemapTrigger(prev => prev + 1);
    setIsManualColoringMode(false);
    setSelectedColor(null);
    setIsEraseMode(false);
  }, [customPaletteSelections]);

  // 导出自定义色板配置
  const handleExportCustomPalette = useCallback(() => {
    const selectedHexValues = Object.entries(customPaletteSelections)
      .filter(([, isSelected]) => isSelected)
      .map(([hexValue]) => hexValue);

    if (selectedHexValues.length === 0) {
      alert("当前没有选中的颜色，无法导出。");
      return;
    }

    const exportData = {
      version: "3.0",
      selectedHexValues: selectedHexValues,
      exportDate: new Date().toISOString(),
      totalColors: selectedHexValues.length
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `custom-palette-${selectedColorSystem}-${selectedHexValues.length}colors.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [customPaletteSelections, selectedColorSystem]);

  // 触发导入色板文件
  const triggerImportPalette = useCallback(() => {
    if (importPaletteInputRef.current) {
      importPaletteInputRef.current.click();
    }
  }, []);

  // 导入色板文件处理
  const handleImportPaletteFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.selectedHexValues && Array.isArray(data.selectedHexValues)) {
          const allHexValues = fullBeadPalette.map(c => c.hex.toUpperCase());
          const validSelections: PaletteSelections = {};
          let validCount = 0;
          
          data.selectedHexValues.forEach((hex: string) => {
            const normalizedHex = hex.toUpperCase();
            if (allHexValues.includes(normalizedHex)) {
              validSelections[normalizedHex] = true;
              validCount++;
            }
          });
          
          if (validCount > 0) {
            setCustomPaletteSelections(validSelections);
            setIsCustomPalette(true);
            alert(`成功导入 ${validCount} 个颜色。点击"保存并应用"以应用更改。`);
          } else {
            alert("导入的配置中没有有效的颜色。");
          }
        } else {
          alert("无效的配置文件格式。");
        }
      } catch {
        alert("无法解析配置文件。");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // 自动去背景 - 识别边缘主色并洪水填充去除
  const handleAutoRemoveBackground = useCallback(() => {
    if (!mappedPixelData || !gridDimensions) {
      alert('请先生成图纸后再使用一键去背景。');
      return;
    }

    const { N, M } = gridDimensions;
    const borderCounts = new Map<string, number>();

    const countBorderCell = (row: number, col: number) => {
      const cell = mappedPixelData[row]?.[col];
      if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) return;
      borderCounts.set(cell.key, (borderCounts.get(cell.key) || 0) + 1);
    };

    for (let col = 0; col < N; col++) {
      countBorderCell(0, col);
      if (M > 1) countBorderCell(M - 1, col);
    }
    for (let row = 1; row < M - 1; row++) {
      countBorderCell(row, 0);
      if (N > 1) countBorderCell(row, N - 1);
    }

    if (borderCounts.size === 0) {
      alert('边缘没有可识别的背景颜色。');
      return;
    }

    let targetKey = '';
    let maxCount = -1;
    borderCounts.forEach((count, key) => {
      if (count > maxCount) {
        maxCount = count;
        targetKey = key;
      }
    });

    const newPixelData = mappedPixelData.map(row => row.map(cell => ({ ...cell })));
    const visited = Array(M).fill(null).map(() => Array(N).fill(false));
    const stack: { row: number; col: number }[] = [];

    const pushIfTarget = (row: number, col: number) => {
      if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) {
        return;
      }
      const cell = newPixelData[row][col];
      if (!cell || cell.isExternal || cell.key !== targetKey) return;
      visited[row][col] = true;
      stack.push({ row, col });
    };

    for (let col = 0; col < N; col++) {
      pushIfTarget(0, col);
      if (M > 1) pushIfTarget(M - 1, col);
    }
    for (let row = 1; row < M - 1; row++) {
      pushIfTarget(row, 0);
      if (N > 1) pushIfTarget(row, N - 1);
    }

    if (stack.length === 0) {
      alert('未找到可去除的背景区域。');
      return;
    }

    while (stack.length > 0) {
      const { row, col } = stack.pop()!;
      newPixelData[row][col] = { ...transparentColorData };
      pushIfTarget(row - 1, col);
      pushIfTarget(row + 1, col);
      pushIfTarget(row, col - 1);
      pushIfTarget(row, col + 1);
    }

    setMappedPixelData(newPixelData);

    const newColorCounts: { [hexKey: string]: { count: number; color: string } } = {};
    let newTotalCount = 0;
    newPixelData.flat().forEach(cell => {
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        const cellHex = cell.color.toUpperCase();
        if (!newColorCounts[cellHex]) {
          newColorCounts[cellHex] = {
            count: 0,
            color: cellHex
          };
        }
        newColorCounts[cellHex].count++;
        newTotalCount++;
      }
    });

    setColorCounts(newColorCounts);
    setTotalBeadCount(newTotalCount);
    setInitialGridColorKeys(new Set(Object.keys(newColorCounts)));
  }, [mappedPixelData, gridDimensions, TRANSPARENT_KEY]);

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

      // 颜色替换模式
      if (isClick && colorReplaceState.isActive && colorReplaceState.step === 'select-source') {
        if (cellData && !cellData.isExternal && cellData.key !== TRANSPARENT_KEY) {
          setColorReplaceState({
            ...colorReplaceState,
            step: 'select-target',
            sourceColor: { key: cellData.key, color: cellData.color }
          });
        }
        return;
      }

      // 手动编辑模式
      if (isClick && isManualColoringMode) {
        const newPixelData = mappedPixelData.map(row => row.map(cell => ({ ...cell })));
        
        // 取色工具
        if (currentTool === 'picker') {
          if (cellData && !cellData.isExternal && cellData.color) {
            const displayKey = getColorKeyByHex(cellData.color, selectedColorSystem);
            setSelectedColor({ key: displayKey, color: cellData.color, isExternal: false });
            setCurrentTool('brush'); // 取色后自动切换回画笔
          }
          setTooltipData(null);
          return;
        }
        
        // 填充工具
        if (currentTool === 'fill' && selectedColor) {
          const targetColor = cellData?.color?.toUpperCase();
          const fillColor = selectedColor.color.toUpperCase();
          if (targetColor === fillColor) return; // 颜色相同不需要填充
          
          const visited = Array(M).fill(null).map(() => Array(N).fill(false));
          const stack = [{ row: j, col: i }];
          
          while (stack.length > 0) {
            const { row, col } = stack.pop()!;
            if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) continue;
            
            const cell = newPixelData[row][col];
            const cellColor = cell?.color?.toUpperCase();
            if (!cell || cell.isExternal || cellColor !== targetColor) continue;
            
            visited[row][col] = true;
            newPixelData[row][col] = { key: selectedColor.key, color: selectedColor.color, isExternal: false };
            
            stack.push({ row: row - 1, col });
            stack.push({ row: row + 1, col });
            stack.push({ row, col: col - 1 });
            stack.push({ row, col: col + 1 });
          }
          
          setMappedPixelData(newPixelData);
          recalculateColorCounts(newPixelData);
          saveToHistory(newPixelData);
          setTooltipData(null);
          return;
        }
        
        // 画笔或橡皮擦
        if ((currentTool === 'brush' || currentTool === 'eraser')) {
          // 应用笔刷大小
          const halfSize = Math.floor(brushSize / 2);
          let changed = false;
          
          for (let dj = -halfSize; dj <= halfSize; dj++) {
            for (let di = -halfSize; di <= halfSize; di++) {
              const ni = i + di;
              const nj = j + dj;
              if (ni >= 0 && ni < N && nj >= 0 && nj < M) {
                const currentCell = newPixelData[nj][ni];
                if (currentTool === 'eraser') {
                  if (!currentCell.isExternal) {
                    newPixelData[nj][ni] = { ...transparentColorData };
                    changed = true;
                  }
                } else if (selectedColor) {
                  const newCellData = { key: selectedColor.key, color: selectedColor.color, isExternal: false };
                  if (currentCell.key !== newCellData.key || currentCell.isExternal !== newCellData.isExternal) {
                    newPixelData[nj][ni] = newCellData;
                    changed = true;
                  }
                }
              }
            }
          }
          
          if (changed) {
            setMappedPixelData(newPixelData);
            recalculateColorCounts(newPixelData);
            saveToHistory(newPixelData);
          }
          setTooltipData(null);
          return;
        }
        
        // 区域擦除模式（批量擦除相同颜色）
        if (isEraseMode) {
          const targetKey = cellData?.key;
          if (!targetKey || targetKey === TRANSPARENT_KEY || cellData.isExternal) return;
          
          const visited = Array(M).fill(null).map(() => Array(N).fill(false));
          const stack = [{ row: j, col: i }];
          
          while (stack.length > 0) {
            const { row, col } = stack.pop()!;
            if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) continue;
            
            const cell = newPixelData[row][col];
            if (!cell || cell.isExternal || cell.key !== targetKey) continue;
            
            visited[row][col] = true;
            newPixelData[row][col] = { ...transparentColorData };
            
            stack.push({ row: row - 1, col });
            stack.push({ row: row + 1, col });
            stack.push({ row, col: col - 1 });
            stack.push({ row, col: col + 1 });
          }
          
          setMappedPixelData(newPixelData);
          recalculateColorCounts(newPixelData);
          saveToHistory(newPixelData);
          setIsEraseMode(false);
          setTooltipData(null);
          return;
        }
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
  }, [mappedPixelData, gridDimensions, isEraseMode, isManualColoringMode, selectedColor, recalculateColorCounts, colorReplaceState, currentTool, brushSize, saveToHistory, selectedColorSystem]);

  // 高亮完成处理
  const handleHighlightComplete = useCallback(() => {
    setHighlightColorKey(null);
  }, []);

  // 切换一键擦除模式
  const handleEraseToggle = useCallback(() => {
    setIsEraseMode(prev => !prev);
    setSelectedColor(null);
    setColorReplaceState({
      isActive: false,
      step: 'select-source'
    });
  }, []);

  // 切换颜色替换模式
  const handleColorReplaceToggle = useCallback(() => {
    setColorReplaceState(prev => {
      if (prev.isActive) {
        return { isActive: false, step: 'select-source' };
      } else {
        setIsEraseMode(false);
        setSelectedColor(null);
        return { isActive: true, step: 'select-source' };
      }
    });
  }, []);

  // 执行颜色替换
  const handleColorReplace = useCallback((sourceColor: { key: string; color: string }, targetColor: { key: string; color: string }) => {
    if (!mappedPixelData || !gridDimensions) return;

    const newMappedData = mappedPixelData.map(row => 
      row.map(cell => {
        if (!cell.isExternal && cell.color.toUpperCase() === sourceColor.color.toUpperCase()) {
          return {
            ...cell,
            key: targetColor.key,
            color: targetColor.color
          };
        }
        return cell;
      })
    );

    setMappedPixelData(newMappedData);
    recalculateColorCounts(newMappedData);
    setColorReplaceState({ isActive: false, step: 'select-source' });
  }, [mappedPixelData, gridDimensions, recalculateColorCounts]);

  // 高亮颜色
  const handleHighlightColor = useCallback((colorHex: string) => {
    setHighlightColorKey(colorHex);
    setTimeout(() => setHighlightColorKey(null), 300);
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

  // 颜色点击移除 - 将格子设为空白（透明）
  const handleColorClick = useCallback((hexKey: string) => {
    const currentExcluded = excludedColorKeys;
    const isExcluding = !currentExcluded.has(hexKey);

    if (isExcluding) {
      // 排除颜色
      if (!mappedPixelData || !gridDimensions) {
        alert("无法排除颜色，缺少必要数据。");
        return;
      }

      const nextExcludedKeys = new Set(currentExcluded);
      nextExcludedKeys.add(hexKey);

      // 创建深拷贝
      const newMappedData = mappedPixelData.map(row => row.map(cell => ({...cell})));
      const { N, M } = gridDimensions;

      // 将所有使用该颜色的格子设为透明（空白）
      for (let j = 0; j < M; j++) {
        for (let i = 0; i < N; i++) {
          const cell = newMappedData[j]?.[i];
          if (cell && !cell.isExternal && cell.color.toUpperCase() === hexKey) {
            newMappedData[j][i] = { ...transparentColorData };
          }
        }
      }

      // 更新状态
      setExcludedColorKeys(nextExcludedKeys);
      setMappedPixelData(newMappedData);

      // 重新计算计数
      const newCounts: { [hexKey: string]: { count: number; color: string } } = {};
      let newTotalCount = 0;
      newMappedData.flat().forEach(cell => {
        if (cell && cell.color && !cell.isExternal) {
          const cellHex = cell.color.toUpperCase();
          if (!newCounts[cellHex]) {
            newCounts[cellHex] = { count: 0, color: cellHex };
          }
          newCounts[cellHex].count++;
          newTotalCount++;
        }
      });
      setColorCounts(newCounts);
      setTotalBeadCount(newTotalCount);
      
    } else {
      // 恢复颜色 - 触发完全重映射
      const nextExcludedKeys = new Set(currentExcluded);
      nextExcludedKeys.delete(hexKey);
      setExcludedColorKeys(nextExcludedKeys);
      setRemapTrigger(prev => prev + 1);
    }

    setIsManualColoringMode(false);
    setSelectedColor(null);
  }, [excludedColorKeys, mappedPixelData, gridDimensions]);

  // 应用画笔/橡皮擦笔触
  const applyBrushStroke = useCallback((row: number, col: number, color: string | null, size: number) => {
    if (!mappedPixelData || !gridDimensions) return;
    
    const { N, M } = gridDimensions;
    const newMappedData = mappedPixelData.map(r => r.map(c => ({ ...c })));
    const halfSize = Math.floor(size / 2);
    
    for (let dy = -halfSize; dy <= halfSize; dy++) {
      for (let dx = -halfSize; dx <= halfSize; dx++) {
        const newRow = row + dy;
        const newCol = col + dx;
        
        if (newRow >= 0 && newRow < M && newCol >= 0 && newCol < N) {
          if (color) {
            // 画笔：设置颜色
            const colorData = findColorData(color);
            newMappedData[newRow][newCol] = {
              key: colorData?.key || color.toUpperCase(),
              color: color,
              isExternal: false
            };
          } else {
            // 橡皮擦：设为透明
            newMappedData[newRow][newCol] = { ...transparentColorData };
          }
        }
      }
    }
    
    setMappedPixelData(newMappedData);
  }, [mappedPixelData, gridDimensions]);

  // 使用 Bresenham 算法在两点之间绘制笔触（插值绘制）
  const applyBrushStrokeLine = useCallback((
    startRow: number, startCol: number,
    endRow: number, endCol: number,
    color: string | null,
    size: number
  ) => {
    if (!mappedPixelData || !gridDimensions) return;
    
    const { N, M } = gridDimensions;
    const halfSize = Math.floor(size / 2);
    
    // Bresenham 直线算法
    const dx = Math.abs(endCol - startCol);
    const dy = Math.abs(endRow - startRow);
    const sx = startCol < endCol ? 1 : -1;
    const sy = startRow < endRow ? 1 : -1;
    let err = dx - dy;
    let col = startCol;
    let row = startRow;
    
    // 收集所有需要绘制的点
    const points: { row: number; col: number }[] = [];
    
    while (true) {
      points.push({ row, col });
      
      if (row === endRow && col === endCol) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        col += sx;
      }
      if (e2 < dx) {
        err += dx;
        row += sy;
      }
    }
    
    // 批量更新所有点
    setMappedPixelData(prevData => {
      if (!prevData) return prevData;
      const newMappedData = prevData.map(r => r.map(c => ({ ...c })));
      
      for (const point of points) {
        for (let dy = -halfSize; dy <= halfSize; dy++) {
          for (let dx = -halfSize; dx <= halfSize; dx++) {
            const newRow = point.row + dy;
            const newCol = point.col + dx;
            
            if (newRow >= 0 && newRow < M && newCol >= 0 && newCol < N) {
              if (color) {
                // 画笔：设置颜色
                const colorData = findColorData(color);
                newMappedData[newRow][newCol] = {
                  key: colorData?.key || color.toUpperCase(),
                  color: color,
                  isExternal: false
                };
              } else {
                // 橡皮擦：设为透明
                newMappedData[newRow][newCol] = { ...transparentColorData };
              }
            }
          }
        }
      }
      
      return newMappedData;
    });
  }, [mappedPixelData, gridDimensions]);

  // 绘制开始 - 接收网格坐标
  const handleDrawStart = useCallback((gridCol: number, gridRow: number) => {
    if (!mappedPixelData) return;
    
    const pos = { row: gridRow, col: gridCol };
    
    // 保存历史记录
    saveToHistory(mappedPixelData);
    
    setDrawStartPos(pos);
    setDrawEndPos(pos);
    setIsDrawing(true);
    
    // 初始化上一次绘制位置
    lastDrawPosRef.current = pos;
    
    // 对于移动工具，保存选区内容
    if (currentTool === 'move' && selection) {
      // 检查点击是否在选区内
      if (pos.row >= selection.startRow && pos.row <= selection.endRow &&
          pos.col >= selection.startCol && pos.col <= selection.endCol) {
        // 复制选区内容到剪贴板
        const copiedPixels: { row: number; col: number; pixel: MappedPixel }[] = [];
        for (let r = selection.startRow; r <= selection.endRow; r++) {
          for (let c = selection.startCol; c <= selection.endCol; c++) {
            copiedPixels.push({
              row: r - selection.startRow,
              col: c - selection.startCol,
              pixel: { ...mappedPixelData[r][c] }
            });
          }
        }
        setClipboard({
          width: selection.endCol - selection.startCol + 1,
          height: selection.endRow - selection.startRow + 1,
          pixels: copiedPixels
        });
      }
    }
    
    // 对于画笔和橡皮擦，立即执行一次操作
    if (currentTool === 'brush' || currentTool === 'eraser') {
      const color = currentTool === 'brush' ? (selectedColor?.color || defaultColor) : null;
      applyBrushStroke(pos.row, pos.col, color, brushSize);
    }
  }, [currentTool, selectedColor, defaultColor, brushSize, mappedPixelData, saveToHistory, selection, applyBrushStroke]);

  // 绘制移动 - 接收网格坐标
  const handleDrawMove = useCallback((gridCol: number, gridRow: number) => {
    // 使用 drawStartPos 代替 isDrawing 检查，避免 React 状态更新延迟问题
    if (!drawStartPos) return;
    
    const pos = { row: gridRow, col: gridCol };
    setDrawEndPos(pos);
    
    // 对于画笔和橡皮擦，使用插值绘制从上一个点到当前位置
    if (currentTool === 'brush' || currentTool === 'eraser') {
      const color = currentTool === 'brush' ? (selectedColor?.color || defaultColor) : null;
      
      if (lastDrawPosRef.current) {
        // 从上一个位置到当前位置进行插值绘制
        applyBrushStrokeLine(
          lastDrawPosRef.current.row, lastDrawPosRef.current.col,
          pos.row, pos.col,
          color, brushSize
        );
      } else {
        // 如果没有上一个位置，直接绘制当前位置
        applyBrushStroke(pos.row, pos.col, color, brushSize);
      }
      
      // 更新上一个绘制位置
      lastDrawPosRef.current = pos;
    }
  }, [drawStartPos, currentTool, selectedColor, defaultColor, brushSize, applyBrushStroke, applyBrushStrokeLine]);

  // 绘制结束 - 接收网格坐标
  const handleDrawEnd = useCallback((gridCol: number, gridRow: number) => {
    // 即使 isDrawing 为 false 也尝试完成绘制（用于移动端触摸结束）
    const pos = { row: gridRow, col: gridCol };
    
    // 如果没有开始位置，重置状态并返回
    if (!drawStartPos || !mappedPixelData) {
      setIsDrawing(false);
      setDrawStartPos(null);
      setDrawEndPos(null);
      return;
    }
    
    setDrawEndPos(pos);
    
    // 根据工具类型执行最终操作
    let newPixelData = mappedPixelData.map(r => r.map(c => ({ ...c })));
    const color = selectedColor?.color || null;
    
    switch (currentTool) {
      case 'line':
        newPixelData = drawLine(newPixelData, drawStartPos.row, drawStartPos.col, pos.row, pos.col, color);
        setMappedPixelData(newPixelData);
        recalculateColorCounts(newPixelData);
        break;
      case 'rectangle':
        newPixelData = drawRectangle(newPixelData, drawStartPos.row, drawStartPos.col, pos.row, pos.col, color, rectangleFilled);
        setMappedPixelData(newPixelData);
        recalculateColorCounts(newPixelData);
        break;
      case 'select':
        createSelection(drawStartPos.row, drawStartPos.col, pos.row, pos.col);
        break;
      case 'move':
        // 移动选区内容
        if (selection && clipboard) {
          const dx = pos.col - drawStartPos.col;
          const dy = pos.row - drawStartPos.row;
          
          // 清空原选区内容
          for (let r = selection.startRow; r <= selection.endRow; r++) {
            for (let c = selection.startCol; c <= selection.endCol; c++) {
              if (r >= 0 && r < newPixelData.length && c >= 0 && c < newPixelData[0].length) {
                newPixelData[r][c] = { ...transparentColorData };
              }
            }
          }
          
          // 在新位置绘制选区内容
          const newStartRow = selection.startRow + dy;
          const newStartCol = selection.startCol + dx;
          
          clipboard.pixels.forEach(({ row, col, pixel }) => {
            const targetRow = newStartRow + row;
            const targetCol = newStartCol + col;
            
            if (targetRow >= 0 && targetRow < newPixelData.length &&
                targetCol >= 0 && targetCol < newPixelData[0].length) {
              newPixelData[targetRow][targetCol] = { ...pixel };
            }
          });
          
          // 更新选区位置
          setSelection({
            startRow: newStartRow,
            startCol: newStartCol,
            endRow: newStartRow + clipboard.height - 1,
            endCol: newStartCol + clipboard.width - 1
          });
          
          setMappedPixelData(newPixelData);
          recalculateColorCounts(newPixelData);
        }
        break;
      default:
        break;
    }
    
    setIsDrawing(false);
    setDrawStartPos(null);
    setDrawEndPos(null);
    lastDrawPosRef.current = null; // 重置上一次绘制位置
  }, [isDrawing, drawStartPos, currentTool, mappedPixelData, selectedColor, drawLine, drawRectangle, rectangleFilled, selection, clipboard, recalculateColorCounts]);

  // 创建选区
  const createSelection = useCallback((startRow: number, startCol: number, endRow: number, endCol: number) => {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    
    setSelection({
      startRow: minRow,
      startCol: minCol,
      endRow: maxRow,
      endCol: maxCol
    });
  }, []);

  // 查找颜色数据
  const findColorData = useCallback((hexColor: string) => {
    // 使用工具函数获取颜色键
    const key = getColorKeyByHex(hexColor, selectedColorSystem);
    return {
      key,
      color: hexColor
    };
  }, [selectedColorSystem]);

  // 获取排序后的颜色列表
  const sortedColorCounts = useMemo(() => {
    if (!colorCounts) return [];
    return Object.entries(colorCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([key, data]) => ({ key, ...data }));
  }, [colorCounts]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden" style={{ touchAction: 'pan-y' }}>
      {/* 顶部导航栏 - 固定显示，不随页面滚动隐藏 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200/70 dark:border-gray-700/70 shadow-sm">
        {/* 桌面端布局 */}
        <div className="hidden md:flex items-center justify-between px-4 py-2">
          {/* 左侧 Logo - 西瓜图标 */}
          <div className="flex items-center gap-3">
            <a href="/" className="relative w-10 h-10 bg-gradient-to-b from-green-400 to-green-600 rounded-full shadow-lg border-2 border-green-700 dark:border-green-800 overflow-hidden hover:scale-105 transition-transform">
              {/* Watermelon stripes */}
              <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-0 left-1/4 w-0.5 h-2.5 bg-green-700/30 rounded-full"></div>
                <div className="absolute top-0 left-1/2 w-0.5 h-3 bg-green-700/30 rounded-full"></div>
                <div className="absolute top-0 right-1/4 w-0.5 h-2 bg-green-700/30 rounded-full"></div>
              </div>
              {/* Red flesh */}
              <div className="absolute bottom-0.5 left-0.5 right-0.5 h-7 bg-gradient-to-b from-red-400 to-red-500 rounded-b-full">
                {/* Seeds */}
                <div className="absolute top-1.5 left-1.5 w-1 h-1.5 bg-gray-900 rounded-full rotate-45"></div>
                <div className="absolute top-3 left-3 w-1 h-1.5 bg-gray-900 rounded-full -rotate-12"></div>
                <div className="absolute top-2 right-1.5 w-1 h-1.5 bg-gray-900 rounded-full rotate-12"></div>
                <div className="absolute top-4 right-3 w-1 h-1.5 bg-gray-900 rounded-full -rotate-45"></div>
              </div>
            </a>
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
            <button
              onClick={() => setIsCustomPaletteEditorOpen(true)}
              className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {selectedColorSystem} {activeBeadPalette.length}
            </button>
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

        {/* 移动端布局 */}
        <div className="md:hidden px-3 py-2.5 flex items-center justify-between gap-3">
          {/* Logo + 品牌名 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href="/" className="w-9 h-9 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm overflow-hidden bg-white flex items-center justify-center">
              <img src="/logo.png" alt="小瓜拼豆" className="w-8 h-8 object-contain" />
            </a>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">小瓜</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">拼豆底稿生成器</div>
            </div>
          </div>
          
          {/* 右侧：模式切换 + 按钮 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 模式切换 */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-full p-0.5">
              <button
                onClick={() => setWorkstationMode('auto')}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                  workstationMode === 'auto'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                自动
              </button>
              <button
                onClick={() => setWorkstationMode('manual')}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                  workstationMode === 'manual'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                手动
              </button>
              <button
                onClick={() => setIsMobileColorSystemOpen(true)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                  isMobileColorSystemOpen
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                色号
              </button>
            </div>
            
            {/* 导入/下载按钮 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={triggerFileInput}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 rounded-lg hover:border-blue-400"
              >
                导入
              </button>
              <button
                onClick={() => setIsDownloadSettingsOpen(true)}
                disabled={!mappedPixelData}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 rounded-lg hover:border-green-400 disabled:opacity-50"
              >
                下载
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区域 - 使用Grid布局实现响应式，添加padding-top补偿fixed header */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-0 lg:gap-0 pt-[60px] lg:pt-[56px]">
        {/* 左侧画布区域 */}
        <main ref={mainRef} className="relative flex flex-col min-h-0 h-full overflow-hidden">
          {!originalImageSrc ? (
            <>
              {/* 桌面端：西瓜Logo预览 */}
              <div className="hidden lg:block h-full">
                <WatermelonPreview />
              </div>
              
              {/* 移动端：两个大按钮 */}
              <div className="lg:hidden flex-1 flex flex-col items-center justify-center px-4 gap-3 bg-gradient-to-br from-pink-50 via-white to-green-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800">
                <button
                  onClick={triggerFileInput}
                  className="w-full max-w-sm p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 text-center hover:shadow-md transition-shadow"
                >
                  <p className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">上传图片开始生成</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">支持 JPG / PNG，点击或拖拽到画布</p>
                </button>
                
                <button
                  onClick={() => {
                    // 创建 100x100 空白画布
                    const newPixelData: MappedPixel[][] = [];
                    for (let i = 0; i < 100; i++) {
                      const row: MappedPixel[] = [];
                      for (let j = 0; j < 100; j++) {
                        row.push({ key: TRANSPARENT_KEY, color: transparentColorData.color, isExternal: false });
                      }
                      newPixelData.push(row);
                    }
                    setMappedPixelData(newPixelData);
                    setGridDimensions({ N: 100, M: 100 });
                    setGridWidth(100);
                    setGridHeight(100);
                    setGridWidthInput('100');
                    setGridHeightInput('100');
                    setWorkstationMode('manual');
                    setIsManualColoringMode(true);
                    // 初始化历史记录
                    setHistory([newPixelData]);
                    setHistoryIndex(0);
                  }}
                  className="w-full max-w-sm p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 text-center hover:shadow-md transition-shadow"
                >
                  <p className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">手动空白画板编辑</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">创建 100×100 空白画布，使用画笔自由设计</p>
                </button>
              </div>
            </>
          ) : (
            /* 画布显示区域 */
            <div className="h-full flex flex-col p-2 sm:p-4">
              {/* 画布信息 */}
              {gridDimensions && (
                <div className="mb-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center">
                  高精度网格 {gridDimensions.N}×{gridDimensions.M} · 支持拖拽/缩放
                </div>
              )}
              
              {/* 画布容器 */}
              <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm overflow-hidden">
                <PixelatedPreviewCanvas
                  canvasRef={pixelatedCanvasRef}
                  mappedPixelData={mappedPixelData}
                  gridDimensions={gridDimensions}
                  isManualColoringMode={isManualColoringMode}
                  onInteraction={handleCanvasInteraction}
                  highlightColorKey={highlightColorKey}
                  onHighlightComplete={handleHighlightComplete}
                  onDrawStart={handleDrawStart}
                  onDrawMove={handleDrawMove}
                  onDrawEnd={handleDrawEnd}
                  currentTool={currentTool}
                  selectedColor={selectedColor?.color}
                  brushSize={brushSize}
                  rectangleFilled={rectangleFilled}
                  originalImageSrc={originalImageSrc}
                  showReferenceLayer={showReferenceLayer}
                  referenceOpacity={referenceOpacity}
                  previewStartPos={drawStartPos}
                  previewEndPos={drawEndPos}
                  isDrawing={isDrawing}
                  selection={selection}
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

        {/* 右侧功能面板 - 移动端在底部，桌面端在右侧 */}
        <aside className="h-full overflow-y-auto bg-white dark:bg-gray-800 border-t lg:border-t-0 lg:border-l border-gray-200/70 dark:border-gray-700/70 lg:w-80">
          {workstationMode === 'auto' ? (
            /* 自动优化模式右侧栏 */
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              {/* 处理参数模块 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">处理参数</h3>
                
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400">图纸尺寸 (10-300):</label>
                  <div className="flex gap-2 mt-1">
                    <div className="flex-1">
                      <input
                        type="number"
                        value={gridWidthInput}
                        onChange={handleGridWidthInputChange}
                        placeholder="宽"
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        min="10"
                        max="300"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block text-center">宽</span>
                    </div>
                    <span className="flex items-center text-gray-400">×</span>
                    <div className="flex-1">
                      <input
                        type="number"
                        value={gridHeightInput}
                        onChange={handleGridHeightInputChange}
                        placeholder="高"
                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        min="10"
                        max="300"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block text-center">高</span>
                    </div>
                  </div>
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
                  {sortedColorCounts.slice(0, 20).map(({ key, color, count }) => {
                    const displayKey = getColorKeyByHex(key, selectedColorSystem);
                    const isExcluded = excludedColorKeys.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => handleColorClick(key)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                          isExcluded
                            ? 'opacity-40 bg-gray-100 dark:bg-gray-700 line-through'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600"
                            style={{ backgroundColor: color }}
                          ></div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{displayKey}</span>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{count}颗</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : workstationMode === 'manual' ? (
            /* 手动编辑模式右侧栏 */
            <div className="p-4 space-y-3 overflow-y-auto">
              {/* 顶部标题区 */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">手动编辑</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">空格拖拽·滚轮缩放·Ctrl+Z 撤销</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* 撤销 */}
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="p-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="撤销 (Ctrl+Z)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>
                  {/* 重做 */}
                  <button
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="重做 (Ctrl+Y)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                    </svg>
                  </button>
                  {/* 放大镜 */}
                  <button
                    onClick={() => setIsFloatingPaletteOpen(!isFloatingPaletteOpen)}
                    className="p-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                    title="放大镜"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* 当前选中颜色 */}
              {selectedColor && selectedColor.key !== TRANSPARENT_KEY && (
                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div
                    className="w-6 h-6 rounded border border-gray-300 dark:border-gray-500"
                    style={{ backgroundColor: selectedColor.color }}
                  ></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {getColorKeyByHex(selectedColor.color, selectedColorSystem)} {selectedColor.color}
                  </span>
                </div>
              )}

              {/* 工具区块 */}
              <div className="bg-white dark:bg-gray-700 rounded-xl p-3 space-y-3 shadow-sm border border-gray-100 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">工具</h4>
                  <span className="text-xs text-gray-400 dark:text-gray-500">当前: {currentTool === 'brush' ? '画笔' : currentTool === 'eraser' ? '橡皮' : currentTool === 'picker' ? '取色' : currentTool === 'fill' ? '填充' : currentTool === 'line' ? '直线' : currentTool === 'rectangle' ? '矩形' : currentTool === 'select' ? '选择' : currentTool === 'move' ? '移动' : '拖拽'}</span>
                </div>
                
                {/* 工具按钮矩阵 3x3 */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setCurrentTool('brush');
                      setIsManualColoringMode(true);
                      setIsEraseMode(false);
                      // 如果没有选择颜色，选择第一个颜色
                      if (!selectedColor && fullBeadPalette.length > 0) {
                        setSelectedColor({ key: fullBeadPalette[0].key, color: fullBeadPalette[0].hex, isExternal: false });
                      }
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      currentTool === 'brush'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    画笔(B)
                  </button>
                  <button
                    onClick={() => { setCurrentTool('eraser'); setIsManualColoringMode(true); setIsEraseMode(false); }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      currentTool === 'eraser'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    橡皮(E)
                  </button>
                  <button
                    onClick={() => { setCurrentTool('picker'); setIsManualColoringMode(true); setIsEraseMode(false); }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      currentTool === 'picker'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    取色(I)
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTool('fill');
                      setIsManualColoringMode(true);
                      setIsEraseMode(false);
                      // 如果没有选择颜色，选择第一个颜色
                      if (!selectedColor && fullBeadPalette.length > 0) {
                        setSelectedColor({ key: fullBeadPalette[0].key, color: fullBeadPalette[0].hex, isExternal: false });
                      }
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      currentTool === 'fill'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    填充(F)
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTool('line');
                      setIsManualColoringMode(true);
                      setIsEraseMode(false);
                      // 如果没有选择颜色，选择第一个颜色
                      if (!selectedColor && fullBeadPalette.length > 0) {
                        setSelectedColor({ key: fullBeadPalette[0].key, color: fullBeadPalette[0].hex, isExternal: false });
                      }
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      currentTool === 'line'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    直线(L)
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTool('rectangle');
                      setIsManualColoringMode(true);
                      setIsEraseMode(false);
                      // 如果没有选择颜色，选择第一个颜色
                      if (!selectedColor && fullBeadPalette.length > 0) {
                        setSelectedColor({ key: fullBeadPalette[0].key, color: fullBeadPalette[0].hex, isExternal: false });
                      }
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      currentTool === 'rectangle'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    矩形(R)
                  </button>
                  <button
                    onClick={() => { setCurrentTool('select'); setIsManualColoringMode(true); setIsEraseMode(false); }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      currentTool === 'select'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    选择(S)
                  </button>
                  <button
                    onClick={() => { setCurrentTool('move'); setIsManualColoringMode(true); setIsEraseMode(false); }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      currentTool === 'move'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    移动(M)
                  </button>
                  <button
                    onClick={() => { setCurrentTool('hand'); setIsManualColoringMode(false); setIsEraseMode(false); }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      currentTool === 'hand'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    拖拽(H)
                  </button>
                </div>
                
                {/* 擦除与替换工具 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleEraseToggle}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      isEraseMode
                        ? 'bg-orange-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    区域擦除
                  </button>
                  <button
                    onClick={handleColorReplaceToggle}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      colorReplaceState.isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    批量替换
                  </button>
                </div>
                
                {/* 颜色替换状态提示 */}
                {colorReplaceState.isActive && (
                  <div className="p-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg text-xs text-orange-600 dark:text-orange-400">
                    {colorReplaceState.step === 'select-source' ? '点击画布选择要替换的颜色' : '在色板中选择目标颜色'}
                  </div>
                )}
              </div>

              {/* 画笔与形状区块 */}
              <div className="bg-white dark:bg-gray-700 rounded-xl p-3 space-y-3 shadow-sm border border-gray-100 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">画笔与形状</h4>
                  <span className="text-xs text-gray-400 dark:text-gray-500">笔刷{brushSize}</span>
                </div>
                
                {/* 笔刷大小滑块 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">笔刷大小</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{brushSize}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                
                {/* 形状与镜像工具 */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setRectangleFilled(!rectangleFilled)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                      rectangleFilled
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    矩形实心
                  </button>
                  <button
                    onClick={flipHorizontal}
                    disabled={!mappedPixelData}
                    className="py-2 px-2 rounded-lg text-xs font-medium bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="水平镜像翻转整个图纸"
                  >
                    水平镜像
                  </button>
                </div>
              </div>

              {/* 选区与剪贴板区块 */}
              <div className="bg-white dark:bg-gray-700 rounded-xl p-3 space-y-3 shadow-sm border border-gray-100 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">选区与剪贴板</h4>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{selection ? '已选择' : '未选择'}</span>
                </div>
                
                {/* 剪贴板操作按钮 */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={handleCopySelection}
                    disabled={!selection}
                    className="py-2 px-2 rounded-lg text-xs font-medium bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="复制 (Ctrl+C)"
                  >
                    复制
                  </button>
                  <button
                    onClick={handleCutSelection}
                    disabled={!selection}
                    className="py-2 px-2 rounded-lg text-xs font-medium bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="剪切 (Ctrl+X)"
                  >
                    剪切
                  </button>
                  <button
                    onClick={handlePasteSelection}
                    disabled={!clipboard}
                    className="py-2 px-2 rounded-lg text-xs font-medium bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="粘贴 (Ctrl+V)"
                  >
                    粘贴
                  </button>
                  <button
                    onClick={handleClearSelection}
                    disabled={!selection}
                    className="py-2 px-2 rounded-lg text-xs font-medium bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    清空选区
                  </button>
                </div>
                
                {/* 取消选择按钮 */}
                <button
                  onClick={() => setSelection(null)}
                  disabled={!selection}
                  className="w-full py-2 rounded-lg text-xs font-medium bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  取消选择
                </button>
              </div>

              {/* 参考图层区块 */}
              <div className="bg-white dark:bg-gray-700 rounded-xl p-3 space-y-3 shadow-sm border border-gray-100 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">参考图层</h4>
                  <button
                    onClick={() => setShowReferenceLayer(!showReferenceLayer)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      showReferenceLayer
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    {showReferenceLayer ? '隐藏' : '显示'}
                  </button>
                </div>
                
                {/* 透明度滑块 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">透明度</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{referenceOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={referenceOpacity}
                    onChange={(e) => setReferenceOpacity(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* 色板区块 */}
              <div className="bg-white dark:bg-gray-700 rounded-xl p-3 space-y-3 shadow-sm border border-gray-100 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {showFullPalette ? `完整色板(${fullBeadPalette.length})` : `当前色板(${sortedColorCounts.length})`}
                  </h4>
                  <button
                    onClick={() => setShowFullPalette(!showFullPalette)}
                    className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {showFullPalette ? '切换当前' : '切换完整'}
                  </button>
                </div>
                
                {/* 色板网格 */}
                <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1">
                  {(showFullPalette ? fullBeadPalette : sortedColorCounts.map(c => {
                    // 为当前色板生成正确的 mardKey
                    const mardKey = getColorKeyByHex(c.color.toUpperCase(), 'MARD');
                    return { hex: c.color, key: c.key, mardKey };
                  })).map((colorItem) => {
                    const hexColor = colorItem.hex;
                    const isSelected = selectedColor && selectedColor.color.toUpperCase() === hexColor.toUpperCase();
                    // 判断颜色深浅来决定文字颜色
                    const rgb = hexToRgb(hexColor);
                    const isLightColor = rgb ? (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128 : false;
                    // 显示的色号：使用 mardKey（MARD 色号）
                    const displayKey = colorItem.mardKey;
                    return (
                      <button
                        key={hexColor}
                        onClick={() => {
                          if (colorReplaceState.isActive && colorReplaceState.step === 'select-target' && colorReplaceState.sourceColor) {
                            handleColorReplace(colorReplaceState.sourceColor, { key: colorItem.key, color: hexColor });
                          } else {
                            setSelectedColor({ key: colorItem.key, color: hexColor, isExternal: false });
                            setIsEraseMode(false);
                            handleHighlightColor(hexColor);
                          }
                        }}
                        className={`group relative w-7 h-7 rounded border-2 transition-all hover:scale-110 flex items-center justify-center ${
                          isSelected && currentTool !== 'eraser'
                            ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                            : 'border-gray-200 dark:border-gray-500 hover:border-gray-300 dark:hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: hexColor }}
                        title={`${displayKey} - ${hexColor}`}
                      >
                        {/* 显示色号 */}
                        <span className={`text-[9px] font-bold leading-none ${isLightColor ? 'text-gray-800' : 'text-white'}`} style={{ textShadow: isLightColor ? '0 0 2px rgba(255,255,255,0.8)' : '0 0 2px rgba(0,0,0,0.8)' }}>
                          {displayKey}
                        </span>
                        {isSelected && currentTool !== 'eraser' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-5 h-5 border-2 border-white rounded shadow-lg"></div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* 专心拼豆模式右侧栏 */
            <div className="p-4 space-y-4">
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
                专心拼豆模式
              </div>
            </div>
          )}
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

      {/* 自定义色板编辑器弹窗 */}
      {isCustomPaletteEditorOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 隐藏的文件输入框 */}
            <input
              type="file"
              accept=".json"
              ref={importPaletteInputRef}
              onChange={handleImportPaletteFile}
              className="hidden"
            />
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              <CustomPaletteEditor
                allColors={fullBeadPalette}
                currentSelections={customPaletteSelections}
                onSelectionChange={handleSelectionChange}
                onSaveCustomPalette={handleSaveCustomPalette}
                onClose={() => setIsCustomPaletteEditorOpen(false)}
                onExportCustomPalette={handleExportCustomPalette}
                onImportCustomPalette={triggerImportPalette}
                selectedColorSystem={selectedColorSystem}
                onColorSystemChange={setSelectedColorSystem}
              />
            </div>
          </div>
        </div>
      )}

      {/* 移动端色号选择弹窗 */}
      {isMobileColorSystemOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-[100] flex items-end md:hidden">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">色号系统</h3>
              <button
                onClick={() => setIsMobileColorSystemOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 色号系统选择 */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'MARD', name: 'MARD' },
                  { key: 'COCO', name: 'COCO' },
                  { key: '漫漫', name: '漫漫' },
                  { key: '盼盼', name: '盼盼' },
                  { key: '咪小窝', name: '咪小窝' },
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      setSelectedColorSystem(option.key as ColorSystem);
                      setIsMobileColorSystemOpen(false);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedColorSystem === option.key
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 色板预览 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  当前色板: {activeBeadPalette.length} 色
                </span>
                <button
                  onClick={() => {
                    setIsMobileColorSystemOpen(false);
                    setIsCustomPaletteEditorOpen(true);
                  }}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  编辑色板
                </button>
              </div>
              
              {/* 色板网格 */}
              <div className="grid grid-cols-8 gap-1">
                {activeBeadPalette.slice(0, 96).map((colorItem) => {
                  const hexColor = colorItem.hex;
                  const rgb = hexToRgb(hexColor);
                  const isLightColor = rgb ? (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128 : false;
                  const displayKey = colorItem.mardKey || getColorKeyByHex(hexColor.toUpperCase(), selectedColorSystem);
                  
                  return (
                    <button
                      key={hexColor}
                      onClick={() => {
                        setSelectedColor({ key: displayKey, color: hexColor, isExternal: false });
                        setIsMobileColorSystemOpen(false);
                      }}
                      className="aspect-square rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:scale-110 transition-transform"
                      style={{ backgroundColor: hexColor }}
                      title={`${displayKey} - ${hexColor}`}
                    >
                      <span className={`text-[7px] font-bold leading-none ${isLightColor ? 'text-gray-800' : 'text-white'}`} style={{ textShadow: isLightColor ? '0 0 1px rgba(255,255,255,0.5)' : '0 0 1px rgba(0,0,0,0.5)' }}>
                        {displayKey}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              {activeBeadPalette.length > 96 && (
                <p className="text-center text-xs text-gray-400 mt-2">
                  显示前96色，共 {activeBeadPalette.length} 色
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
