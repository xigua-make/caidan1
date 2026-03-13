'use client';

import React, { useRef, useEffect, TouchEvent, MouseEvent, useState, WheelEvent, useCallback, useMemo } from 'react';
import { MappedPixel } from '../utils/pixelation';
import { getColorKeyByHex, ColorSystem } from '../utils/colorSystemUtils';

// 工具类型
type ToolType = 'brush' | 'eraser' | 'picker' | 'fill' | 'line' | 'rectangle' | 'select' | 'move' | 'hand';

// iOS 设备检测
const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// iOS canvas 最大尺寸限制（保守估计，避免内存问题）
const IOS_MAX_CANVAS_DIMENSION = 3000;
const IOS_MAX_CANVAS_AREA = 9000000; // 约 9MB 像素

interface PixelatedPreviewCanvasProps {
  mappedPixelData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  isManualColoringMode: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onInteraction: (
    clientX: number,
    clientY: number,
    pageX: number,
    pageY: number,
    isClick: boolean,
    isTouchEnd?: boolean
  ) => void;
  highlightColorKey?: string | null;
  onHighlightComplete?: () => void;
  // 绘制事件回调 - 传递网格坐标
  onDrawStart?: (gridX: number, gridY: number) => void;
  onDrawMove?: (gridX: number, gridY: number) => void;
  onDrawEnd?: (gridX: number, gridY: number) => void;
  // 预览相关
  currentTool?: ToolType;
  selectedColor?: string | null;
  brushSize?: number;
  rectangleFilled?: boolean;
  // 参考图层
  originalImageSrc?: string | null;
  showReferenceLayer?: boolean;
  referenceOpacity?: number;
  // 预览状态
  previewStartPos?: { row: number; col: number } | null;
  previewEndPos?: { row: number; col: number } | null;
  isDrawing?: boolean;
  selection?: { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  // 显示色号
  showColorLabels?: boolean;
  selectedColorSystem?: ColorSystem;
  // 网格线设置
  showGridLines?: boolean;
  gridLineInterval?: number;
  gridLineColor?: string;
  // 显示坐标轴
  showCoordinates?: boolean;
  // 文字模式
  isTextMode?: boolean;
  // 点击颜色回调（拖拽模式下点击格子时触发）
  onColorClick?: (colorHex: string) => void;
}

// 只绘制像素颜色的函数（用于离屏canvas缓存）
const drawPixelColors = (
  dataToDraw: MappedPixel[][],
  canvas: HTMLCanvasElement | null,
  dims: { N: number; M: number } | null,
  highlightColorKey?: string | null,
  isHighlighting?: boolean
) => {
  if (!canvas || !dims || !dataToDraw) return;
  
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) return;

  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const externalBackgroundColor = isDarkMode ? '#374151' : '#F3F4F6';

  const { N, M } = dims;
  const cellWidth = canvas.width / N;
  const cellHeight = canvas.height / M;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 按颜色批量绘制格子
  const colorGroups = new Map<string, Array<{ i: number; j: number }>>();
  
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cellData = dataToDraw[j]?.[i];
      if (!cellData) continue;
      
      const color = cellData.isExternal ? externalBackgroundColor : cellData.color;
      if (!colorGroups.has(color)) {
        colorGroups.set(color, []);
      }
      colorGroups.get(color)!.push({ i, j });
    }
  }
  
  colorGroups.forEach((cells, color) => {
    ctx.fillStyle = color;
    cells.forEach(({ i, j }) => {
      ctx.fillRect(i * cellWidth, j * cellHeight, cellWidth, cellHeight);
    });
  });

  // 高亮处理
  if (isHighlighting && highlightColorKey) {
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const cellData = dataToDraw[j]?.[i];
        if (!cellData) continue;
        
        const shouldDim = cellData.isExternal || 
          cellData.color.toUpperCase() !== highlightColorKey.toUpperCase();
        
        if (shouldDim) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(i * cellWidth, j * cellHeight, cellWidth, cellHeight);
        }
      }
    }
  }
};

// 绘制像素化画布的函数（网格线和色号）
const drawPixelatedCanvas = (
  dataToDraw: MappedPixel[][],
  canvas: HTMLCanvasElement | null,
  dims: { N: number; M: number } | null,
  highlightColorKey?: string | null,
  isHighlighting?: boolean,
  showColorLabels?: boolean,
  colorSystem?: ColorSystem,
  showGridLines?: boolean,
  gridLineInterval?: number,
  gridLineColorProp?: string,
  skipPixels?: boolean // 是否跳过像素绘制
) => {
  if (!canvas || !dims || !dataToDraw) {
    console.warn("drawPixelatedCanvas: Missing required parameters");
    return;
  }
  
  const pixelatedCtx = canvas.getContext('2d', { willReadFrequently: false });
  if (!pixelatedCtx) {
    console.error("Failed to get 2D context for pixelated canvas");
    return;
  }

  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const defaultGridLineColor = isDarkMode ? '#4B5563' : '#DDDDDD';
  const gridLineColor = gridLineColorProp || defaultGridLineColor;

  const { N, M } = dims;
  const outputWidth = canvas.width;
  const outputHeight = canvas.height;
  const cellWidthOutput = outputWidth / N;
  const cellHeightOutput = outputHeight / M;
  
  // 计算当前缩放比例（基础格子大小为6px）
  const baseCellSize = 6;
  const currentScale = cellWidthOutput / baseCellSize;

  // 如果不跳过像素绘制，则绘制像素颜色
  if (!skipPixels) {
    pixelatedCtx.clearRect(0, 0, outputWidth, outputHeight);
    
    const externalBackgroundColor = isDarkMode ? '#374151' : '#F3F4F6';
    
    // 性能优化：按颜色批量绘制格子
    const colorGroups = new Map<string, Array<{ i: number; j: number }>>();
    
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const cellData = dataToDraw[j]?.[i];
        if (!cellData) continue;
        
        const color = cellData.isExternal ? externalBackgroundColor : cellData.color;
        if (!colorGroups.has(color)) {
          colorGroups.set(color, []);
        }
        colorGroups.get(color)!.push({ i, j });
      }
    }
    
    // 批量绘制相同颜色的格子
    colorGroups.forEach((cells, color) => {
      pixelatedCtx.fillStyle = color;
      cells.forEach(({ i, j }) => {
        const drawX = i * cellWidthOutput;
        const drawY = j * cellHeightOutput;
        pixelatedCtx.fillRect(drawX, drawY, cellWidthOutput, cellHeightOutput);
      });
    });

    // 高亮处理
    if (isHighlighting && highlightColorKey) {
      for (let j = 0; j < M; j++) {
        for (let i = 0; i < N; i++) {
          const cellData = dataToDraw[j]?.[i];
          if (!cellData) continue;
          
          const drawX = i * cellWidthOutput;
          const drawY = j * cellHeightOutput;
          
          const shouldDim = cellData.isExternal || 
            cellData.color.toUpperCase() !== highlightColorKey.toUpperCase();
          
          if (shouldDim) {
            pixelatedCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            pixelatedCtx.fillRect(drawX, drawY, cellWidthOutput, cellHeightOutput);
          }
        }
      }
    }
  }
  
  // 性能优化：使用 Path2D 批量绘制细网格线
  // 只在格子足够大时绘制细网格线（性能优化）
  // 网格线粗细保持固定（不随scale变化）
  const shouldDrawThinLines = cellWidthOutput >= 3 && cellHeightOutput >= 3;
  
  if (shouldDrawThinLines) {
    const thinGridLineColor = '#AAAAAA';
    pixelatedCtx.strokeStyle = thinGridLineColor;
    // 细网格线保持1px视觉粗细
    pixelatedCtx.lineWidth = Math.max(0.5, 1 / currentScale);
    
    const thinLinesPath = new Path2D();
    for (let j = 0; j <= M; j++) {
      const y = j * cellHeightOutput;
      thinLinesPath.moveTo(0, y);
      thinLinesPath.lineTo(outputWidth, y);
    }
    for (let i = 0; i <= N; i++) {
      const x = i * cellWidthOutput;
      thinLinesPath.moveTo(x, 0);
      thinLinesPath.lineTo(x, outputHeight);
    }
    pixelatedCtx.stroke(thinLinesPath);
  }
  
  // 绘制分组网格线（每N格一条粗线）- 粗细保持固定
  if (showGridLines && gridLineInterval && gridLineInterval > 1) {
    pixelatedCtx.strokeStyle = gridLineColor;
    // 粗网格线保持2.5px视觉粗细
    pixelatedCtx.lineWidth = Math.max(1, 2.5 / currentScale);
    
    const thickLinesPath = new Path2D();
    // 垂直线
    for (let i = 0; i <= N; i += gridLineInterval) {
      const x = i * cellWidthOutput;
      thickLinesPath.moveTo(x, 0);
      thickLinesPath.lineTo(x, outputHeight);
    }
    
    // 水平线
    for (let j = 0; j <= M; j += gridLineInterval) {
      const y = j * cellHeightOutput;
      thickLinesPath.moveTo(0, y);
      thickLinesPath.lineTo(outputWidth, y);
    }
    pixelatedCtx.stroke(thickLinesPath);
  }
};

// 绘制色号标签层
const drawColorLabels = (
  dataToDraw: MappedPixel[][],
  labelCanvas: HTMLCanvasElement | null,
  dims: { N: number; M: number } | null,
  colorSystem: ColorSystem,
  currentScale: number
) => {
  if (!labelCanvas || !dims || !dataToDraw) return;
  
  const ctx = labelCanvas.getContext('2d');
  if (!ctx) return;

  const { N, M } = dims;
  const outputWidth = labelCanvas.width;
  const outputHeight = labelCanvas.height;
  const cellWidthOutput = outputWidth / N;
  const cellHeightOutput = outputHeight / M;

  // 清除色号层
  ctx.clearRect(0, 0, outputWidth, outputHeight);
  
  // 计算缩放后的实际格子大小（参考网站逻辑）
  const actualCellWidth = cellWidthOutput * currentScale;
  const actualCellHeight = cellHeightOutput * currentScale;
  const minCellSize = Math.min(actualCellWidth, actualCellHeight);
  
  // 参考网站：如果格子实际大小小于6px就不显示色号
  if (minCellSize < 6) return;

  // 计算字体缩放因子（参考网站逻辑：根据纵横比调整）
  let fontScale = 1;
  if (M > N && N > 0) {
    const ratio = M / N;
    if (ratio >= 2.2) fontScale = 0.48;
    else if (ratio >= 1.8) fontScale = 0.58;
    else if (ratio >= 1.5) fontScale = 0.7;
    else if (ratio >= 1.2) fontScale = 0.85;
  }

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cellData = dataToDraw[j]?.[i];
      if (!cellData || cellData.isExternal || !cellData.color) continue;

      const drawX = i * cellWidthOutput;
      const drawY = j * cellHeightOutput;
      
      // 获取色号
      const colorKey = getColorKeyByHex(cellData.color, colorSystem);
      if (!colorKey) continue;
      
      // 判断颜色深浅来决定文字颜色
      const hex = cellData.color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const isLightColor = luminance > 0.6;
      
      // 参考网站的字体大小计算逻辑
      let fontSize = Math.floor(Math.min(14, 0.8 * cellHeightOutput * fontScale, 0.7 * minCellSize * fontScale));
      
      // 确保字体能放下色号文本
      const maxWidth = 0.9 * cellWidthOutput;
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`;
      while (fontSize >= 5 && ctx.measureText(colorKey).width > maxWidth) {
        fontSize -= 1;
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`;
      }
      
      // 如果字体太小就不显示
      if (fontSize < 5) continue;
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isLightColor ? '#111827' : '#F9FAFB';
      
      // 绘制色号
      ctx.fillText(
        colorKey,
        drawX + cellWidthOutput / 2,
        drawY + cellHeightOutput / 2
      );
    }
  }
};

// 绘制预览层
const drawPreviewLayer = (
  previewCanvas: HTMLCanvasElement | null,
  mainCanvas: HTMLCanvasElement | null,
  dims: { N: number; M: number } | null,
  tool: ToolType,
  color: string | null | undefined,
  brushSize: number,
  startPos: { row: number; col: number } | null | undefined,
  endPos: { row: number; col: number } | null | undefined,
  isDrawing: boolean,
  selection: { startRow: number; startCol: number; endRow: number; endCol: number } | null | undefined,
  rectangleFilled?: boolean
) => {
  if (!previewCanvas || !dims || !mainCanvas) return;
  
  const ctx = previewCanvas.getContext('2d');
  if (!ctx) return;

  // 清除预览层
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  
  if (!isDrawing) {
    // 如果不在绘制状态，只显示选区（如果有）
    if (selection) {
      const { N, M } = dims;
      const cellWidth = mainCanvas.width / N;
      const cellHeight = mainCanvas.height / M;
      
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);
      
      const x = minCol * cellWidth;
      const y = minRow * cellHeight;
      const width = (maxCol - minCol + 1) * cellWidth;
      const height = (maxRow - minRow + 1) * cellHeight;
      
      // 绘制选区边框（蚂蚁线效果）
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    }
    return;
  }
  
  const { N, M } = dims;
  const cellWidth = mainCanvas.width / N;
  const cellHeight = mainCanvas.height / M;
  
  switch (tool) {
    case 'brush':
      // 画笔预览：显示笔刷范围
      if (endPos && color) {
        const halfSize = Math.floor(brushSize / 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;
        
        for (let dy = -halfSize; dy <= halfSize; dy++) {
          for (let dx = -halfSize; dx <= halfSize; dx++) {
            const row = endPos.row + dy;
            const col = endPos.col + dx;
            if (row >= 0 && row < M && col >= 0 && col < N) {
              ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
      break;
      
    case 'eraser':
      // 橡皮擦预览：显示擦除范围
      if (endPos) {
        const halfSize = Math.floor(brushSize / 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.5;
        
        for (let dy = -halfSize; dy <= halfSize; dy++) {
          for (let dx = -halfSize; dx <= halfSize; dx++) {
            const row = endPos.row + dy;
            const col = endPos.col + dx;
            if (row >= 0 && row < M && col >= 0 && col < N) {
              ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
              // 绘制 X 标记
              ctx.strokeStyle = '#FF0000';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(col * cellWidth, row * cellHeight);
              ctx.lineTo((col + 1) * cellWidth, (row + 1) * cellHeight);
              ctx.moveTo((col + 1) * cellWidth, row * cellHeight);
              ctx.lineTo(col * cellWidth, (row + 1) * cellHeight);
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1;
      }
      break;
      
    case 'line':
      // 直线预览
      if (startPos && endPos && color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        
        // Bresenham 直线
        const dx = Math.abs(endPos.col - startPos.col);
        const dy = Math.abs(endPos.row - startPos.row);
        const sx = startPos.col < endPos.col ? 1 : -1;
        const sy = startPos.row < endPos.row ? 1 : -1;
        let err = dx - dy;
        let col = startPos.col;
        let row = startPos.row;
        
        ctx.beginPath();
        let first = true;
        
        while (true) {
          if (row >= 0 && row < M && col >= 0 && col < N) {
            const x = col * cellWidth + cellWidth / 2;
            const y = row * cellHeight + cellHeight / 2;
            if (first) {
              ctx.moveTo(x, y);
              first = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          
          if (row === endPos.row && col === endPos.col) break;
          
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
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      break;
      
    case 'rectangle':
      // 矩形预览
      if (startPos && endPos && color) {
        const minRow = Math.min(startPos.row, endPos.row);
        const maxRow = Math.max(startPos.row, endPos.row);
        const minCol = Math.min(startPos.col, endPos.col);
        const maxCol = Math.max(startPos.col, endPos.col);
        
        const x = minCol * cellWidth;
        const y = minRow * cellHeight;
        const width = (maxCol - minCol + 1) * cellWidth;
        const height = (maxRow - minRow + 1) * cellHeight;
        
        ctx.globalAlpha = 0.6;
        
        if (rectangleFilled) {
          // 实心矩形预览
          ctx.fillStyle = color;
          ctx.fillRect(x, y, width, height);
        } else {
          // 空心矩形预览
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
        }
        ctx.globalAlpha = 1;
      }
      break;
      
    case 'select':
      // 选区预览
      if (startPos && endPos) {
        const minRow = Math.min(startPos.row, endPos.row);
        const maxRow = Math.max(startPos.row, endPos.row);
        const minCol = Math.min(startPos.col, endPos.col);
        const maxCol = Math.max(startPos.col, endPos.col);
        
        const x = minCol * cellWidth;
        const y = minRow * cellHeight;
        const width = (maxCol - minCol + 1) * cellWidth;
        const height = (maxRow - minRow + 1) * cellHeight;
        
        // 半透明蓝色背景
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fillRect(x, y, width, height);
        
        // 蚂蚁线边框
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
      }
      break;
      
    case 'move':
      // 移动预览：显示选区和新位置
      if (selection && startPos && endPos) {
        const dx = endPos.col - startPos.col;
        const dy = endPos.row - startPos.row;
        
        const newMinRow = Math.min(selection.startRow, selection.endRow) + dy;
        const newMaxRow = Math.max(selection.startRow, selection.endRow) + dy;
        const newMinCol = Math.min(selection.startCol, selection.endCol) + dx;
        const newMaxCol = Math.max(selection.startCol, selection.endCol) + dx;
        
        const x = newMinCol * cellWidth;
        const y = newMinRow * cellHeight;
        const width = (newMaxCol - newMinCol + 1) * cellWidth;
        const height = (newMaxRow - newMinRow + 1) * cellHeight;
        
        // 新位置（半透明绿色）
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.fillRect(x, y, width, height);
        
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
      }
      break;
  }
};

const PixelatedPreviewCanvas: React.FC<PixelatedPreviewCanvasProps> = ({
  mappedPixelData,
  gridDimensions,
  isManualColoringMode,
  canvasRef,
  onInteraction,
  highlightColorKey,
  onHighlightComplete,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
  currentTool = 'brush',
  selectedColor,
  brushSize = 1,
  rectangleFilled = false,
  originalImageSrc,
  showReferenceLayer = true,
  referenceOpacity = 25,
  previewStartPos,
  previewEndPos,
  isDrawing: isDrawingProp = false,
  selection,
  showColorLabels = false,
  selectedColorSystem = 'MARD',
  showGridLines = false,
  gridLineInterval = 5,
  gridLineColor = '#FF0000',
  showCoordinates = false,
  isTextMode = false,
  onColorClick,
}) => {
  const [darkModeState, setDarkModeState] = useState<boolean | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const touchMovedRef = useRef<boolean>(false);
  const [isHighlighting, setIsHighlighting] = useState(false);
  
  // 高亮色号提示框状态
  const [showHighlightBadge, setShowHighlightBadge] = useState(false);
  const highlightBadgeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 缩放和拖拽状态 - 参考网站的实现方式
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLocalDrawing, setIsLocalDrawing] = useState(false);
  
  // 性能优化：使用 ref 存储中间状态，减少 React 状态更新
  const scaleRef = useRef(1);
  const offsetXRef = useRef(0);
  const offsetYRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<{ scale?: number; offsetX?: number; offsetY?: number } | null>(null);
  
  // 防抖定时器 - 用于缩放时的性能优化
  const scaleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastDrawScaleRef = useRef(1);
  const drawRafRef = useRef<number | null>(null);
  const pendingDrawRef = useRef<boolean>(false);
  
  // 批量更新状态的函数
  const flushUpdate = useCallback(() => {
    if (pendingUpdateRef.current) {
      const { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY } = pendingUpdateRef.current;
      if (newScale !== undefined) setScale(newScale);
      if (newOffsetX !== undefined) setOffsetX(newOffsetX);
      if (newOffsetY !== undefined) setOffsetY(newOffsetY);
      pendingUpdateRef.current = null;
    }
    rafRef.current = null;
  }, []);
  
  // 请求更新的函数（使用 requestAnimationFrame 节流）
  const requestUpdate = useCallback((update: { scale?: number; offsetX?: number; offsetY?: number }) => {
    // 更新 ref
    if (update.scale !== undefined) scaleRef.current = update.scale;
    if (update.offsetX !== undefined) offsetXRef.current = update.offsetX;
    if (update.offsetY !== undefined) offsetYRef.current = update.offsetY;
    
    // 合并待更新的值
    pendingUpdateRef.current = { ...pendingUpdateRef.current, ...update };
    
    // 如果还没有安排更新，安排一个
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(flushUpdate);
    }
  }, [flushUpdate]);
  
  // 基础格子大小（参考网站使用固定值，缩放时画布尺寸变化）
  const baseCellSize = 6; // 每个格子的基础大小（像素）
  
  // 计算缩放后的画布尺寸
  const scaledWidth = gridDimensions ? gridDimensions.N * baseCellSize * scale : 0;
  const scaledHeight = gridDimensions ? gridDimensions.M * baseCellSize * scale : 0;

  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  
  // 预览画布引用
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // 色号标签画布引用
  const colorLabelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // 参考图层画布引用
  const referenceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const referenceImageRef = useRef<HTMLImageElement | null>(null);
  
  // 容器引用
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 触摸缩放相关
  const touchDistanceRef = useRef<number | null>(null);
  const touchCenterRef = useRef<{ x: number; y: number } | null>(null);
  
  // 保存最后的触摸网格位置（用于触摸结束时）
  const lastTouchGridPosRef = useRef<{ row: number; col: number } | null>(null);
  
  // 用于检测单击（非拖拽）的 ref
  const mouseDownInfoRef = useRef<{ x: number; y: number; time: number } | null>(null);
  
  // 离屏canvas缓存 - 用于高性能缩放
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPixelDataRef = useRef<MappedPixel[][] | null>(null);
  const lastHighlightColorRef = useRef<string | null | undefined>(undefined);
  
  // 绘制过程中的实时预览缓存
  const drawingOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const pendingPixelsRef = useRef<Map<string, { color: string | null; row: number; col: number }>>(new Map());
  const lastFlushTimeRef = useRef<number>(0);
  const flushRafRef = useRef<number | null>(null);

  // 获取网格坐标
  const getGridPosition = useCallback((clientX: number, clientY: number): { row: number; col: number } | null => {
    if (!gridDimensions || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    
    const { N, M } = gridDimensions;
    const cellWidth = canvas.width / N;
    const cellHeight = canvas.height / M;
    
    const col = Math.floor(canvasX / cellWidth);
    const row = Math.floor(canvasY / cellHeight);
    
    if (col >= 0 && col < N && row >= 0 && row < M) {
      return { row, col };
    }
    return null;
  }, [gridDimensions, canvasRef]);

  // Dark mode detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark !== darkModeState) {
        setDarkModeState(isDark);
      }
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [darkModeState]);

  // Draw main canvas (使用离屏canvas缓存优化缩放性能)
  useEffect(() => {
    if (mappedPixelData && gridDimensions && canvasRef.current && darkModeState !== null) {
      const canvas = canvasRef.current;
      const baseWidth = gridDimensions.N * baseCellSize;
      const baseHeight = gridDimensions.M * baseCellSize;
      let newWidth = baseWidth * scale;
      let newHeight = baseHeight * scale;
      
      // iOS 设备限制 canvas 尺寸，避免超过内存限制导致空白
      if (isIOS()) {
        const canvasArea = newWidth * newHeight;
        // 如果超过最大面积，按比例缩小
        if (canvasArea > IOS_MAX_CANVAS_AREA || newWidth > IOS_MAX_CANVAS_DIMENSION || newHeight > IOS_MAX_CANVAS_DIMENSION) {
          const scaleDownFactor = Math.min(
            IOS_MAX_CANVAS_DIMENSION / newWidth,
            IOS_MAX_CANVAS_DIMENSION / newHeight,
            Math.sqrt(IOS_MAX_CANVAS_AREA / canvasArea)
          );
          newWidth = Math.floor(newWidth * scaleDownFactor);
          newHeight = Math.floor(newHeight * scaleDownFactor);
        }
      }
      
      // 设置主canvas尺寸
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
      }
      
      // 初始化或调整离屏canvas尺寸（基础尺寸）
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      if (offscreenCanvasRef.current.width !== baseWidth || offscreenCanvasRef.current.height !== baseHeight) {
        offscreenCanvasRef.current.width = baseWidth;
        offscreenCanvasRef.current.height = baseHeight;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // 检查像素数据是否变化，或者高亮颜色是否变化
      const pixelDataChanged = lastPixelDataRef.current !== mappedPixelData;
      const highlightChanged = lastHighlightColorRef.current !== highlightColorKey;
      
      if (pixelDataChanged || highlightChanged) {
        // 像素数据或高亮颜色变化时，重新绘制到离屏canvas
        const isHighlighting = highlightColorKey !== null;
        drawPixelColors(
          mappedPixelData, 
          offscreenCanvasRef.current, 
          gridDimensions, 
          highlightColorKey, 
          isHighlighting
        );
        lastPixelDataRef.current = mappedPixelData;
        lastHighlightColorRef.current = highlightColorKey;
        // 清空待绘制像素缓存
        pendingPixelsRef.current.clear();
      }
      
      // 从离屏canvas放大绘制到主canvas（高性能）
      ctx.imageSmoothingEnabled = false; // 禁用平滑，保持像素清晰
      ctx.clearRect(0, 0, newWidth, newHeight);
      ctx.drawImage(offscreenCanvasRef.current, 0, 0, baseWidth, baseHeight, 0, 0, newWidth, newHeight);
      
      // 绘制待处理的像素覆盖层（绘制过程中的实时预览）
      if (pendingPixelsRef.current.size > 0 && isLocalDrawing) {
        const cellWidth = newWidth / gridDimensions.N;
        const cellHeight = newHeight / gridDimensions.M;
        const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
        const externalBackgroundColor = isDarkMode ? '#374151' : '#F3F4F6';
        
        pendingPixelsRef.current.forEach((pixel, key) => {
          const x = pixel.col * cellWidth;
          const y = pixel.row * cellHeight;
          if (pixel.color) {
            ctx.fillStyle = pixel.color;
          } else {
            // 橡皮擦：绘制背景色
            ctx.fillStyle = externalBackgroundColor;
          }
          ctx.fillRect(x, y, cellWidth, cellHeight);
        });
      }
      
      // 在主canvas上绘制网格线和色号（根据scale调整）
      drawPixelatedCanvas(
        mappedPixelData, 
        canvas, 
        gridDimensions, 
        highlightColorKey, 
        highlightColorKey !== null, // 使用 highlightColorKey 判断是否高亮
        showColorLabels,
        selectedColorSystem,
        showGridLines,
        gridLineInterval,
        gridLineColor,
        true // 跳过像素绘制，只绘制网格线和色号
      );
    }
  }, [mappedPixelData, gridDimensions, canvasRef, darkModeState, highlightColorKey, showColorLabels, selectedColorSystem, showGridLines, gridLineInterval, gridLineColor, scale, baseCellSize, isLocalDrawing]);

  // Initialize preview canvas size when scale changes
  useEffect(() => {
    if (canvasRef.current && previewCanvasRef.current && gridDimensions) {
      const newWidth = gridDimensions.N * baseCellSize * scale;
      const newHeight = gridDimensions.M * baseCellSize * scale;
      previewCanvasRef.current.width = newWidth;
      previewCanvasRef.current.height = newHeight;
    }
    // Initialize color label canvas size
    if (canvasRef.current && colorLabelCanvasRef.current && gridDimensions) {
      const newWidth = gridDimensions.N * baseCellSize * scale;
      const newHeight = gridDimensions.M * baseCellSize * scale;
      colorLabelCanvasRef.current.width = newWidth;
      colorLabelCanvasRef.current.height = newHeight;
    }
  }, [mappedPixelData, gridDimensions, scale, baseCellSize]);

  // Draw color labels when scale or showColorLabels changes
  useEffect(() => {
    if (mappedPixelData && gridDimensions && colorLabelCanvasRef.current && showColorLabels) {
      drawColorLabels(
        mappedPixelData,
        colorLabelCanvasRef.current,
        gridDimensions,
        selectedColorSystem,
        scale
      );
    } else if (colorLabelCanvasRef.current) {
      const ctx = colorLabelCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, colorLabelCanvasRef.current.width, colorLabelCanvasRef.current.height);
      }
    }
  }, [mappedPixelData, gridDimensions, showColorLabels, selectedColorSystem, scale]);

  // Initialize reference canvas size
  useEffect(() => {
    if (canvasRef.current && referenceCanvasRef.current) {
      referenceCanvasRef.current.width = canvasRef.current.width;
      referenceCanvasRef.current.height = canvasRef.current.height;
    }
  }, [mappedPixelData, gridDimensions]);

  // Load and draw reference layer (original image)
  useEffect(() => {
    const referenceCanvas = referenceCanvasRef.current;
    const mainCanvas = canvasRef.current;
    
    if (!referenceCanvas || !mainCanvas || !originalImageSrc || !showReferenceLayer) {
      // Clear reference canvas if not showing
      if (referenceCanvas) {
        const ctx = referenceCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, referenceCanvas.width, referenceCanvas.height);
        }
      }
      return;
    }

    // Load image if not already loaded
    if (!referenceImageRef.current || referenceImageRef.current.src !== originalImageSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        referenceImageRef.current = img;
        drawReferenceImage(img, referenceCanvas, mainCanvas, referenceOpacity);
      };
      img.src = originalImageSrc;
    } else {
      // Image already loaded, just redraw
      drawReferenceImage(referenceImageRef.current, referenceCanvas, mainCanvas, referenceOpacity);
    }
  }, [originalImageSrc, showReferenceLayer, referenceOpacity, mappedPixelData, gridDimensions]);

  // Helper function to draw reference image
  const drawReferenceImage = (
    img: HTMLImageElement,
    referenceCanvas: HTMLCanvasElement,
    mainCanvas: HTMLCanvasElement,
    opacity: number
  ) => {
    const ctx = referenceCanvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, referenceCanvas.width, referenceCanvas.height);

    // Calculate scaling to fit the canvas
    const scaleX = mainCanvas.width / img.width;
    const scaleY = mainCanvas.height / img.height;
    const scale = Math.min(scaleX, scaleY);

    const width = img.width * scale;
    const height = img.height * scale;
    const x = (mainCanvas.width - width) / 2;
    const y = (mainCanvas.height - height) / 2;

    // Set opacity and draw
    ctx.globalAlpha = opacity / 100;
    ctx.drawImage(img, x, y, width, height);
    ctx.globalAlpha = 1;
  };

  // Draw preview layer
  useEffect(() => {
    drawPreviewLayer(
      previewCanvasRef.current,
      canvasRef.current,
      gridDimensions,
      currentTool,
      selectedColor,
      brushSize,
      previewStartPos,
      previewEndPos,
      isDrawingProp,
      selection,
      rectangleFilled
    );
  }, [gridDimensions, currentTool, selectedColor, brushSize, previewStartPos, previewEndPos, isDrawingProp, selection, rectangleFilled]);

  // Handle highlight - 高亮状态持续，直到用户手动取消
  useEffect(() => {
    if (highlightColorKey) {
      setIsHighlighting(true);
      
      // 显示高亮色号提示框
      setShowHighlightBadge(true);
      
      // 清除之前的定时器
      if (highlightBadgeTimeoutRef.current) {
        clearTimeout(highlightBadgeTimeoutRef.current);
      }
      
      // 3秒后隐藏提示框（但保持高亮效果）
      highlightBadgeTimeoutRef.current = setTimeout(() => {
        setShowHighlightBadge(false);
        highlightBadgeTimeoutRef.current = null;
      }, 3000);
    } else {
      setIsHighlighting(false);
      setShowHighlightBadge(false);
      
      // 清除定时器
      if (highlightBadgeTimeoutRef.current) {
        clearTimeout(highlightBadgeTimeoutRef.current);
        highlightBadgeTimeoutRef.current = null;
      }
    }
    
    // 清理函数
    return () => {
      if (highlightBadgeTimeoutRef.current) {
        clearTimeout(highlightBadgeTimeoutRef.current);
        highlightBadgeTimeoutRef.current = null;
      }
    };
  }, [highlightColorKey]);

  // Reset zoom and offset - only when grid dimensions change (not on pixel data changes)
  useEffect(() => {
    if (gridDimensions && containerRef.current) {
      const container = containerRef.current;
      const canvasWidth = gridDimensions.N * baseCellSize; // 初始尺寸（scale=1）
      const canvasHeight = gridDimensions.M * baseCellSize;
      const newOffsetX = (container.clientWidth - canvasWidth) / 2;
      const newOffsetY = (container.clientHeight - canvasHeight) / 2;
      
      // 更新 ref 值
      scaleRef.current = 1;
      offsetXRef.current = newOffsetX;
      offsetYRef.current = newOffsetY;
      
      setScale(1);
      setOffsetX(newOffsetX);
      setOffsetY(newOffsetY);
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridDimensions]);

  // --- Mouse event handlers ---
  
  // 实时绘制覆盖层的函数（不触发状态更新）
  const drawPixelOverlay = useCallback((row: number, col: number, color: string | null, brushSize: number) => {
    if (!gridDimensions || !canvasRef.current) return;
    
    const halfSize = Math.floor(brushSize / 2);
    
    // 更新待绘制像素缓存
    for (let dy = -halfSize; dy <= halfSize; dy++) {
      for (let dx = -halfSize; dx <= halfSize; dx++) {
        const newRow = row + dy;
        const newCol = col + dx;
        
        if (newRow >= 0 && newRow < gridDimensions.M && newCol >= 0 && newCol < gridDimensions.N) {
          const key = `${newRow},${newCol}`;
          pendingPixelsRef.current.set(key, { color, row: newRow, col: newCol });
        }
      }
    }
    
    // 直接在 canvas 上绘制预览（不触发 React 状态更新）
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const cellWidth = canvas.width / gridDimensions.N;
    const cellHeight = canvas.height / gridDimensions.M;
    const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
    const externalBackgroundColor = isDarkMode ? '#374151' : '#F3F4F6';
    
    for (let dy = -halfSize; dy <= halfSize; dy++) {
      for (let dx = -halfSize; dx <= halfSize; dx++) {
        const newRow = row + dy;
        const newCol = col + dx;
        
        if (newRow >= 0 && newRow < gridDimensions.M && newCol >= 0 && newCol < gridDimensions.N) {
          const x = newCol * cellWidth;
          const y = newRow * cellHeight;
          if (color) {
            ctx.fillStyle = color;
          } else {
            ctx.fillStyle = externalBackgroundColor;
          }
          ctx.fillRect(x, y, cellWidth, cellHeight);
        }
      }
    }
  }, [gridDimensions, canvasRef]);
  
  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && dragStartRef.current) {
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;
      // 使用 requestAnimationFrame 节流更新
      requestUpdate({
        offsetX: dragStartRef.current.offsetX + dx,
        offsetY: dragStartRef.current.offsetY + dy,
      });
    } else if (isManualColoringMode && isLocalDrawing) {
      const pos = getGridPosition(event.clientX, event.clientY);
      if (pos && onDrawMove) {
        // 实时绘制预览（不触发状态更新）
        if (currentTool === 'brush' || currentTool === 'eraser') {
          const color = currentTool === 'brush' ? (selectedColor || null) : null;
          drawPixelOverlay(pos.row, pos.col, color, brushSize);
        }
        // 仍然调用父组件的回调，但状态更新会被节流
        onDrawMove(pos.col, pos.row);
      }
    } else {
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, false);
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    dragStartRef.current = null;
    if (isLocalDrawing) {
      setIsLocalDrawing(false);
      // 清空待绘制像素缓存
      pendingPixelsRef.current.clear();
      if (onDrawEnd && previewEndPos) {
        onDrawEnd(previewEndPos.col, previewEndPos.row);
      }
    }
    onInteraction(0, 0, 0, 0, false, true);
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (event.button === 0) {
      // 文字模式或手动编辑模式下触发交互
      if (isManualColoringMode) {
        setIsLocalDrawing(true);
        const pos = getGridPosition(event.clientX, event.clientY);
        if (pos && onDrawStart) {
          onDrawStart(pos.col, pos.row);
        }
        onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true);
      } else if (isTextMode) {
        // 文字模式：只触发交互，不进入拖拽
        onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true);
      } else {
        // 非编辑模式：记录点击信息用于检测单击
        mouseDownInfoRef.current = {
          x: event.clientX,
          y: event.clientY,
          time: Date.now()
        };
        // 开始拖拽
        setIsDragging(true);
        dragStartRef.current = {
          x: event.clientX,
          y: event.clientY,
          offsetX: offsetX,
          offsetY: offsetY
        };
      }
    }
  };

  const handleMouseUp = (event: MouseEvent<HTMLCanvasElement>) => {
    // 检测是否是单击（非拖拽模式下点击格子高亮颜色）
    if (mouseDownInfoRef.current && !isManualColoringMode && !isTextMode) {
      const dx = Math.abs(event.clientX - mouseDownInfoRef.current.x);
      const dy = Math.abs(event.clientY - mouseDownInfoRef.current.y);
      const dt = Date.now() - mouseDownInfoRef.current.time;
      
      // 如果移动距离小于5像素且时间小于300ms，认为是单击
      if (dx < 5 && dy < 5 && dt < 300) {
        const pos = getGridPosition(event.clientX, event.clientY);
        if (pos && mappedPixelData && gridDimensions) {
          const cellData = mappedPixelData[pos.row]?.[pos.col];
          if (cellData && !cellData.isExternal && cellData.color) {
            // 调用颜色点击回调
            if (onColorClick) {
              onColorClick(cellData.color);
            }
          }
        }
      }
      mouseDownInfoRef.current = null;
    }
    
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
    if (isLocalDrawing) {
      setIsLocalDrawing(false);
      // 清空待绘制像素缓存
      pendingPixelsRef.current.clear();
      const pos = getGridPosition(event.clientX, event.clientY);
      if (pos && onDrawEnd) {
        onDrawEnd(pos.col, pos.row);
      }
    }
  };

  // --- Wheel zoom ---
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // 使用 ref 中的值而不是状态
    const currentScale = scaleRef.current;
    const currentOffsetX = offsetXRef.current;
    const currentOffsetY = offsetYRef.current;
    
    const beforeX = (mouseX - currentOffsetX) / currentScale;
    const beforeY = (mouseY - currentOffsetY) / currentScale;
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(currentScale * zoomFactor, 0.1), 50);
    
    // 计算缩放后的画布尺寸
    const canvasWidth = gridDimensions ? gridDimensions.N * baseCellSize * newScale : 0;
    const canvasHeight = gridDimensions ? gridDimensions.M * baseCellSize * newScale : 0;
    
    let newOffsetX: number;
    let newOffsetY: number;
    
    // 如果画布可以完全显示在容器中，自动居中
    if (canvasWidth <= containerWidth && canvasHeight <= containerHeight) {
      newOffsetX = (containerWidth - canvasWidth) / 2;
      newOffsetY = (containerHeight - canvasHeight) / 2;
    } else {
      // 否则基于鼠标位置缩放
      newOffsetX = mouseX - beforeX * newScale;
      newOffsetY = mouseY - beforeY * newScale;
      
      // 确保画布不会完全移出可视区域
      // 画布至少要有一部分在容器内可见
      const minX = -canvasWidth + 50; // 至少显示 50px
      const maxX = containerWidth - 50;
      const minY = -canvasHeight + 50;
      const maxY = containerHeight - 50;
      
      newOffsetX = Math.max(minX, Math.min(maxX, newOffsetX));
      newOffsetY = Math.max(minY, Math.min(maxY, newOffsetY));
    }
    
    // 使用 requestAnimationFrame 节流更新
    requestUpdate({
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY,
    });
  };

  // --- Touch event handlers ---
  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    // 始终阻止默认行为，防止页面滚动和其他干扰
    event.preventDefault();
    event.stopPropagation();
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, pageX: touch.pageX, pageY: touch.pageY };
      touchMovedRef.current = false;
      
      if (isManualColoringMode) {
        // 手动编辑模式：开始触摸绘制
        setIsLocalDrawing(true);
        const pos = getGridPosition(touch.clientX, touch.clientY);
        if (pos) {
          lastTouchGridPosRef.current = pos;
          if (onDrawStart) {
            onDrawStart(pos.col, pos.row);
          }
        }
      } else if (isTextMode) {
        // 文字模式：触发交互
        onInteraction(touch.clientX, touch.clientY, touch.pageX, touch.pageY, true);
      } else {
        // 非手动模式：拖拽画布
        dragStartRef.current = { x: touch.clientX, y: touch.clientY, offsetX, offsetY };
      }
    } else if (event.touches.length === 2) {
      // 双指缩放：取消当前绘制操作并进入缩放模式
      setIsLocalDrawing(false);
      lastTouchGridPosRef.current = null;
      
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      touchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
      touchCenterRef.current = { x: (touch1.clientX + touch2.clientX) / 2, y: (touch1.clientY + touch2.clientY) / 2 };
    }
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    // 始终阻止默认行为
    event.preventDefault();
    event.stopPropagation();
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      
      // 计算移动距离
      if (touchStartPosRef.current) {
        const dx = touch.clientX - touchStartPosRef.current.x;
        const dy = touch.clientY - touchStartPosRef.current.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          touchMovedRef.current = true;
        }
      }
      
      if (isManualColoringMode && isLocalDrawing) {
        // 手动编辑模式：持续绘制
        const pos = getGridPosition(touch.clientX, touch.clientY);
        if (pos) {
          lastTouchGridPosRef.current = pos;
          // 实时绘制预览（不触发状态更新）
          if (currentTool === 'brush' || currentTool === 'eraser') {
            const color = currentTool === 'brush' ? (selectedColor || null) : null;
            drawPixelOverlay(pos.row, pos.col, color, brushSize);
          }
          if (onDrawMove) {
            onDrawMove(pos.col, pos.row);
          }
        }
      } else if (dragStartRef.current) {
        // 非手动模式：拖拽画布
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;
        requestUpdate({
          offsetX: dragStartRef.current.offsetX + dx,
          offsetY: dragStartRef.current.offsetY + dy,
        });
      }
    } else if (event.touches.length === 2 && touchDistanceRef.current && touchCenterRef.current) {
      // 双指缩放
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      const zoomFactor = newDistance / touchDistanceRef.current;
      
      // 使用 ref 中的值
      const currentScale = scaleRef.current;
      const currentOffsetX = offsetXRef.current;
      const currentOffsetY = offsetYRef.current;
      
      let newScale = Math.min(Math.max(currentScale * zoomFactor, 0.1), 50);
      
      // iOS 设备限制最大缩放比例，避免 canvas 超过尺寸限制
      if (isIOS() && gridDimensions) {
        const maxCanvasDimension = IOS_MAX_CANVAS_DIMENSION;
        const maxScaleByWidth = maxCanvasDimension / (gridDimensions.N * baseCellSize);
        const maxScaleByHeight = maxCanvasDimension / (gridDimensions.M * baseCellSize);
        const maxScaleByArea = Math.sqrt(IOS_MAX_CANVAS_AREA / (gridDimensions.N * baseCellSize * gridDimensions.M * baseCellSize));
        const maxScale = Math.min(maxScaleByWidth, maxScaleByHeight, maxScaleByArea);
        newScale = Math.min(newScale, maxScale);
      }
      
      const newCenter = { x: (touch1.clientX + touch2.clientX) / 2, y: (touch1.clientY + touch2.clientY) / 2 };
      
      // 计算缩放后的画布尺寸
      const containerRect = event.currentTarget.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      const canvasWidth = gridDimensions ? gridDimensions.N * baseCellSize * newScale : 0;
      const canvasHeight = gridDimensions ? gridDimensions.M * baseCellSize * newScale : 0;
      
      let newOffsetX: number;
      let newOffsetY: number;
      
      // 如果画布可以完全显示在容器中，自动居中
      if (canvasWidth <= containerWidth && canvasHeight <= containerHeight) {
        newOffsetX = (containerWidth - canvasWidth) / 2;
        newOffsetY = (containerHeight - canvasHeight) / 2;
      } else {
        // 否则基于触摸中心缩放
        const scaleRatio = newScale / currentScale;
        newOffsetX = newCenter.x - (newCenter.x - currentOffsetX) * scaleRatio;
        newOffsetY = newCenter.y - (newCenter.y - currentOffsetY) * scaleRatio;
      }
      
      requestUpdate({
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
      
      touchDistanceRef.current = newDistance;
      touchCenterRef.current = newCenter;
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    // 结束触摸绘制 - 使用保存的最后触摸位置
    if (isLocalDrawing) {
      setIsLocalDrawing(false);
      // 清空待绘制像素缓存
      pendingPixelsRef.current.clear();
      if (onDrawEnd && lastTouchGridPosRef.current) {
        onDrawEnd(lastTouchGridPosRef.current.col, lastTouchGridPosRef.current.row);
      }
      lastTouchGridPosRef.current = null;
    }
    
    dragStartRef.current = null;
    touchDistanceRef.current = null;
    touchCenterRef.current = null;
    
    // 如果是点击（没有移动）
    if (!touchMovedRef.current && touchStartPosRef.current) {
      if (isManualColoringMode) {
        // 手动编辑模式：触发交互
        const { x, y, pageX, pageY } = touchStartPosRef.current;
        onInteraction(x, y, pageX, pageY, true);
      } else if (!isTextMode && onColorClick) {
        // 非手动编辑模式且非文字模式：触发高亮颜色
        const { x, y } = touchStartPosRef.current;
        const pos = getGridPosition(x, y);
        if (pos && mappedPixelData && gridDimensions) {
          const cellData = mappedPixelData[pos.row]?.[pos.col];
          if (cellData && !cellData.isExternal && cellData.color) {
            onColorClick(cellData.color);
          }
        }
      }
    }

    touchStartPosRef.current = null;
    touchMovedRef.current = false;
  };

  // 计算坐标轴颜色
  const coordinateBgColor = '#9CA3AF'; // 参考网站使用的颜色
  
  // 画布尺寸已经包含了缩放，直接使用
  const canvasDisplayWidth = scaledWidth;
  const canvasDisplayHeight = scaledHeight;
  
  // 计算每个格子的实际显示大小（缩放后的格子大小）
  const cellDisplayWidth = baseCellSize * scale;
  const cellDisplayHeight = baseCellSize * scale;
  
  // 计算坐标轴字体大小（根据格子大小调整）
  const coordinateFontSize = Math.max(8, Math.min(10, cellDisplayWidth * 0.4));
  
  // 使用 useMemo 缓存坐标数组，避免每次渲染都重新创建
  const colCoordinates = useMemo(() => {
    if (!gridDimensions) return [];
    return Array.from({ length: gridDimensions.N }, (_, i) => i + 1);
  }, [gridDimensions]);
  
  const rowCoordinates = useMemo(() => {
    if (!gridDimensions) return [];
    return Array.from({ length: gridDimensions.M }, (_, i) => i + 1);
  }, [gridDimensions]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="w-full h-full overflow-hidden relative"
      style={{ 
        cursor: isDragging ? 'grabbing' : (isManualColoringMode ? 'crosshair' : 'grab'),
        touchAction: 'none'
      }}
    >
      {/* 坐标轴层 - 在所有画布下面 */}
      {showCoordinates && gridDimensions && (
        <>
          {/* 左上角空格子 */}
          <div
            className="absolute flex items-center justify-center select-none z-0"
            style={{
              backgroundColor: coordinateBgColor,
              width: cellDisplayWidth,
              height: cellDisplayHeight,
              left: offsetX - cellDisplayWidth,
              top: offsetY - cellDisplayHeight,
              borderRight: '1px solid #6B7280',
              borderBottom: '1px solid #6B7280',
            }}
          >
          </div>
          
          {/* 顶部横向坐标 - 每个数字在独立格子内 */}
          <div
            className="absolute flex select-none z-0"
            style={{
              width: canvasDisplayWidth,
              height: cellDisplayHeight,
              left: offsetX,
              top: offsetY - cellDisplayHeight,
              fontSize: coordinateFontSize,
            }}
          >
            {colCoordinates.map((num) => (
              <div
                key={`col-${num}`}
                className="flex items-center justify-center text-white"
                style={{
                  width: cellDisplayWidth,
                  height: cellDisplayHeight,
                  backgroundColor: coordinateBgColor,
                  borderRight: '1px solid #6B7280',
                  borderBottom: '1px solid #6B7280',
                }}
              >
                {num}
              </div>
            ))}
          </div>
          
          {/* 左侧纵向坐标 - 每个数字在独立格子内 */}
          <div
            className="absolute flex flex-col select-none z-0"
            style={{
              width: cellDisplayWidth,
              height: canvasDisplayHeight,
              left: offsetX - cellDisplayWidth,
              top: offsetY,
              fontSize: coordinateFontSize,
            }}
          >
            {rowCoordinates.map((num) => (
              <div
                key={`row-${num}`}
                className="flex items-center justify-center text-white"
                style={{
                  width: cellDisplayWidth,
                  height: cellDisplayHeight,
                  backgroundColor: coordinateBgColor,
                  borderRight: '1px solid #6B7280',
                  borderBottom: '1px solid #6B7280',
                }}
              >
                {num}
              </div>
            ))}
          </div>
        </>
      )}
      
      {/* 参考图层画布 - 在主画布下面 */}
      <canvas
        ref={referenceCanvasRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          imageRendering: 'pixelated',
          width: scaledWidth,
          height: scaledHeight,
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        }}
      />
      {/* 主画布 - 参考网站方式：尺寸动态变化，不使用 CSS scale */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={(e) => e.stopPropagation()}
        className="border border-gray-300 dark:border-gray-600 rounded block relative z-10"
        style={{
          imageRendering: 'pixelated',
          width: scaledWidth,
          height: scaledHeight,
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        }}
      />
      {/* 预览画布 - 叠加在主画布上 */}
      <canvas
        ref={previewCanvasRef}
        className="absolute top-0 left-0 pointer-events-none z-20"
        style={{
          imageRendering: 'pixelated',
          width: scaledWidth,
          height: scaledHeight,
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        }}
      />
      {/* 色号标签画布 - 叠加在预览画布上 */}
      <canvas
        ref={colorLabelCanvasRef}
        className="absolute top-0 left-0 pointer-events-none z-25"
        style={{
          width: scaledWidth,
          height: scaledHeight,
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        }}
      />
      
      {/* 高亮色号提示框 - 显示当前高亮的颜色色号，3秒后自动消失 */}
      {showHighlightBadge && highlightColorKey && (
        <div 
          className="absolute top-2 right-2 bg-gray-900/90 dark:bg-gray-800/90 text-white text-xs px-2 py-1 rounded shadow-lg flex items-center gap-1.5 z-30 pointer-events-none"
        >
          <span
            className="inline-block w-3 h-3 rounded-sm border border-gray-400 flex-shrink-0"
            style={{ backgroundColor: highlightColorKey }}
          />
          <span className="font-mono font-semibold">
            {getColorKeyByHex(highlightColorKey, selectedColorSystem)}
          </span>
        </div>
      )}
    </div>
  );
};

export default PixelatedPreviewCanvas;
