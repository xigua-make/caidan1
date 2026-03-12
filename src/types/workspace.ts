/**
 * 工作台类型定义
 */

/** 选区类型 */
export interface Selection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/** 剪贴板类型 */
export interface Clipboard {
  width: number;
  height: number;
  pixels: string[][];
}

/** 工具类型 */
export type Tool = 'brush' | 'eraser' | 'picker' | 'fill' | 'line' | 'rect' | 'select' | 'move' | 'hand';

/** 形状类型 */
export type Shape = 'point' | 'line' | 'rect-fill' | 'rect-stroke';

/** 像素数据类型 */
export interface PixelData {
  width: number;
  height: number;
  pixels: string[][];
}
