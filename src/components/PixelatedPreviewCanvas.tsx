'use client';

import React, { useRef, useEffect, TouchEvent, MouseEvent, useState, WheelEvent, useCallback } from 'react';
import { MappedPixel } from '../utils/pixelation';
import { getColorKeyByHex, ColorSystem } from '../utils/colorSystemUtils';

// 工具类型
type ToolType = 'brush' | 'eraser' | 'picker' | 'fill' | 'line' | 'rectangle' | 'select' | 'move' | 'hand';

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
  // 显示色号和坐标
  showColorKey?: boolean;
  showCoordinates?: boolean;
  selectedColorSystem?: ColorSystem;
}

// 绘制像素化画布的函数
const drawPixelatedCanvas = (
  dataToDraw: MappedPixel[][],
  canvas: HTMLCanvasElement | null,
  dims: { N: number; M: number } | null,
  highlightColorKey?: string | null,
  isHighlighting?: boolean,
  showColorKey?: boolean,
  showCoordinates?: boolean,
  selectedColorSystem?: ColorSystem
) => {
  if (!canvas || !dims || !dataToDraw) {
    console.warn("drawPixelatedCanvas: Missing required parameters");
    return;
  }
  
  const pixelatedCtx = canvas.getContext('2d');
  if (!pixelatedCtx) {
    console.error("Failed to get 2D context for pixelated canvas");
    return;
  }

  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const externalBackgroundColor = isDarkMode ? '#374151' : '#F3F4F6';
  const gridLineColor = isDarkMode ? '#4B5563' : '#DDDDDD';

  const { N, M } = dims;
  const outputWidth = canvas.width;
  const outputHeight = canvas.height;
  const cellWidthOutput = outputWidth / N;
  const cellHeightOutput = outputHeight / M;

  pixelatedCtx.clearRect(0, 0, outputWidth, outputHeight);
  pixelatedCtx.lineWidth = 0.5;

  // 计算文字大小（根据格子大小动态调整）
  const fontSize = Math.max(6, Math.min(10, Math.min(cellWidthOutput, cellHeightOutput) * 0.6));

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cellData = dataToDraw[j]?.[i];
      if (!cellData) continue;

      const drawX = i * cellWidthOutput;
      const drawY = j * cellHeightOutput;

      if (cellData.isExternal) {
        pixelatedCtx.fillStyle = externalBackgroundColor;
      } else {
        pixelatedCtx.fillStyle = cellData.color;
      }
      pixelatedCtx.fillRect(drawX, drawY, cellWidthOutput, cellHeightOutput);

      if (isHighlighting && highlightColorKey) {
        let shouldDim = false;
        if (cellData.isExternal) {
          shouldDim = true;
        } else {
          shouldDim = cellData.color.toUpperCase() !== highlightColorKey.toUpperCase();
        }
        if (shouldDim) {
          pixelatedCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          pixelatedCtx.fillRect(drawX, drawY, cellWidthOutput, cellHeightOutput);
        }
      }

      pixelatedCtx.strokeStyle = gridLineColor;
      pixelatedCtx.strokeRect(drawX + 0.5, drawY + 0.5, cellWidthOutput, cellHeightOutput);
      
      // 绘制色号
      if (showColorKey && !cellData.isExternal && cellData.color) {
        const colorKey = getColorKeyByHex(cellData.color, selectedColorSystem || 'MARD');
        
        // 判断颜色深浅来决定文字颜色
        const hex = cellData.color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const isLightColor = (r * 299 + g * 587 + b * 114) / 1000 > 128;
        
        pixelatedCtx.fillStyle = isLightColor ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)';
        pixelatedCtx.font = `bold ${fontSize}px Arial`;
        pixelatedCtx.textAlign = 'center';
        pixelatedCtx.textBaseline = 'middle';
        pixelatedCtx.fillText(colorKey, drawX + cellWidthOutput / 2, drawY + cellHeightOutput / 2 - (showCoordinates ? fontSize * 0.5 : 0));
      }
      
      // 绘制坐标
      if (showCoordinates && !cellData.isExternal) {
        const coordText = `${i},${j}`;
        
        // 判断颜色深浅来决定文字颜色
        if (cellData.color) {
          const hex = cellData.color.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          const isLightColor = (r * 299 + g * 587 + b * 114) / 1000 > 128;
          pixelatedCtx.fillStyle = isLightColor ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)';
        } else {
          pixelatedCtx.fillStyle = 'rgba(128, 128, 128, 0.8)';
        }
        
        pixelatedCtx.font = `${fontSize * 0.7}px Arial`;
        pixelatedCtx.textAlign = 'center';
        pixelatedCtx.textBaseline = 'middle';
        pixelatedCtx.fillText(coordText, drawX + cellWidthOutput / 2, drawY + cellHeightOutput / 2 + (showColorKey ? fontSize * 0.6 : 0));
      }
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
  showColorKey = false,
  showCoordinates = false,
  selectedColorSystem = 'MARD',
}) => {
  const [darkModeState, setDarkModeState] = useState<boolean | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const touchMovedRef = useRef<boolean>(false);
  const [isHighlighting, setIsHighlighting] = useState(false);

  // 缩放和拖拽状态
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLocalDrawing, setIsLocalDrawing] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  
  // 预览画布引用
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
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

  // Draw main canvas
  useEffect(() => {
    if (mappedPixelData && gridDimensions && canvasRef.current && darkModeState !== null) {
      drawPixelatedCanvas(mappedPixelData, canvasRef.current, gridDimensions, highlightColorKey, isHighlighting, showColorKey, showCoordinates, selectedColorSystem);
    }
  }, [mappedPixelData, gridDimensions, canvasRef, darkModeState, highlightColorKey, isHighlighting, showColorKey, showCoordinates, selectedColorSystem]);

  // Initialize preview canvas size
  useEffect(() => {
    if (canvasRef.current && previewCanvasRef.current) {
      previewCanvasRef.current.width = canvasRef.current.width;
      previewCanvasRef.current.height = canvasRef.current.height;
    }
  }, [mappedPixelData, gridDimensions]);

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

  // Handle highlight
  useEffect(() => {
    if (highlightColorKey && mappedPixelData && gridDimensions) {
      setIsHighlighting(true);
      const timer = setTimeout(() => {
        setIsHighlighting(false);
        onHighlightComplete?.();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightColorKey, mappedPixelData, gridDimensions, onHighlightComplete]);

  // Reset zoom and offset - only when grid dimensions change (not on pixel data changes)
  useEffect(() => {
    if (gridDimensions && canvasRef.current && containerRef.current) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const newOffsetX = (container.clientWidth - canvas.width) / 2;
      const newOffsetY = (container.clientHeight - canvas.height) / 2;
      setScale(1);
      setOffsetX(newOffsetX);
      setOffsetY(newOffsetY);
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridDimensions]);

  // --- Mouse event handlers ---
  
  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && dragStartRef.current) {
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;
      setOffsetX(dragStartRef.current.offsetX + dx);
      setOffsetY(dragStartRef.current.offsetY + dy);
    } else if (isManualColoringMode && isLocalDrawing) {
      const pos = getGridPosition(event.clientX, event.clientY);
      if (pos && onDrawMove) {
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
      if (onDrawEnd && previewEndPos) {
        onDrawEnd(previewEndPos.col, previewEndPos.row);
      }
    }
    onInteraction(0, 0, 0, 0, false, true);
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (event.button === 0) {
      if (isManualColoringMode) {
        setIsLocalDrawing(true);
        const pos = getGridPosition(event.clientX, event.clientY);
        if (pos && onDrawStart) {
          onDrawStart(pos.col, pos.row);
        }
        onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true);
      } else {
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
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
    if (isLocalDrawing) {
      setIsLocalDrawing(false);
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
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const beforeX = (mouseX - offsetX) / scale;
    const beforeY = (mouseY - offsetY) / scale;
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 10);
    setOffsetX(mouseX - beforeX * newScale);
    setOffsetY(mouseY - beforeY * newScale);
    setScale(newScale);
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
          if (onDrawMove) {
            onDrawMove(pos.col, pos.row);
          }
        }
      } else if (dragStartRef.current) {
        // 非手动模式：拖拽画布
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;
        setOffsetX(dragStartRef.current.offsetX + dx);
        setOffsetY(dragStartRef.current.offsetY + dy);
      }
    } else if (event.touches.length === 2 && touchDistanceRef.current && touchCenterRef.current) {
      // 双指缩放
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      const zoomFactor = newDistance / touchDistanceRef.current;
      const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 10);
      const newCenter = { x: (touch1.clientX + touch2.clientX) / 2, y: (touch1.clientY + touch2.clientY) / 2 };
      const scaleRatio = newScale / scale;
      setOffsetX(newCenter.x - (newCenter.x - offsetX) * scaleRatio);
      setOffsetY(newCenter.y - (newCenter.y - offsetY) * scaleRatio);
      setScale(newScale);
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
      if (onDrawEnd && lastTouchGridPosRef.current) {
        onDrawEnd(lastTouchGridPosRef.current.col, lastTouchGridPosRef.current.row);
      }
      lastTouchGridPosRef.current = null;
    }
    
    dragStartRef.current = null;
    touchDistanceRef.current = null;
    touchCenterRef.current = null;
    
    // 如果是点击（没有移动），触发点击交互
    if (isManualColoringMode && !touchMovedRef.current && touchStartPosRef.current) {
      const { x, y, pageX, pageY } = touchStartPosRef.current;
      onInteraction(x, y, pageX, pageY, true);
    }

    touchStartPosRef.current = null;
    touchMovedRef.current = false;
  };

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
      {/* 参考图层画布 - 在主画布下面 */}
      <canvas
        ref={referenceCanvasRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          imageRendering: 'auto',
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      />
      {/* 主画布 */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={(e) => e.stopPropagation()}
        className="border border-gray-300 dark:border-gray-600 rounded block relative z-10"
        style={{
          imageRendering: scale > 1 ? 'pixelated' : 'auto',
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      />
      {/* 预览画布 - 叠加在主画布上 */}
      <canvas
        ref={previewCanvasRef}
        className="absolute top-0 left-0 pointer-events-none z-20"
        style={{
          imageRendering: scale > 1 ? 'pixelated' : 'auto',
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      />
    </div>
  );
};

export default PixelatedPreviewCanvas;
