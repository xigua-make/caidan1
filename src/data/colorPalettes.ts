/**
 * 色板数据定义
 */

import { hexToRgb } from '@/utils/pixelation';
import { getMardToHexMapping } from '@/utils/colorSystemUtils';

/** 品牌色板类型 */
export interface BrandPalette {
  name: string;
  colors: Array<{
    hex: string;
    name: string;
    key: string;
  }>;
}

// 从 colorSystemMapping 获取所有颜色
const mardToHexMapping = getMardToHexMapping();

/** 默认品牌色板（基于 MARD 色号） */
export const defaultBrandPalette: BrandPalette = {
  name: 'MARD',
  colors: Object.entries(mardToHexMapping).map(([key, hex]) => ({
    hex,
    name: key,
    key,
  })),
};

/** 获取所有可用的 hex 颜色列表 */
export function getAllHexColors(): string[] {
  return Object.values(mardToHexMapping);
}

/** 根据色号系统获取色板 */
export function getPaletteBySystem(system: string): BrandPalette {
  return {
    name: system,
    colors: Object.entries(mardToHexMapping).map(([key, hex]) => ({
      hex,
      name: key,
      key,
    })),
  };
}
