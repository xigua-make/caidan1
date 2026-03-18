import { GridDownloadOptions } from '../types/downloadTypes';
import { MappedPixel, PaletteColor } from './pixelation';
import { getDisplayColorKey, getColorKeyByHex, ColorSystem } from './colorSystemUtils';

// iOS 设备检测
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// iOS canvas 最大尺寸限制（保守估计，避免内存问题）
const IOS_MAX_CANVAS_DIMENSION = 3000;
const IOS_MAX_CANVAS_AREA = 9000000; // 约 9MB 像素，更保守

// 用于获取对比色的工具函数 - 从page.tsx复制
function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000'; // Default to black
  // Simple brightness check (Luma formula Y = 0.2126 R + 0.7152 G + 0.0722 B)
  const luma = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luma > 0.5 ? '#000000' : '#FFFFFF'; // Dark background -> white text, Light background -> black text
}

// 辅助函数：将十六进制颜色转换为RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const formattedHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(formattedHex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// 用于排序颜色键的函数 - 从page.tsx复制
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
      return prefixA.localeCompare(prefixB); // Sort by prefix first (A, B, C...)
    }
    return numA - numB; // Then sort by number (1, 2, 10...)
  }
  // Fallback for keys that don't match the standard pattern (e.g., T1, ZG1)
  return a.localeCompare(b);
}

// 导出CSV hex数据的函数
export function exportCsvData({
  mappedPixelData,
  gridDimensions,
  selectedColorSystem
}: {
  mappedPixelData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  selectedColorSystem: ColorSystem;
}): void {
  if (!mappedPixelData || !gridDimensions) {
    console.error("导出失败: 映射数据或尺寸无效。");
    alert("无法导出CSV，数据未生成或无效。");
    return;
  }

  const { N, M } = gridDimensions;
  
  // 生成CSV内容，每行代表图纸的一行
  const csvLines: string[] = [];
  
  for (let row = 0; row < M; row++) {
    const rowData: string[] = [];
    for (let col = 0; col < N; col++) {
      const cellData = mappedPixelData[row][col];
      if (cellData && !cellData.isExternal) {
        // 内部单元格，记录hex颜色值
        rowData.push(cellData.color);
      } else {
        // 外部单元格或空白，使用特殊标记
        rowData.push('TRANSPARENT');
      }
    }
    csvLines.push(rowData.join(','));
  }

  // 创建CSV内容
  const csvContent = csvLines.join('\n');
  
  // 创建并下载CSV文件
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `bead-pattern-${N}x${M}-${selectedColorSystem}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // 释放URL对象
  URL.revokeObjectURL(url);
  
  console.log("CSV数据导出完成");
}

// 导入CSV hex数据的函数
export function importCsvData(file: File): Promise<{
  mappedPixelData: MappedPixel[][];
  gridDimensions: { N: number; M: number };
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          reject(new Error('无法读取文件内容'));
          return;
        }
        
        // 解析CSV内容
        const lines = text.trim().split('\n');
        const M = lines.length; // 行数
        
        if (M === 0) {
          reject(new Error('CSV文件为空'));
          return;
        }
        
        // 解析第一行获取列数
        const firstRowData = lines[0].split(',');
        const N = firstRowData.length; // 列数
        
        if (N === 0) {
          reject(new Error('CSV文件格式无效'));
          return;
        }
        
        // 创建映射数据
        const mappedPixelData: MappedPixel[][] = [];
        
        for (let row = 0; row < M; row++) {
          const rowData = lines[row].split(',');
          const mappedRow: MappedPixel[] = [];
          
          // 确保每行都有正确的列数
          if (rowData.length !== N) {
            reject(new Error(`第${row + 1}行的列数不匹配，期望${N}列，实际${rowData.length}列`));
            return;
          }
          
          for (let col = 0; col < N; col++) {
            const cellValue = rowData[col].trim();
            
            if (cellValue === 'TRANSPARENT' || cellValue === '') {
              // 外部/透明单元格
              mappedRow.push({
                key: 'TRANSPARENT',
                color: '#FFFFFF',
                isExternal: true
              });
            } else {
              // 验证hex颜色格式
              const hexPattern = /^#[0-9A-Fa-f]{6}$/;
              if (!hexPattern.test(cellValue)) {
                reject(new Error(`第${row + 1}行第${col + 1}列的颜色值无效：${cellValue}`));
                return;
              }
              
              // 内部单元格
              mappedRow.push({
                key: cellValue.toUpperCase(),
                color: cellValue.toUpperCase(),
                isExternal: false
              });
            }
          }
          
          mappedPixelData.push(mappedRow);
        }
        
        // 返回解析结果
        resolve({
          mappedPixelData,
          gridDimensions: { N, M }
        });
        
      } catch (error) {
        reject(new Error(`解析CSV文件失败：${error}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsText(file, 'utf-8');
  });
}

// 下载图片的主函数
export async function downloadImage({
  mappedPixelData,
  gridDimensions,
  colorCounts,
  totalBeadCount,
  options,
  activeBeadPalette,
  selectedColorSystem
}: {
  mappedPixelData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  colorCounts: { [key: string]: { count: number; color: string } } | null;
  totalBeadCount: number;
  options: GridDownloadOptions;
  activeBeadPalette: PaletteColor[];
  selectedColorSystem: ColorSystem;
}): Promise<void> {
  if (!mappedPixelData || !gridDimensions || gridDimensions.N === 0 || gridDimensions.M === 0 || activeBeadPalette.length === 0) {
    console.error("下载失败: 映射数据或尺寸无效。");
    alert("无法下载图纸，数据未生成或无效。");
    return;
  }
  if (!colorCounts) {
    console.error("下载失败: 色号统计数据无效。");
    alert("无法下载图纸，色号统计数据未生成或无效。");
    return;
  }
  
  // 加载二维码图片
  const qrCodeImage = new Image();
  qrCodeImage.src = '/website_qrcode.png'; // 使用public目录中的图片
  
  // 主要下载处理函数
  const processDownload = () => {
    const { N, M } = gridDimensions; // 此时已确保gridDimensions不为null
    let downloadCellSize = 30;
  
    // iOS 和安卓统一使用相同的单元格大小，不再降低清晰度
    // 移除了 iOS 设备降低单元格大小的限制逻辑
  
    // 从下载选项中获取设置
    const { showGrid, gridInterval, showCoordinates, gridLineColor, includeStats, showCellNumbers = true } = options;
  
    // 设置边距空间用于坐标轴标注（如果需要）
    const axisLabelSize = showCoordinates ? Math.max(30, Math.floor(downloadCellSize)) : 0;
    
    // 定义统计区域的基本参数
    const statsPadding = 20;
    let statsHeight = 0;
    
    // 预先计算用于字体大小的变量
    const preCalcWidth = N * downloadCellSize + axisLabelSize;
    const preCalcAvailableWidth = preCalcWidth - (statsPadding * 2);
    
    // 计算字体大小 - 与颜色统计区域保持一致
    const baseStatsFontSize = 13;
    const widthFactor = Math.max(0, preCalcAvailableWidth - 350) / 600;
    const statsFontSize = Math.floor(baseStatsFontSize + (widthFactor * 10));
    
    // 计算额外边距，确保坐标数字完全显示（四边都需要）
    const extraLeftMargin = showCoordinates ? Math.max(20, statsFontSize * 2) : 0; // 左侧额外边距
    const extraRightMargin = showCoordinates ? Math.max(20, statsFontSize * 2) : 0; // 右侧额外边距
    const extraTopMargin = showCoordinates ? Math.max(15, statsFontSize) : 0; // 顶部额外边距
    const extraBottomMargin = showCoordinates ? Math.max(15, statsFontSize) : 0; // 底部额外边距
    
    // 计算网格尺寸
    const gridWidth = N * downloadCellSize;
    const gridHeight = M * downloadCellSize;
    
    // 计算小红书标识区域的高度
    const xiaohongshuAreaHeight = 35; // 为小红书名字预留的底部空间
  
    // 计算标题栏高度（根据图片大小自动调整）
    const baseTitleBarHeight = 80; // 增大基础高度
    
    // 先计算一个初始下载宽度来确定缩放比例
    const initialWidth = gridWidth + axisLabelSize + extraLeftMargin;
    // 使用总宽度而不是单元格大小来计算比例，确保字体在大尺寸图片上也足够大
    const titleBarScale = Math.max(1.0, Math.min(2.0, initialWidth / 1000)); // 更激进的缩放策略
    const titleBarHeight = Math.floor(baseTitleBarHeight * titleBarScale);
    
    // 计算标题文字大小 - 与总体宽度相关而不是单元格大小
    const titleFontSize = Math.max(28, Math.floor(28 * titleBarScale)); // 最小28px，确保可读性
    
    // 计算二维码大小
    const qrSize = Math.floor(titleBarHeight * 0.85); // 增大二维码比例
    
    // 计算统计区域的大小
    if (includeStats && colorCounts) {
      const colorKeys = Object.keys(colorCounts);
      
      // 统计区域顶部额外间距
      const statsTopMargin = 24; // 与下方渲染时保持一致
      
      // 固定8列
      const numColumns = 8;
      
      // 使用更大的色块尺寸
      const swatchSize = Math.floor(preCalcAvailableWidth / numColumns * 0.7);
      
      // 计算实际需要的行数
      const numRows = Math.ceil(colorKeys.length / numColumns);
      
      // 计算单行高度
      const statsRowHeight = swatchSize + 8;
      
      // 标题和页脚高度
      const titleHeight = 10; // 简化后的标题区域
      const footerHeight = 40; // 总计部分的高度
      
      // 计算统计区域的总高度 - 需要包含顶部间距
      statsHeight = titleHeight + (numRows * statsRowHeight) + footerHeight + (statsPadding * 2) + statsTopMargin;
    }
  
    // 调整画布大小，包含标题栏、坐标轴、统计区域和小红书标识区域（四边都有坐标）
    const downloadWidth = gridWidth + (axisLabelSize * 2) + extraLeftMargin + extraRightMargin;
    
    // 定义绘制所需的变量
    const brandBlockWidth = titleBarHeight * 0.8;
    const mainTitleFontSize = Math.max(20, Math.floor(titleFontSize * 0.8));
    const subTitleFontSize = Math.max(12, Math.floor(titleFontSize * 0.45));
    const titleStartX = brandBlockWidth + titleBarHeight * 0.3;
    const fontSize = Math.max(8, Math.floor(downloadCellSize * 0.4));
  
    // iOS 设备分块下载逻辑
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const shouldChunkDownload = isIOSDevice && M > 100;
    const maxRowsPerBlock = 100;
    const maxBlocks = 3;

    // 绘制并下载单个分块的函数
    const drawAndDownloadBlock = (
      blockStartRow: number, 
      blockEndRow: number, 
      blockIndex: number, 
      totalBlocks: number
    ) => {
      const blockM = blockEndRow - blockStartRow;
      const blockGridHeight = blockM * downloadCellSize;
      const blockDownloadHeight = titleBarHeight + extraTopMargin + blockGridHeight + (axisLabelSize * 2) + statsHeight + extraBottomMargin + xiaohongshuAreaHeight;
      
      // 创建新的 canvas
      const blockCanvas = document.createElement('canvas');
      blockCanvas.width = downloadWidth;
      blockCanvas.height = blockDownloadHeight;
      const blockCtx = blockCanvas.getContext('2d');
      if (!blockCtx) return;
      blockCtx.imageSmoothingEnabled = false;
      
      // 设置背景色
      blockCtx.fillStyle = '#FFFFFF';
      blockCtx.fillRect(0, 0, downloadWidth, blockDownloadHeight);
    
      // 绘制标题栏
      blockCtx.fillStyle = '#1F2937';
      blockCtx.fillRect(0, 0, downloadWidth, titleBarHeight);
      
      const blockBrandGradient = blockCtx.createLinearGradient(0, 0, brandBlockWidth, titleBarHeight);
      blockBrandGradient.addColorStop(0, '#6366F1');
      blockBrandGradient.addColorStop(1, '#8B5CF6');
      blockCtx.fillStyle = blockBrandGradient;
      blockCtx.fillRect(0, 0, brandBlockWidth, titleBarHeight);
      
      // 绘制西瓜Logo
      const blockLogoSize = titleBarHeight * 0.5;
      const blockLogoX = brandBlockWidth / 2;
      const blockLogoY = titleBarHeight / 2;
      blockCtx.fillStyle = '#22C55E';
      blockCtx.beginPath();
      blockCtx.arc(blockLogoX, blockLogoY, blockLogoSize * 0.45, 0, Math.PI * 2);
      blockCtx.fill();
      blockCtx.fillStyle = '#EF4444';
      blockCtx.beginPath();
      blockCtx.arc(blockLogoX, blockLogoY, blockLogoSize * 0.35, 0, Math.PI * 2);
      blockCtx.fill();
      blockCtx.fillStyle = '#000000';
      const blockSeedPositions = [
        { x: blockLogoX - blockLogoSize * 0.15, y: blockLogoY - blockLogoSize * 0.1 },
        { x: blockLogoX + blockLogoSize * 0.1, y: blockLogoY - blockLogoSize * 0.15 },
        { x: blockLogoX, y: blockLogoY + blockLogoSize * 0.1 },
      ];
      blockSeedPositions.forEach(pos => {
        blockCtx.beginPath();
        blockCtx.ellipse(pos.x, pos.y, blockLogoSize * 0.05, blockLogoSize * 0.08, Math.PI / 4, 0, Math.PI * 2);
        blockCtx.fill();
      });
      
      // 绘制标题
      blockCtx.fillStyle = '#FFFFFF';
      blockCtx.font = `600 ${mainTitleFontSize}px system-ui, -apple-system, sans-serif`;
      blockCtx.textAlign = 'left';
      blockCtx.textBaseline = 'middle';
      blockCtx.fillText('小瓜拼豆生成器', titleStartX, titleBarHeight * 0.4);
      blockCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      blockCtx.font = `400 ${subTitleFontSize}px system-ui, -apple-system, sans-serif`;
      
      // 分块标识
      if (totalBlocks > 1) {
        blockCtx.fillText(`拼豆图纸生成工具 (第${blockIndex + 1}/${totalBlocks}部分)`, titleStartX, titleBarHeight * 0.65);
      } else {
        blockCtx.fillText('拼豆图纸生成工具', titleStartX, titleBarHeight * 0.65);
      }
      
      // 绘制二维码
      const blockQrX = downloadWidth - qrSize - titleBarHeight * 0.15;
      const blockQrY = (titleBarHeight - qrSize) / 2;
      blockCtx.fillStyle = '#FFFFFF';
      blockCtx.beginPath();
      blockCtx.roundRect(blockQrX, blockQrY, qrSize, qrSize, qrSize * 0.08);
      blockCtx.fill();
      if (qrCodeImage.complete && qrCodeImage.naturalWidth !== 0) {
        blockCtx.save();
        blockCtx.beginPath();
        blockCtx.roundRect(blockQrX, blockQrY, qrSize, qrSize, qrSize * 0.08);
        blockCtx.clip();
        blockCtx.drawImage(qrCodeImage, blockQrX, blockQrY, qrSize, qrSize);
        blockCtx.restore();
      }
      
      // 绘制坐标轴
      if (showCoordinates) {
        const axisFontSize = Math.max(10, Math.floor(downloadCellSize * 0.5));
        blockCtx.font = `bold ${axisFontSize}px sans-serif`;
        
        // X轴顶部
        for (let i = 0; i < N; i++) {
          const cellX = extraLeftMargin + axisLabelSize + (i * downloadCellSize);
          const cellY = titleBarHeight + extraTopMargin;
          blockCtx.fillStyle = '#E3F2FD';
          blockCtx.fillRect(cellX, cellY, downloadCellSize, axisLabelSize);
          blockCtx.strokeStyle = '#333333';
          blockCtx.lineWidth = 1;
          blockCtx.strokeRect(cellX, cellY, downloadCellSize, axisLabelSize);
          blockCtx.fillStyle = '#333333';
          blockCtx.textAlign = 'center';
          blockCtx.textBaseline = 'middle';
          blockCtx.fillText((i + 1).toString(), cellX + downloadCellSize / 2, cellY + axisLabelSize / 2);
        }
        
        // X轴底部
        for (let i = 0; i < N; i++) {
          const cellX = extraLeftMargin + axisLabelSize + (i * downloadCellSize);
          const cellY = titleBarHeight + extraTopMargin + axisLabelSize + blockGridHeight;
          blockCtx.fillStyle = '#E3F2FD';
          blockCtx.fillRect(cellX, cellY, downloadCellSize, axisLabelSize);
          blockCtx.strokeStyle = '#333333';
          blockCtx.lineWidth = 1;
          blockCtx.strokeRect(cellX, cellY, downloadCellSize, axisLabelSize);
          blockCtx.fillStyle = '#333333';
          blockCtx.fillText((i + 1).toString(), cellX + downloadCellSize / 2, cellY + axisLabelSize / 2);
        }
        
        // Y轴左侧（显示实际行号）
        for (let j = 0; j < blockM; j++) {
          const actualRow = blockStartRow + j + 1;
          const cellX = extraLeftMargin;
          const cellY = titleBarHeight + extraTopMargin + axisLabelSize + (j * downloadCellSize);
          blockCtx.fillStyle = '#E3F2FD';
          blockCtx.fillRect(cellX, cellY, axisLabelSize, downloadCellSize);
          blockCtx.strokeStyle = '#333333';
          blockCtx.lineWidth = 1;
          blockCtx.strokeRect(cellX, cellY, axisLabelSize, downloadCellSize);
          blockCtx.fillStyle = '#333333';
          blockCtx.fillText(actualRow.toString(), cellX + axisLabelSize / 2, cellY + downloadCellSize / 2);
        }
        
        // Y轴右侧
        for (let j = 0; j < blockM; j++) {
          const actualRow = blockStartRow + j + 1;
          const cellX = extraLeftMargin + axisLabelSize + gridWidth;
          const cellY = titleBarHeight + extraTopMargin + axisLabelSize + (j * downloadCellSize);
          blockCtx.fillStyle = '#E3F2FD';
          blockCtx.fillRect(cellX, cellY, axisLabelSize, downloadCellSize);
          blockCtx.strokeStyle = '#333333';
          blockCtx.lineWidth = 1;
          blockCtx.strokeRect(cellX, cellY, axisLabelSize, downloadCellSize);
          blockCtx.fillStyle = '#333333';
          blockCtx.fillText(actualRow.toString(), cellX + axisLabelSize / 2, cellY + downloadCellSize / 2);
        }
      }
      
      // 绘制单元格
      blockCtx.font = `bold ${fontSize}px sans-serif`;
      blockCtx.textAlign = 'center';
      blockCtx.textBaseline = 'middle';
      
      for (let j = 0; j < blockM; j++) {
        for (let i = 0; i < N; i++) {
          const actualRow = blockStartRow + j;
          const cellData = mappedPixelData[actualRow][i];
          const drawX = extraLeftMargin + i * downloadCellSize + axisLabelSize;
          const drawY = titleBarHeight + extraTopMargin + j * downloadCellSize + axisLabelSize;
          
          if (cellData && !cellData.isExternal) {
            const cellColor = cellData.color || '#FFFFFF';
            blockCtx.fillStyle = cellColor;
            blockCtx.fillRect(drawX, drawY, downloadCellSize, downloadCellSize);
            if (showCellNumbers) {
              const cellKey = getDisplayColorKey(cellData.color || '#FFFFFF', selectedColorSystem);
              blockCtx.fillStyle = getContrastColor(cellColor);
              blockCtx.fillText(cellKey, drawX + downloadCellSize / 2, drawY + downloadCellSize / 2);
            }
          } else {
            blockCtx.fillStyle = '#FFFFFF';
            blockCtx.fillRect(drawX, drawY, downloadCellSize, downloadCellSize);
          }
          blockCtx.strokeStyle = '#DDDDDD';
          blockCtx.lineWidth = 0.5;
          blockCtx.strokeRect(drawX + 0.5, drawY + 0.5, downloadCellSize, downloadCellSize);
        }
      }
      
      // 绘制分隔网格线
      if (showGrid) {
        blockCtx.strokeStyle = gridLineColor;
        blockCtx.lineWidth = 1.5;
        for (let i = gridInterval; i < N; i += gridInterval) {
          const lineX = extraLeftMargin + i * downloadCellSize + axisLabelSize;
          blockCtx.beginPath();
          blockCtx.moveTo(lineX, titleBarHeight + extraTopMargin + axisLabelSize);
          blockCtx.lineTo(lineX, titleBarHeight + extraTopMargin + axisLabelSize + blockGridHeight);
          blockCtx.stroke();
        }
        for (let j = gridInterval; j < blockM; j += gridInterval) {
          const lineY = titleBarHeight + extraTopMargin + j * downloadCellSize + axisLabelSize;
          blockCtx.beginPath();
          blockCtx.moveTo(extraLeftMargin + axisLabelSize, lineY);
          blockCtx.lineTo(extraLeftMargin + axisLabelSize + N * downloadCellSize, lineY);
          blockCtx.stroke();
        }
      }
      
      // 绘制主边框
      blockCtx.strokeStyle = '#000000';
      blockCtx.lineWidth = 1.5;
      blockCtx.strokeRect(
        extraLeftMargin + axisLabelSize + 0.5,
        titleBarHeight + extraTopMargin + axisLabelSize + 0.5,
        N * downloadCellSize,
        blockGridHeight
      );
      
      // 绘制统计信息
      if (includeStats && colorCounts) {
        const colorKeys = Object.keys(colorCounts).sort(sortColorKeys);
        const statsTopMargin = 24;
        const statsY = titleBarHeight + extraTopMargin + blockGridHeight + (axisLabelSize * 2) + statsPadding + statsTopMargin;
        const availableStatsWidth = downloadWidth - (statsPadding * 2);
        const renderNumColumns = 8;
        const itemWidth = Math.floor(availableStatsWidth / renderNumColumns);
        const swatchSize = Math.floor(itemWidth * 0.3);
        const titleHeight = 8;
        const statsRowHeight = swatchSize + 20;
        const colorKeyFontSize = Math.max(6, Math.floor(swatchSize * 0.35));
        const countFontSize = Math.max(8, Math.floor(swatchSize * 0.4));
        
        colorKeys.forEach((key, index) => {
          const rowIndex = Math.floor(index / renderNumColumns);
          const colIndex = index % renderNumColumns;
          const itemX = statsPadding + (colIndex * itemWidth);
          const rowY = statsY + titleHeight + (rowIndex * statsRowHeight) + (swatchSize / 2);
          const cellData = colorCounts[key];
          const colorKey = getColorKeyByHex(key, selectedColorSystem);
          const swatchX = itemX;
          const swatchY = rowY - (swatchSize / 2);
          const cornerRadius = Math.max(3, Math.floor(swatchSize * 0.2));
          
          blockCtx.save();
          blockCtx.shadowColor = 'rgba(0, 0, 0, 0.15)';
          blockCtx.shadowBlur = 3;
          blockCtx.shadowOffsetX = 1;
          blockCtx.shadowOffsetY = 1;
          blockCtx.fillStyle = cellData.color;
          blockCtx.beginPath();
          blockCtx.roundRect(swatchX, swatchY, swatchSize, swatchSize, cornerRadius);
          blockCtx.fill();
          blockCtx.restore();
          
          const rgb = hexToRgb(cellData.color);
          const isLightColor = rgb ? (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128 : false;
          blockCtx.fillStyle = isLightColor ? '#000000' : '#FFFFFF';
          blockCtx.font = `bold ${colorKeyFontSize}px sans-serif`;
          blockCtx.textAlign = 'center';
          blockCtx.textBaseline = 'middle';
          blockCtx.fillText(colorKey, swatchX + swatchSize / 2, rowY);
          blockCtx.fillStyle = '#333333';
          blockCtx.font = `${countFontSize}px sans-serif`;
          blockCtx.textAlign = 'left';
          blockCtx.fillText(`x${cellData.count}`, swatchX + swatchSize + 2, rowY);
        });
        
        const numRows = Math.ceil(colorKeys.length / renderNumColumns);
        const totalY = statsY + titleHeight + (numRows * statsRowHeight) + 10;
        blockCtx.font = `bold ${statsFontSize}px sans-serif`;
        blockCtx.textAlign = 'right';
        blockCtx.fillText(`总计: ${totalBeadCount} 颗`, downloadWidth - statsPadding, totalY);
        
        const statsWatermarkFontSize = Math.max(10, Math.floor(statsFontSize * 0.7));
        blockCtx.font = `500 ${statsWatermarkFontSize}px system-ui, -apple-system, sans-serif`;
        blockCtx.fillStyle = '#64748B';
        blockCtx.textAlign = 'left';
        blockCtx.textBaseline = 'bottom';
        blockCtx.fillText('图纸来源：@小瓜拼豆生成器', statsPadding, totalY + 20);
      }
      
      // 底部水印
      blockCtx.font = `500 12px system-ui, -apple-system, sans-serif`;
      blockCtx.fillStyle = '#999999';
      blockCtx.textAlign = 'center';
      blockCtx.textBaseline = 'bottom';
      blockCtx.fillText('@小瓜拼豆生成器', downloadWidth / 2, blockDownloadHeight - 10);
      
      // 下载
      const dataURL = blockCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      if (totalBlocks > 1) {
        link.download = showCellNumbers
          ? `bead-grid-${N}x${M}-keys-palette_${selectedColorSystem}_part${blockIndex + 1}.png`
          : `bead-grid-${N}x${M}-pixel-palette_${selectedColorSystem}_part${blockIndex + 1}.png`;
      } else {
        link.download = showCellNumbers
          ? `bead-grid-${N}x${M}-keys-palette_${selectedColorSystem}.png`
          : `bead-grid-${N}x${M}-pixel-palette_${selectedColorSystem}.png`;
      }
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log(`第 ${blockIndex + 1}/${totalBlocks} 部分图纸下载已触发`);
    };

    try {
      if (shouldChunkDownload) {
        // iOS 设备且尺寸超过100：分块下载
        const totalBlocks = Math.min(Math.ceil(M / maxRowsPerBlock), maxBlocks);
        console.log(`检测到 iOS 设备，尺寸 ${M}x${N}，将分 ${totalBlocks} 块下载`);
        
        for (let i = 0; i < totalBlocks; i++) {
          const startRow = i * maxRowsPerBlock;
          const endRow = Math.min((i + 1) * maxRowsPerBlock, M);
          drawAndDownloadBlock(startRow, endRow, i, totalBlocks);
        }
      } else {
        // 正常下载完整图纸
        drawAndDownloadBlock(0, M, 0, 1);
      }
      
      // 如果启用了CSV导出，同时导出CSV文件
      if (options.exportCsv) {
        exportCsvData({
          mappedPixelData,
          gridDimensions,
          selectedColorSystem
        });
      }
    } catch (e) {
      console.error("下载图纸失败:", e);
    }
  };
  
  // 图片加载后处理，或在加载失败时使用占位符
  if (qrCodeImage.complete) {
    processDownload();
  } else {
    qrCodeImage.onload = processDownload;
    qrCodeImage.onerror = () => {
      console.warn("二维码图片加载失败，将使用占位符");
      processDownload();
    };
  }
} 
