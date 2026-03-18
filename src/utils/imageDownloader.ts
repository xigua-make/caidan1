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
  qrCodeImage.crossOrigin = 'anonymous'; // 添加跨域支持
  qrCodeImage.src = '/website_qrcode.png'; // 使用public目录中的图片
  
  // 绘制单个分块的函数
  const drawBlock = (
    ctx: CanvasRenderingContext2D,
    blockStartRow: number,
    blockEndRow: number,
    blockIndex: number,
    totalBlocks: number,
    downloadCellSize: number,
    N: number,
    M: number,
    titleBarHeight: number,
    axisLabelSize: number,
    extraLeftMargin: number,
    extraTopMargin: number,
    gridWidth: number,
    gridHeight: number,
    downloadWidth: number,
    downloadHeight: number,
    showGrid: boolean,
    gridInterval: number,
    showCoordinates: boolean,
    gridLineColor: string,
    includeStats: boolean,
    showCellNumbers: boolean,
    statsHeight: number,
    xiaohongshuAreaHeight: number
  ) => {
    const blockM = blockEndRow - blockStartRow;
    const blockGridHeight = blockM * downloadCellSize;
    
    // 设置背景色
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, downloadWidth, downloadHeight);
  
    // 绘制标题栏
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(0, 0, downloadWidth, titleBarHeight);
    
    // 左侧品牌色块
    const brandBlockWidth = titleBarHeight * 0.8;
    const brandGradient = ctx.createLinearGradient(0, 0, brandBlockWidth, titleBarHeight);
    brandGradient.addColorStop(0, '#6366F1');
    brandGradient.addColorStop(1, '#8B5CF6');
    ctx.fillStyle = brandGradient;
    ctx.fillRect(0, 0, brandBlockWidth, titleBarHeight);
    
    // 绘制西瓜Logo
    const logoSize = titleBarHeight * 0.5;
    const logoX = brandBlockWidth / 2;
    const logoY = titleBarHeight / 2;
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(logoX, logoY, logoSize * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(logoX, logoY, logoSize * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    const seedPositions = [
      { x: logoX - logoSize * 0.15, y: logoY - logoSize * 0.1 },
      { x: logoX + logoSize * 0.1, y: logoY - logoSize * 0.15 },
      { x: logoX, y: logoY + logoSize * 0.1 },
    ];
    seedPositions.forEach(pos => {
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, logoSize * 0.05, logoSize * 0.08, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // 标题
    const mainTitleFontSize = Math.max(20, Math.floor(titleBarHeight * 0.25));
    const subTitleFontSize = Math.max(12, Math.floor(titleBarHeight * 0.15));
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `600 ${mainTitleFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const titleStartX = brandBlockWidth + titleBarHeight * 0.3;
    ctx.fillText('小瓜拼豆生成器', titleStartX, titleBarHeight * 0.4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `400 ${subTitleFontSize}px system-ui, -apple-system, sans-serif`;
    
    // 分块标识
    if (totalBlocks > 1) {
      ctx.fillText(`拼豆图纸生成工具 (第${blockIndex + 1}/${totalBlocks}部分)`, titleStartX, titleBarHeight * 0.65);
    } else {
      ctx.fillText('拼豆图纸生成工具', titleStartX, titleBarHeight * 0.65);
    }
    
    // 二维码
    const qrSize = Math.floor(titleBarHeight * 0.85);
    const qrX = downloadWidth - qrSize - titleBarHeight * 0.15;
    const qrY = (titleBarHeight - qrSize) / 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrSize, qrSize, qrSize * 0.08);
    ctx.fill();
    if (qrCodeImage.complete && qrCodeImage.naturalWidth !== 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(qrX, qrY, qrSize, qrSize, qrSize * 0.08);
      ctx.clip();
      ctx.drawImage(qrCodeImage, qrX, qrY, qrSize, qrSize);
      ctx.restore();
    }
    
    const fontSize = Math.max(8, Math.floor(downloadCellSize * 0.4));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 绘制坐标轴（X轴顶部和底部）
    if (showCoordinates) {
      const axisFontSize = Math.max(10, Math.floor(downloadCellSize * 0.5));
      ctx.font = `bold ${axisFontSize}px sans-serif`;
      
      // X轴顶部
      for (let i = 0; i < N; i++) {
        const cellX = extraLeftMargin + axisLabelSize + (i * downloadCellSize);
        const cellY = titleBarHeight + extraTopMargin;
        ctx.fillStyle = '#E3F2FD';
        ctx.fillRect(cellX, cellY, downloadCellSize, axisLabelSize);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, downloadCellSize, axisLabelSize);
        ctx.fillStyle = '#333333';
        ctx.fillText((i + 1).toString(), cellX + downloadCellSize / 2, cellY + axisLabelSize / 2);
      }
      
      // X轴底部
      for (let i = 0; i < N; i++) {
        const cellX = extraLeftMargin + axisLabelSize + (i * downloadCellSize);
        const cellY = titleBarHeight + extraTopMargin + axisLabelSize + blockGridHeight;
        ctx.fillStyle = '#E3F2FD';
        ctx.fillRect(cellX, cellY, downloadCellSize, axisLabelSize);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, downloadCellSize, axisLabelSize);
        ctx.fillStyle = '#333333';
        ctx.fillText((i + 1).toString(), cellX + downloadCellSize / 2, cellY + axisLabelSize / 2);
      }
      
      // Y轴左侧（显示实际行号）
      for (let j = 0; j < blockM; j++) {
        const actualRow = blockStartRow + j + 1;
        const cellX = extraLeftMargin;
        const cellY = titleBarHeight + extraTopMargin + axisLabelSize + (j * downloadCellSize);
        ctx.fillStyle = '#E3F2FD';
        ctx.fillRect(cellX, cellY, axisLabelSize, downloadCellSize);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, axisLabelSize, downloadCellSize);
        ctx.fillStyle = '#333333';
        ctx.fillText(actualRow.toString(), cellX + axisLabelSize / 2, cellY + downloadCellSize / 2);
      }
      
      // Y轴右侧
      for (let j = 0; j < blockM; j++) {
        const actualRow = blockStartRow + j + 1;
        const cellX = extraLeftMargin + axisLabelSize + gridWidth;
        const cellY = titleBarHeight + extraTopMargin + axisLabelSize + (j * downloadCellSize);
        ctx.fillStyle = '#E3F2FD';
        ctx.fillRect(cellX, cellY, axisLabelSize, downloadCellSize);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, axisLabelSize, downloadCellSize);
        ctx.fillStyle = '#333333';
        ctx.fillText(actualRow.toString(), cellX + axisLabelSize / 2, cellY + downloadCellSize / 2);
      }
    }
    
    // 绘制单元格
    ctx.font = `bold ${fontSize}px sans-serif`;
    for (let j = 0; j < blockM; j++) {
      for (let i = 0; i < N; i++) {
        const actualRow = blockStartRow + j;
        const cellData = mappedPixelData[actualRow][i];
        const drawX = extraLeftMargin + i * downloadCellSize + axisLabelSize;
        const drawY = titleBarHeight + extraTopMargin + j * downloadCellSize + axisLabelSize;
        
        if (cellData && !cellData.isExternal) {
          const cellColor = cellData.color || '#FFFFFF';
          ctx.fillStyle = cellColor;
          ctx.fillRect(drawX, drawY, downloadCellSize, downloadCellSize);
          if (showCellNumbers) {
            const cellKey = getDisplayColorKey(cellData.color || '#FFFFFF', selectedColorSystem);
            ctx.fillStyle = getContrastColor(cellColor);
            ctx.fillText(cellKey, drawX + downloadCellSize / 2, drawY + downloadCellSize / 2);
          }
        } else {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(drawX, drawY, downloadCellSize, downloadCellSize);
        }
        ctx.strokeStyle = '#DDDDDD';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(drawX + 0.5, drawY + 0.5, downloadCellSize, downloadCellSize);
      }
    }
    
    // 绘制分隔网格线
    if (showGrid) {
      ctx.strokeStyle = gridLineColor;
      ctx.lineWidth = 1.5;
      for (let i = gridInterval; i < N; i += gridInterval) {
        const lineX = extraLeftMargin + i * downloadCellSize + axisLabelSize;
        ctx.beginPath();
        ctx.moveTo(lineX, titleBarHeight + extraTopMargin + axisLabelSize);
        ctx.lineTo(lineX, titleBarHeight + extraTopMargin + axisLabelSize + blockGridHeight);
        ctx.stroke();
      }
      for (let j = gridInterval; j < blockM; j += gridInterval) {
        const lineY = titleBarHeight + extraTopMargin + j * downloadCellSize + axisLabelSize;
        ctx.beginPath();
        ctx.moveTo(extraLeftMargin + axisLabelSize, lineY);
        ctx.lineTo(extraLeftMargin + axisLabelSize + N * downloadCellSize, lineY);
        ctx.stroke();
      }
    }
    
    // 绘制主边框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      extraLeftMargin + axisLabelSize + 0.5,
      titleBarHeight + extraTopMargin + axisLabelSize + 0.5,
      N * downloadCellSize,
      blockGridHeight
    );
    
    // 绘制统计信息
    if (includeStats && colorCounts) {
      const statsPadding = 20;
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
        
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = cellData.color;
        ctx.beginPath();
        ctx.roundRect(swatchX, swatchY, swatchSize, swatchSize, cornerRadius);
        ctx.fill();
        ctx.restore();
        
        const rgb = hexToRgb(cellData.color);
        const isLightColor = rgb ? (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128 : false;
        ctx.fillStyle = isLightColor ? '#000000' : '#FFFFFF';
        ctx.font = `bold ${colorKeyFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(colorKey, swatchX + swatchSize / 2, rowY);
        ctx.fillStyle = '#333333';
        ctx.font = `${countFontSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`x${cellData.count}`, swatchX + swatchSize + 2, rowY);
      });
      
      const numRows = Math.ceil(colorKeys.length / renderNumColumns);
      const statsFontSize = 13;
      const totalY = statsY + titleHeight + (numRows * statsRowHeight) + 10;
      ctx.font = `bold ${statsFontSize}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`总计: ${totalBeadCount} 颗`, downloadWidth - statsPadding, totalY);
      
      const statsWatermarkFontSize = Math.max(10, Math.floor(statsFontSize * 0.7));
      ctx.font = `500 ${statsWatermarkFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('图纸来源：@小瓜拼豆生成器', statsPadding, totalY + 20);
    }
    
    // 底部水印
    ctx.font = `500 12px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#999999';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('@小瓜拼豆生成器', downloadWidth / 2, downloadHeight - 10);
  };
  
  // 主要下载处理函数
  const processDownload = () => {
    console.log("processDownload 开始执行...");
    const { N, M } = gridDimensions; // 此时已确保gridDimensions不为null
    console.log(`网格尺寸: ${N}x${M}`);
    let downloadCellSize = 30;
  
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
    let downloadWidth = gridWidth + (axisLabelSize * 2) + extraLeftMargin + extraRightMargin;
    let downloadHeight = titleBarHeight + gridHeight + (axisLabelSize * 2) + statsHeight + extraTopMargin + extraBottomMargin + xiaohongshuAreaHeight;
  
    // iOS 设备分块下载逻辑
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const shouldChunkDownload = isIOS && M > 100;
    const maxRowsPerBlock = 100;
    const maxBlocks = 3;
    
    const downloadSingleBlock = (blockIndex: number, totalBlocks: number) => {
      console.log(`downloadSingleBlock 被调用: blockIndex=${blockIndex}, totalBlocks=${totalBlocks}`);
      const blockStartRow = blockIndex * maxRowsPerBlock;
      const blockEndRow = Math.min((blockIndex + 1) * maxRowsPerBlock, M);
      const blockM = blockEndRow - blockStartRow;
      const blockGridHeight = blockM * downloadCellSize;
      console.log(`块范围: ${blockStartRow}-${blockEndRow}, 行数: ${blockM}`);
      
      // 计算当前块的画布高度
      const blockDownloadHeight = titleBarHeight + extraTopMargin + blockGridHeight + (axisLabelSize * 2) + statsHeight + extraBottomMargin + xiaohongshuAreaHeight;
      console.log(`画布尺寸: ${downloadWidth}x${blockDownloadHeight}`);
      
      const blockCanvas = document.createElement('canvas');
      blockCanvas.width = downloadWidth;
      blockCanvas.height = blockDownloadHeight;
      const blockCtx = blockCanvas.getContext('2d');
      
      if (!blockCtx) {
        console.error(`下载失败: 无法创建第 ${blockIndex + 1} 块的 Canvas Context。`);
        return;
      }
      
      blockCtx.imageSmoothingEnabled = false;
      
      // 绘制当前块
      drawBlock(
        blockCtx,
        blockStartRow,
        blockEndRow,
        blockIndex,
        totalBlocks,
        downloadCellSize,
        N,
        M,
        titleBarHeight,
        axisLabelSize,
        extraLeftMargin,
        extraTopMargin,
        gridWidth,
        blockGridHeight,
        downloadWidth,
        blockDownloadHeight,
        showGrid,
        gridInterval,
        showCoordinates,
        gridLineColor,
        includeStats,
        showCellNumbers,
        statsHeight,
        xiaohongshuAreaHeight
      );
      
      console.log(`drawBlock 调用完成，准备生成 dataURL`);
      
      // 下载当前块
      const dataURL = blockCanvas.toDataURL('image/png');
      console.log(`dataURL 生成完成，长度: ${dataURL.length}`);
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
        
        // 依次下载每一块
        for (let i = 0; i < totalBlocks; i++) {
          downloadSingleBlock(i, totalBlocks);
        }
      } else {
        // 非 iOS 设备或尺寸≤100：完整下载
        downloadSingleBlock(0, 1);
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
  console.log("downloadImage 函数被调用，准备加载二维码图片...");
  console.log("qrCodeImage.complete:", qrCodeImage.complete);
  
  // 设置超时机制，确保即使图片加载失败也能继续下载
  const timeoutId = setTimeout(() => {
    console.warn("二维码图片加载超时，使用占位符继续下载");
    processDownload();
  }, 2000);
  
  if (qrCodeImage.complete) {
    clearTimeout(timeoutId);
    console.log("二维码图片已加载完成，直接处理下载");
    processDownload();
  } else {
    qrCodeImage.onload = () => {
      clearTimeout(timeoutId);
      console.log("二维码图片加载完成，处理下载");
      processDownload();
    };
    qrCodeImage.onerror = () => {
      clearTimeout(timeoutId);
      console.warn("二维码图片加载失败，将使用占位符");
      processDownload();
    };
  }
} 
