"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// 工具类型定义
type ToolType = "brush" | "eraser" | "eyedropper" | "fill" | "line" | "rectangle" | "select" | "move" | "none";

// 选区类型
interface Selection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// 色板预设
const PALETTE_PRESETS = [
  { name: "Perler", colors: ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500", "#800080", "#008000", "#000080", "#800000", "#808000", "#C0C0C0", "#808080"] },
  { name: "Hama", colors: ["#000000", "#FFFFFF", "#FF0033", "#33FF00", "#0033FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FF9900", "#9900FF", "#009900", "#000099", "#990000", "#999900", "#CCCCCC", "#666666"] },
  { name: "Artkal", colors: ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FF6600", "#6600FF", "#006600", "#000066", "#660000", "#666600", "#AAAAAA", "#444444"] },
];

export default function WorkstationPage() {
  // 基础状态
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState<number>(29);
  const [gridHeight, setGridHeight] = useState<number>(29);
  const [isManualColoringMode, setIsManualColoringMode] = useState(false);
  const [pixelData, setPixelData] = useState<{ [key: number]: number } | null>(null);
  const [originalPixelData, setOriginalPixelData] = useState<{ [key: number]: number } | null>(null);
  const [gridDimensions, setGridDimensions] = useState<{ width: number; height: number } | null>(null);
  
  // 手动编辑状态
  const [currentTool, setCurrentTool] = useState<ToolType>("none");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [isMirrorX, setIsMirrorX] = useState<boolean>(false);
  const [isMirrorY, setIsMirrorY] = useState<boolean>(false);
  const [history, setHistory] = useState<{ [key: number]: number }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [clipboard, setClipboard] = useState<{ data: { [key: number]: number }, width: number, height: number } | null>(null);
  const [currentPaletteIndex, setCurrentPaletteIndex] = useState<number>(0);
  const [customPalette, setCustomPalette] = useState<string[]>([]);
  
  // 绘制状态
  const [isDrawing, setIsDrawing] = useState(false);
  const drawStartPos = useRef<{ x: number; y: number } | null>(null);
  const drawCurrentPos = useRef<{ x: number; y: number } | null>(null);
  
  // 文件输入引用
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 画布引用
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // 缩放和偏移状态
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  
  // 当前色板
  const currentPalette = customPalette.length > 0 ? customPalette : PALETTE_PRESETS[currentPaletteIndex].colors;
  
  // 添加到历史记录
  const pushToHistory = useCallback((data: { [key: number]: number }) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(data)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);
  
  // 撤销
  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && pixelData) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPixelData(JSON.parse(JSON.stringify(history[newIndex])));
    }
  }, [history, historyIndex, pixelData]);
  
  // 重做
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1 && pixelData) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPixelData(JSON.parse(JSON.stringify(history[newIndex])));
    }
  }, [history, historyIndex, pixelData]);
  
  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isManualColoringMode) return;
      
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          handleUndo();
        } else if (e.key === "y") {
          e.preventDefault();
          handleRedo();
        }
      } else {
        switch (e.key.toLowerCase()) {
          case "b":
            handleToolClick("brush");
            break;
          case "e":
            handleToolClick("eraser");
            break;
          case "i":
            handleToolClick("eyedropper");
            break;
          case "f":
            handleToolClick("fill");
            break;
          case "l":
            handleToolClick("line");
            break;
          case "r":
            handleToolClick("rectangle");
            break;
          case "s":
            handleToolClick("select");
            break;
          case "m":
            handleToolClick("move");
            break;
          case "escape":
            if (selection) {
              setSelection(null);
            }
            break;
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isManualColoringMode, selection, handleUndo, handleRedo]);
  
  // 计算画布尺寸
  const getCanvasSize = () => {
    const maxSize = 800;
    const aspectRatio = gridWidth / gridHeight;
    
    if (aspectRatio > 1) {
      return { width: maxSize, height: Math.round(maxSize / aspectRatio) };
    } else {
      return { width: Math.round(maxSize * aspectRatio), height: maxSize };
    }
  };
  
  // 处理图片加载和像素化
  useEffect(() => {
    if (!selectedImage || !canvasRef.current) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      setIsImageLoaded(true);
      
      // 创建临时画布进行像素化
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = gridWidth;
      tempCanvas.height = gridHeight;
      const ctx = tempCanvas.getContext('2d');
      
      if (!ctx) return;
      
      // 绘制图片到临时画布
      ctx.drawImage(img, 0, 0, gridWidth, gridHeight);
      
      // 获取像素数据
      const imageData = ctx.getImageData(0, 0, gridWidth, gridHeight);
      const data: { [key: number]: number } = {};
      
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          const i = (y * gridWidth + x) * 4;
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          
          // 找到最近的色板颜色
          const color = findClosestColor(r, g, b, currentPalette);
          const key = y * gridWidth + x;
          data[key] = currentPalette.indexOf(color);
        }
      }
      
      setPixelData(data);
      setOriginalPixelData(JSON.parse(JSON.stringify(data)));
      setGridDimensions({ width: gridWidth, height: gridHeight });
      pushToHistory(data);
      
      // 居中画布
      if (containerRef.current) {
        const canvasSize = getCanvasSize();
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        
        setOffsetX((containerWidth - canvasSize.width) / 2);
        setOffsetY((containerHeight - canvasSize.height) / 2);
        setScale(1);
      }
    };
    
    img.onerror = () => {
      console.error('Failed to load image');
      setIsImageLoaded(false);
    };
    
    img.src = selectedImage;
  }, [selectedImage, gridWidth, gridHeight, currentPalette]);
  
  // 找到最近的色板颜色
  const findClosestColor = (r: number, g: number, b: number, palette: string[]): string => {
    let minDistance = Infinity;
    let closestColor = palette[0];
    
    for (const color of palette) {
      const cr = parseInt(color.slice(1, 3), 16);
      const cg = parseInt(color.slice(3, 5), 16);
      const cb = parseInt(color.slice(5, 7), 16);
      
      const distance = Math.sqrt(
        Math.pow(r - cr, 2) +
        Math.pow(g - cg, 2) +
        Math.pow(b - cb, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = color;
      }
    }
    
    return closestColor;
  };
  
  // 绘制画布
  useEffect(() => {
    if (!canvasRef.current || !isImageLoaded || !pixelData) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const canvasSize = getCanvasSize();
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    
    const cellWidth = canvas.width / gridWidth;
    const cellHeight = canvas.height / gridHeight;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制网格
    const isDarkMode = document.documentElement.classList.contains('dark');
    const gridLineColor = isDarkMode ? '#4B5563' : '#CCCCCC';
    const bgColor = isDarkMode ? '#374151' : '#F3F4F6';
    
    // 绘制背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制像素
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const key = y * gridWidth + x;
        const colorIndex = pixelData[key] ?? 0;
        const color = currentPalette[colorIndex] || currentPalette[0];
        
        ctx.fillStyle = color;
        ctx.fillRect(
          x * cellWidth,
          y * cellHeight,
          cellWidth,
          cellHeight
        );
      }
    }
    
    // 绘制网格线
    ctx.strokeStyle = gridLineColor;
    ctx.lineWidth = 0.5;
    
    for (let x = 0; x <= gridWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellWidth, 0);
      ctx.lineTo(x * cellWidth, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= gridHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellHeight);
      ctx.lineTo(canvas.width, y * cellHeight);
      ctx.stroke();
    }
    
    // 绘制选区
    if (selection) {
      const minX = Math.min(selection.startX, selection.endX);
      const maxX = Math.max(selection.startX, selection.endX);
      const minY = Math.min(selection.startY, selection.endY);
      const maxY = Math.max(selection.startY, selection.endY);
      
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        minX * cellWidth,
        minY * cellHeight,
        (maxX - minX + 1) * cellWidth,
        (maxY - minY + 1) * cellHeight
      );
      ctx.setLineDash([]);
    }
  }, [pixelData, gridWidth, gridHeight, isImageLoaded, currentPalette, selection]);
  
  // 坐标转换
  const getGridPosition = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!canvasRef.current || !gridDimensions || !containerRef.current) return null;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    // 计算鼠标在画布容器中的位置
    const rect = container.getBoundingClientRect();
    const containerX = clientX - rect.left;
    const containerY = clientY - rect.top;
    
    // 计算画布在容器中的位置
    const canvasX = (containerX - offsetX) / scale;
    const canvasY = (containerY - offsetY) / scale;
    
    // 计算网格位置
    const cellWidth = canvas.width / gridDimensions.width;
    const cellHeight = canvas.height / gridDimensions.height;
    
    const x = Math.floor(canvasX / cellWidth);
    const y = Math.floor(canvasY / cellHeight);
    
    if (x >= 0 && x < gridDimensions.width && y >= 0 && y < gridDimensions.height) {
      return { x, y };
    }
    return null;
  };
  
  // 画笔绘制
  const drawPixel = (x: number, y: number) => {
    if (!pixelData || !gridDimensions) return;
    
    const newPixelData = { ...pixelData };
    const colorIndex = currentPalette.indexOf(selectedColor || currentPalette[0]);
    
    const halfSize = Math.floor(brushSize / 2);
    for (let dx = -halfSize; dx <= halfSize; dx++) {
      for (let dy = -halfSize; dy <= halfSize; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < gridDimensions.width && ny >= 0 && ny < gridDimensions.height) {
          const key = ny * gridDimensions.width + nx;
          newPixelData[key] = colorIndex;
          
          if (isMirrorX) {
            const mirrorX = gridDimensions.width - 1 - nx;
            const mirrorKey = ny * gridDimensions.width + mirrorX;
            newPixelData[mirrorKey] = colorIndex;
          }
          
          if (isMirrorY) {
            const mirrorY = gridDimensions.height - 1 - ny;
            const mirrorKey = mirrorY * gridDimensions.width + nx;
            newPixelData[mirrorKey] = colorIndex;
          }
          
          if (isMirrorX && isMirrorY) {
            const mirrorX = gridDimensions.width - 1 - nx;
            const mirrorY = gridDimensions.height - 1 - ny;
            const mirrorKey = mirrorY * gridDimensions.width + mirrorX;
            newPixelData[mirrorKey] = colorIndex;
          }
        }
      }
    }
    
    setPixelData(newPixelData);
    return newPixelData;
  };
  
  // 橡皮擦除
  const erasePixel = (x: number, y: number) => {
    if (!pixelData || !gridDimensions || !originalPixelData) return;
    
    const newPixelData = { ...pixelData };
    
    const halfSize = Math.floor(brushSize / 2);
    for (let dx = -halfSize; dx <= halfSize; dx++) {
      for (let dy = -halfSize; dy <= halfSize; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < gridDimensions.width && ny >= 0 && ny < gridDimensions.height) {
          const key = ny * gridDimensions.width + nx;
          if (originalPixelData[key] !== undefined) {
            newPixelData[key] = originalPixelData[key];
          }
        }
      }
    }
    
    setPixelData(newPixelData);
    return newPixelData;
  };
  
  // 填充算法
  const floodFill = (startX: number, startY: number) => {
    if (!pixelData || !gridDimensions) return;
    
    const startKey = startY * gridDimensions.width + startX;
    const startColor = pixelData[startKey];
    const fillColor = currentPalette.indexOf(selectedColor || currentPalette[0]);
    
    if (startColor === fillColor) return;
    
    const newPixelData = { ...pixelData };
    const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];
    const visited = new Set<number>();
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const key = y * gridDimensions.width + x;
      
      if (visited.has(key)) continue;
      if (x < 0 || x >= gridDimensions.width || y < 0 || y >= gridDimensions.height) continue;
      if (newPixelData[key] !== startColor) continue;
      
      visited.add(key);
      newPixelData[key] = fillColor;
      
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }
    
    setPixelData(newPixelData);
    pushToHistory(newPixelData);
  };
  
  // 绘制直线
  const drawLine = (x0: number, y0: number, x1: number, y1: number) => {
    if (!pixelData || !gridDimensions) return;
    
    const newPixelData = { ...pixelData };
    const colorIndex = currentPalette.indexOf(selectedColor || currentPalette[0]);
    
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    let x = x0;
    let y = y0;
    
    while (true) {
      if (x >= 0 && x < gridDimensions.width && y >= 0 && y < gridDimensions.height) {
        const key = y * gridDimensions.width + x;
        newPixelData[key] = colorIndex;
      }
      
      if (x === x1 && y === y1) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    
    setPixelData(newPixelData);
    return newPixelData;
  };
  
  // 绘制矩形
  const drawRectangle = (x0: number, y0: number, x1: number, y1: number) => {
    if (!pixelData || !gridDimensions) return;
    
    const newPixelData = { ...pixelData };
    const colorIndex = currentPalette.indexOf(selectedColor || currentPalette[0]);
    
    const minX = Math.max(0, Math.min(x0, x1));
    const maxX = Math.min(gridDimensions.width - 1, Math.max(x0, x1));
    const minY = Math.max(0, Math.min(y0, y1));
    const maxY = Math.min(gridDimensions.height - 1, Math.max(y0, y1));
    
    for (let x = minX; x <= maxX; x++) {
      newPixelData[minY * gridDimensions.width + x] = colorIndex;
      newPixelData[maxY * gridDimensions.width + x] = colorIndex;
    }
    
    for (let y = minY; y <= maxY; y++) {
      newPixelData[y * gridDimensions.width + minX] = colorIndex;
      newPixelData[y * gridDimensions.width + maxX] = colorIndex;
    }
    
    setPixelData(newPixelData);
    return newPixelData;
  };
  
  // 绘制开始
  const handleDrawStart = (clientX: number, clientY: number) => {
    const pos = getGridPosition(clientX, clientY);
    if (!pos) return;
    
    setIsDrawing(true);
    drawStartPos.current = pos;
    drawCurrentPos.current = pos;
    
    switch (currentTool) {
      case "brush":
        const newData = drawPixel(pos.x, pos.y);
        if (newData) pushToHistory(newData);
        break;
        
      case "eraser":
        const erasedData = erasePixel(pos.x, pos.y);
        if (erasedData) pushToHistory(erasedData);
        break;
        
      case "eyedropper":
        if (pixelData) {
          const key = pos.y * (gridDimensions?.width || 0) + pos.x;
          const colorIndex = pixelData[key];
          if (colorIndex !== undefined && currentPalette[colorIndex]) {
            setSelectedColor(currentPalette[colorIndex]);
          }
        }
        break;
        
      case "fill":
        floodFill(pos.x, pos.y);
        break;
        
      case "select":
        setSelection({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
        break;
    }
  };
  
  // 绘制移动
  const handleDrawMove = (clientX: number, clientY: number) => {
    if (!isDrawing) return;
    
    const pos = getGridPosition(clientX, clientY);
    if (!pos) return;
    
    drawCurrentPos.current = pos;
    
    switch (currentTool) {
      case "brush":
        if (drawStartPos.current) {
          drawPixel(pos.x, pos.y);
        }
        break;
        
      case "eraser":
        if (drawStartPos.current) {
          erasePixel(pos.x, pos.y);
        }
        break;
        
      case "select":
        if (selection && drawStartPos.current) {
          setSelection({ ...selection, endX: pos.x, endY: pos.y });
        }
        break;
    }
  };
  
  // 绘制结束
  const handleDrawEnd = (clientX: number, clientY: number) => {
    if (!isDrawing) return;
    
    const pos = drawCurrentPos.current;
    
    switch (currentTool) {
      case "line":
        if (drawStartPos.current && pos) {
          const lineData = drawLine(drawStartPos.current.x, drawStartPos.current.y, pos.x, pos.y);
          if (lineData) pushToHistory(lineData);
        }
        break;
        
      case "rectangle":
        if (drawStartPos.current && pos) {
          const rectData = drawRectangle(drawStartPos.current.x, drawStartPos.current.y, pos.x, pos.y);
          if (rectData) pushToHistory(rectData);
        }
        break;
    }
    
    setIsDrawing(false);
    drawStartPos.current = null;
    drawCurrentPos.current = null;
  };
  
  // 工具点击处理
  const handleToolClick = (tool: ToolType) => {
    setCurrentTool(tool);
    if (selectedColor === null && tool !== "none") {
      setSelectedColor(currentPalette[0]);
    }
    if (tool === "select") {
      setSelection(null);
    }
  };
  
  // 文件上传处理
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // 进入手动编辑模式
  const enterManualMode = () => {
    setIsManualColoringMode(true);
  };
  
  // 退出手动编辑模式
  const exitManualMode = () => {
    setIsManualColoringMode(false);
    setCurrentTool("none");
    setSelection(null);
    setIsDrawing(false);
  };
  
  // 鼠标事件处理
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      if (isManualColoringMode && currentTool !== "none") {
        handleDrawStart(e.clientX, e.clientY);
      } else {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          offsetX: offsetX,
          offsetY: offsetY
        };
      }
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setOffsetX(dragStartRef.current.offsetX + dx);
      setOffsetY(dragStartRef.current.offsetY + dy);
    } else if (isDrawing) {
      handleDrawMove(e.clientX, e.clientY);
    }
  };
  
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
    if (isDrawing) {
      handleDrawEnd(e.clientX, e.clientY);
    }
  };
  
  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
    if (isDrawing) {
      handleDrawEnd(0, 0);
    }
  };
  
  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const beforeX = (mouseX - offsetX) / scale;
    const beforeY = (mouseY - offsetY) / scale;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 10);
    
    const newOffsetX = mouseX - beforeX * newScale;
    const newOffsetY = mouseY - beforeY * newScale;
    
    setScale(newScale);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  };
  
  // 工具图标
  const ToolIcon = ({ type }: { type: ToolType }) => {
    const icons: Record<ToolType, string> = {
      brush: "🖌️",
      eraser: "🧽",
      eyedropper: "💧",
      fill: "🪣",
      line: "📏",
      rectangle: "⬜",
      select: "✂️",
      move: "✋",
      none: "❌"
    };
    return <span>{icons[type]}</span>;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-blue-200 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-4 h-[calc(100vh-48px)]">
          {/* 左侧栏 */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
            {/* 图片上传区 */}
            {!isManualColoringMode && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-200">上传图片</h3>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg"
                >
                  选择图片
                </button>
                
                {selectedImage && (
                  <div className="mt-3">
                    <img
                      src={selectedImage}
                      alt="预览"
                      className="w-full h-32 object-contain rounded-lg border border-gray-200"
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* 尺寸设置 */}
            {!isManualColoringMode && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-200">图纸尺寸</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400">宽度</label>
                    <input
                      type="number"
                      value={gridWidth}
                      onChange={(e) => setGridWidth(parseInt(e.target.value) || 29)}
                      className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400">高度</label>
                    <input
                      type="number"
                      value={gridHeight}
                      onChange={(e) => setGridHeight(parseInt(e.target.value) || 29)}
                      className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* 色板设置 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
              <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-200">
                {isManualColoringMode ? "色板" : "自定义色板"}
              </h3>
              
              {/* 色板预设切换 */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {PALETTE_PRESETS.map((palette, index) => (
                  <button
                    key={palette.name}
                    onClick={() => setCurrentPaletteIndex(index)}
                    className={`px-3 py-1 text-xs rounded-lg ${
                      currentPaletteIndex === index
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                    }`}
                  >
                    {palette.name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 进入手动编辑按钮 */}
            {!isManualColoringMode && selectedImage && (
              <button
                onClick={enterManualMode}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg"
              >
                进入手动编辑模式
              </button>
            )}
            
            {/* 退出手动编辑按钮 */}
            {isManualColoringMode && (
              <button
                onClick={exitManualMode}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg"
              >
                退出手动编辑模式
              </button>
            )}
          </div>
          
          {/* 中央画布区 */}
          <div 
            ref={containerRef}
            onWheel={handleWheel}
            className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden relative"
            style={{ cursor: isDragging ? 'grabbing' : (isManualColoringMode && currentTool !== "none" ? 'crosshair' : 'grab') }}
          >
            {selectedImage ? (
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                className="border border-gray-300 dark:border-gray-600 rounded block"
                style={{
                  imageRendering: scale > 1 ? 'pixelated' : 'auto',
                  transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                  transformOrigin: '0 0',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                请先上传图片
              </div>
            )}
          </div>
          
          {/* 右侧栏 - 手动编辑模式 */}
          {isManualColoringMode && (
            <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
              {/* 完整色板 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-200">选择颜色</h3>
                <div className="grid grid-cols-4 gap-2">
                  {currentPalette.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedColor(color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        selectedColor === color
                          ? "border-blue-500 ring-2 ring-blue-300"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              
              {/* 工具按钮 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-200">工具</h3>
                
                {/* 绘图工具 */}
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-2">绘图工具</div>
                  <div className="grid grid-cols-4 gap-2">
                    {(["brush", "eraser", "eyedropper", "fill"] as ToolType[]).map((tool) => (
                      <button
                        key={tool}
                        onClick={() => handleToolClick(tool)}
                        className={`p-2 rounded-lg transition-all text-lg ${
                          currentTool === tool
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                        }`}
                        title={`${tool} (${tool[0].toUpperCase()})`}
                      >
                        <ToolIcon type={tool} />
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* 形状工具 */}
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-2">形状工具</div>
                  <div className="grid grid-cols-4 gap-2">
                    {(["line", "rectangle", "select", "move"] as ToolType[]).map((tool) => (
                      <button
                        key={tool}
                        onClick={() => handleToolClick(tool)}
                        className={`p-2 rounded-lg transition-all text-lg ${
                          currentTool === tool
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                        }`}
                        title={`${tool} (${tool[0].toUpperCase()})`}
                      >
                        <ToolIcon type={tool} />
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* 撤销/重做 */}
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-2">历史</div>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                      className={`p-2 rounded-lg transition-all text-lg ${
                        historyIndex <= 0
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                      }`}
                      title="撤销 (Ctrl+Z)"
                    >
                      ↩️
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={historyIndex >= history.length - 1}
                      className={`p-2 rounded-lg transition-all text-lg ${
                        historyIndex >= history.length - 1
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                      }`}
                      title="重做 (Ctrl+Y)"
                    >
                      ↪️
                    </button>
                  </div>
                </div>
                
                {/* 镜像工具 */}
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-2">镜像</div>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => setIsMirrorX(!isMirrorX)}
                      className={`p-2 rounded-lg transition-all text-lg ${
                        isMirrorX
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                      }`}
                      title="水平镜像"
                    >
                      ↔️
                    </button>
                    <button
                      onClick={() => setIsMirrorY(!isMirrorY)}
                      className={`p-2 rounded-lg transition-all text-lg ${
                        isMirrorY
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                      }`}
                      title="垂直镜像"
                    >
                      ↕️
                    </button>
                  </div>
                </div>
                
                {/* 笔刷大小 */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">笔刷大小: {brushSize}</div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
