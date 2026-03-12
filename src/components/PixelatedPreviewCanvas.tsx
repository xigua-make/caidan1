'use client';

import React, { useRef, useEffect, TouchEvent, MouseEvent, useState, WheelEvent } from 'react';
import { MappedPixel } from '../utils/pixelation';

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
}

// 绘制像素化画布的函数
const drawPixelatedCanvas = (
  dataToDraw: MappedPixel[][],
  canvas: HTMLCanvasElement | null,
  dims: { N: number; M: number } | null,
  highlightColorKey?: string | null,
  isHighlighting?: boolean
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

  // Respect current dark mode preference
  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  // Define colors based on mode
  const externalBackgroundColor = isDarkMode ? '#374151' : '#F3F4F6'; // gray-700 : gray-100
  const gridLineColor = isDarkMode ? '#4B5563' : '#DDDDDD'; // gray-600 : lighter gray

  const { N, M } = dims;
  const outputWidth = canvas.width;
  const outputHeight = canvas.height;
  const cellWidthOutput = outputWidth / N;
  const cellHeightOutput = outputHeight / M;

  pixelatedCtx.clearRect(0, 0, outputWidth, outputHeight);
  pixelatedCtx.lineWidth = 0.5; // Keep line width thin

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cellData = dataToDraw[j]?.[i];
      if (!cellData) continue;

      const drawX = i * cellWidthOutput;
      const drawY = j * cellHeightOutput;

      // Fill cell color using mode-specific background for external cells
      if (cellData.isExternal) {
        pixelatedCtx.fillStyle = externalBackgroundColor;
      } else {
        pixelatedCtx.fillStyle = cellData.color;
      }
      pixelatedCtx.fillRect(drawX, drawY, cellWidthOutput, cellHeightOutput);

      // 如果正在高亮且当前单元格不是目标颜色，添加半透明黑色蒙版
      if (isHighlighting && highlightColorKey) {
        let shouldDim = false;
        
        if (cellData.isExternal) {
          // 外部单元格总是变深色（因为它们不是要高亮的颜色）
          shouldDim = true;
        } else {
          // 内部单元格：如果颜色不匹配则变深色
          shouldDim = cellData.color.toUpperCase() !== highlightColorKey.toUpperCase();
        }
        
        if (shouldDim) {
          pixelatedCtx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // 60% 透明度的黑色蒙版
          pixelatedCtx.fillRect(drawX, drawY, cellWidthOutput, cellHeightOutput);
        }
      }

      // Draw grid lines using mode-specific color
      pixelatedCtx.strokeStyle = gridLineColor;
      pixelatedCtx.strokeRect(drawX + 0.5, drawY + 0.5, cellWidthOutput, cellHeightOutput);
    }
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
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  
  // 容器引用，用于计算居中位置
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 触摸缩放相关
  const touchDistanceRef = useRef<number | null>(null);
  const touchCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Effect to detect dark mode changes and update state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDarkMode = () => {
        const isDark = document.documentElement.classList.contains('dark');
        // Only update state if it actually changes
        if (isDark !== darkModeState) {
            setDarkModeState(isDark);
        }
    };

    // Initial check
    checkDarkMode();

    // Use MutationObserver to watch for class changes on <html>
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Cleanup observer on component unmount
    return () => observer.disconnect();

  }, [darkModeState]); // Depend on darkModeState to re-run if needed externally

  // Update useEffect for drawing to depend on darkModeState as well
  useEffect(() => {
    // Ensure darkModeState is not null before drawing
    if (mappedPixelData && gridDimensions && canvasRef.current && darkModeState !== null) {
      console.log(`Redrawing canvas, dark mode: ${darkModeState}`); // Log redraw trigger
      drawPixelatedCanvas(mappedPixelData, canvasRef.current, gridDimensions, highlightColorKey, isHighlighting);
    }
  }, [mappedPixelData, gridDimensions, canvasRef, darkModeState, highlightColorKey, isHighlighting]); // Add darkModeState dependency

  // 处理高亮效果
  useEffect(() => {
    if (highlightColorKey && mappedPixelData && gridDimensions) {
      setIsHighlighting(true);
      // 0.3秒后结束高亮
      const timer = setTimeout(() => {
        setIsHighlighting(false);
        onHighlightComplete?.();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [highlightColorKey, mappedPixelData, gridDimensions, onHighlightComplete]);

  // 重置缩放和偏移（当图片改变时）- 居中显示
  useEffect(() => {
    if (mappedPixelData && gridDimensions && canvasRef.current && containerRef.current) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // 计算居中偏移
      const newOffsetX = (containerWidth - canvasWidth) / 2;
      const newOffsetY = (containerHeight - canvasHeight) / 2;
      
      setScale(1);
      setOffsetX(newOffsetX);
      setOffsetY(newOffsetY);
      setIsInitialized(true);
    }
  }, [mappedPixelData, gridDimensions]);

  // --- 鼠标事件处理 ---
  
  // 鼠标移动时显示提示或拖拽
  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && dragStartRef.current) {
      // 拖拽模式：更新偏移量
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;
      setOffsetX(dragStartRef.current.offsetX + dx);
      setOffsetY(dragStartRef.current.offsetY + dy);
    } else if (!isManualColoringMode) {
      // 非手动模式下：显示tooltip
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, false);
    }
  };

  // 鼠标离开时隐藏提示
  const handleMouseLeave = () => {
    setIsDragging(false);
    dragStartRef.current = null;
    onInteraction(0, 0, 0, 0, false, true);
  };

  // 鼠标按下：开始拖拽（仅在非手动模式）
  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!isManualColoringMode && event.button === 0) {
      setIsDragging(true);
      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: offsetX,
        offsetY: offsetY
      };
    }
  };

  // 鼠标释放：结束拖拽
  const handleMouseUp = (event: MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    } else if (isManualColoringMode) {
      // 手动模式下，执行上色操作
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true);
    } else {
      // 非手动模式下，切换tooltip
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, false);
    }
  };

  // 鼠标滚轮缩放
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // 计算鼠标在缩放前相对于画布的位置
    const beforeX = (mouseX - offsetX) / scale;
    const beforeY = (mouseY - offsetY) / scale;
    
    // 计算新的缩放比例
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 10);
    
    // 调整偏移量，使鼠标位置保持不变
    const newOffsetX = mouseX - beforeX * newScale;
    const newOffsetY = mouseY - beforeY * newScale;
    
    setScale(newScale);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  };

  // --- 触摸事件处理 ---
  
  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      
      // 记录起始位置并重置移动标志
      touchStartPosRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        pageX: touch.pageX,
        pageY: touch.pageY
      };
      touchMovedRef.current = false;
      
      // 开始拖拽
      if (!isManualColoringMode) {
        dragStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          offsetX: offsetX,
          offsetY: offsetY
        };
      }
    } else if (event.touches.length === 2) {
      // 双指缩放：记录初始距离和中心点
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      touchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
      
      touchCenterRef.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    }
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    if (event.touches.length === 1 && dragStartRef.current) {
      // 单指拖拽
      const touch = event.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        touchMovedRef.current = true;
      }
      
      setOffsetX(dragStartRef.current.offsetX + dx);
      setOffsetY(dragStartRef.current.offsetY + dy);
    } else if (event.touches.length === 2 && touchDistanceRef.current && touchCenterRef.current) {
      // 双指缩放
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      
      // 计算新的缩放比例
      const zoomFactor = newDistance / touchDistanceRef.current;
      const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 10);
      
      // 计算新的中心点
      const newCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
      
      // 调整偏移量
      const centerX = touchCenterRef.current.x;
      const centerY = touchCenterRef.current.y;
      const scaleRatio = newScale / scale;
      
      setOffsetX(newCenter.x - (newCenter.x - offsetX) * scaleRatio);
      setOffsetY(newCenter.y - (newCenter.y - offsetY) * scaleRatio);
      setScale(newScale);
      
      // 更新参考值
      touchDistanceRef.current = newDistance;
      touchCenterRef.current = newCenter;
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    // 结束拖拽
    dragStartRef.current = null;
    touchDistanceRef.current = null;
    touchCenterRef.current = null;
    
    // 检查是否是手动模式，并且触摸没有移动（判定为点击）
    if (isManualColoringMode && !touchMovedRef.current && touchStartPosRef.current) {
      const { x, y, pageX, pageY } = touchStartPosRef.current;
      onInteraction(x, y, pageX, pageY, true);
    }

    // 重置触摸状态
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
      style={{ cursor: isDragging ? 'grabbing' : (isManualColoringMode ? 'pointer' : 'grab') }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={(e) => e.stopPropagation()}
        className="border border-gray-300 dark:border-gray-600 rounded block"
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
