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
  }, [TRANSPARENT_KEY]);

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

      // 手动上色模式
      if (isClick && isManualColoringMode && selectedColor) {
        const newPixelData = mappedPixelData.map(row => row.map(cell => ({ ...cell })));
        const currentCell = newPixelData[j]?.[i];

        if (!currentCell) return;

        const previousKey = currentCell.key;
        const wasExternal = currentCell.isExternal;
        
        let newCellData: MappedPixel;
        
        if (selectedColor.key === TRANSPARENT_KEY) {
          newCellData = { ...transparentColorData };
        } else if (isEraseMode) {
          // 区域擦除模式：洪水填充擦除相同颜色的格子
          const targetKey = currentCell.key;
          if (targetKey === TRANSPARENT_KEY || currentCell.isExternal) return;
          
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
          setIsEraseMode(false);
          setTooltipData(null);
          return;
        } else {
          newCellData = { ...selectedColor, isExternal: false };
        }

        // 只有状态变化时才更新
        if (newCellData.key !== previousKey || newCellData.isExternal !== wasExternal) {
          newPixelData[j][i] = newCellData;
          setMappedPixelData(newPixelData);
          recalculateColorCounts(newPixelData);
        }
        
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
  }, [mappedPixelData, gridDimensions, isEraseMode, isManualColoringMode, selectedColor, recalculateColorCounts, colorReplaceState]);

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
          {workstationMode === 'auto' ? (
            /* 自动优化模式右侧栏 */
            <div className="p-4 space-y-4">
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
            <div className="p-4 space-y-4">
              {/* 参考图层模块 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">参考图层</h3>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={showReferenceLayer}
                      onChange={(e) => setShowReferenceLayer(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">显示</span>
                  </label>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">透明度</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{referenceOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={referenceOpacity}
                    onChange={(e) => setReferenceOpacity(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>
              </div>

              {/* 分隔线 */}
              <hr className="border-gray-200 dark:border-gray-700" />

              {/* 完整色板模块 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {showFullPalette ? `完整色板(${fullBeadPalette.length})` : `当前色板(${sortedColorCounts.length})`}
                  </h3>
                </div>
                
                {/* 颜色替换状态提示 */}
                {colorReplaceState.isActive && (
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg text-xs">
                    <div className="flex items-center gap-1 text-orange-700 dark:text-orange-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      <span>
                        {colorReplaceState.step === 'select-source' ? '点击画布选择要替换的颜色' : '在色板中选择目标颜色'}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* 工具按钮行 */}
                <div className="flex gap-2">
                  {/* 橡皮擦按钮 */}
                  <button
                    onClick={() => {
                      setSelectedColor({ key: TRANSPARENT_KEY, color: '#FFFFFF', isExternal: false });
                      setIsEraseMode(false);
                      setColorReplaceState({ isActive: false, step: 'select-source' });
                    }}
                    className={`flex-1 p-2 rounded-lg border transition-all duration-200 flex items-center justify-center gap-1 text-xs ${
                      selectedColor?.key === TRANSPARENT_KEY
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    橡皮擦
                  </button>

                  {/* 区域擦除按钮 */}
                  <button
                    onClick={handleEraseToggle}
                    className={`flex-1 p-2 rounded-lg border transition-all duration-200 flex items-center justify-center gap-1 text-xs ${
                      isEraseMode
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    区域擦除
                  </button>

                  {/* 颜色替换按钮 */}
                  <button
                    onClick={handleColorReplaceToggle}
                    className={`flex-1 p-2 rounded-lg border transition-all duration-200 flex items-center justify-center gap-1 text-xs ${
                      colorReplaceState.isActive
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    批量替换
                  </button>
                </div>

                {/* 色板切换按钮 */}
                <button
                  onClick={() => setShowFullPalette(!showFullPalette)}
                  className="w-full text-xs py-2 px-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {showFullPalette ? `切换到当前色板 (${sortedColorCounts.length})` : `切换到完整色板 (${fullBeadPalette.length})`}
                </button>
                
                {/* 色板网格 */}
                <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto p-1">
                  {(showFullPalette ? fullBeadPalette : sortedColorCounts.map(c => ({ hex: c.color, key: c.key }))).map((colorItem) => {
                    const hexColor = colorItem.hex;
                    const isSelected = selectedColor && selectedColor.color.toUpperCase() === hexColor.toUpperCase();
                    const displayKey = getColorKeyByHex(hexColor, selectedColorSystem);
                    return (
                      <button
                        key={hexColor}
                        onClick={() => {
                          // 颜色替换模式：选择目标颜色
                          if (colorReplaceState.isActive && colorReplaceState.step === 'select-target' && colorReplaceState.sourceColor) {
                            handleColorReplace(colorReplaceState.sourceColor, { key: displayKey, color: hexColor });
                          } else {
                            setSelectedColor({ key: displayKey, color: hexColor, isExternal: false });
                            setIsEraseMode(false);
                            handleHighlightColor(hexColor);
                          }
                        }}
                        className={`group relative w-8 h-8 rounded border-2 transition-all hover:scale-110 ${
                          isSelected && !isEraseMode
                            ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                        style={{ backgroundColor: hexColor }}
                        title={`${displayKey} - ${hexColor}`}
                      >
                        {/* 选中指示器 */}
                        {isSelected && !isEraseMode && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full shadow-lg"></div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* 当前选中颜色显示 */}
                {selectedColor && selectedColor.key !== TRANSPARENT_KEY && !isEraseMode && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div
                      className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: selectedColor.color }}
                    ></div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      当前: {selectedColor.key}
                    </span>
                  </div>
                )}
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
    </div>
  );
}
