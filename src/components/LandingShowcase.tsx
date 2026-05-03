'use client';

import React from 'react';

// B站视频配置
const BILIBILI_CONFIG = {
  // B站视频 BV号（从视频链接中提取）
  bvid: 'BV1hrDNBtE22',
  // 封面图路径（加载前显示）
  poster: '/demo-pixelated.png',
  // 是否启用视频功能
  enabled: true,
};

/**
 * 首页展示模块
 * 包含：效果展示、视频预览、功能卡片
 */
export default function LandingShowcase() {

  return (
    <div className="w-full space-y-4 sm:space-y-8 mt-6 sm:mt-12 px-2 sm:px-4">
      {/* 效果展示区 */}
      <section className="w-full max-w-5xl mx-auto">
        <div className="bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-xl sm:rounded-3xl shadow-xl border border-blue-100 dark:border-gray-600 p-2 sm:p-8">
          {/* 标题区域 */}
          <div className="text-center mb-2 sm:mb-8">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-3">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[9px] sm:text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">实时转换</span>
            </div>
            <h3 className="text-base sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
              效果展示
            </h3>
            <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-300 mt-1.5 sm:mt-3 max-w-2xl mx-auto leading-relaxed px-1 sm:px-2">
              上传任意图片，智能像素化处理，一键生成可直接制作的拼豆图纸。
              无论是照片、插画还是手绘图，都能轻松转换！
            </p>
          </div>

          {/* 效果对比展示 */}
          <div className="flex flex-row items-center justify-center gap-1 sm:gap-8">
            {/* 左侧：原图示例 */}
            <div className="flex flex-col items-center flex-1 max-w-[45%]">
              <div className="relative w-full">
                {/* 标签 */}
                <div className="absolute -top-1 sm:-top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-4 py-0.5 sm:py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[8px] sm:text-xs font-medium rounded-full shadow-lg shadow-blue-500/30 whitespace-nowrap">
                    <svg className="w-2 h-2 sm:w-3.5 sm:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                    原图示例
                  </span>
                </div>

                {/* 图片容器 */}
                <div className="w-full aspect-square bg-white dark:bg-gray-700 rounded-lg sm:rounded-2xl shadow-lg border-2 sm:border-4 border-blue-200 dark:border-gray-600 p-1 sm:p-3 flex items-center justify-center overflow-hidden group hover:shadow-xl hover:shadow-blue-500/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300">
                  <img
                    src="/demo-original.png"
                    alt="原图示例"
                    className="w-full h-full object-contain rounded group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>
            </div>

            {/* 中间：转换箭头 */}
            <div className="flex items-center justify-center flex-shrink-0">
              <div className="relative">
                {/* 主箭头 */}
                <div className="w-6 h-6 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center group hover:scale-110 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300 cursor-pointer">
                  <svg className="w-3 h-3 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white transform group-hover:translate-x-0.5 sm:group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* 装饰光环 */}
                <div className="absolute inset-0 rounded-lg sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300"></div>

                {/* 魔法火花 */}
                <div className="absolute -top-0.5 -right-0.5 sm:-top-2 sm:-right-2 w-2 h-2 sm:w-4 sm:h-4 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
                <div className="absolute -bottom-0.5 -left-0.5 sm:-bottom-2 sm:-left-2 w-1.5 h-1.5 sm:w-3 sm:h-3 bg-pink-400 rounded-full animate-ping opacity-75" style={{ animationDelay: '0.5s' }}></div>
              </div>
            </div>

            {/* 右侧：拼豆图纸示例 */}
            <div className="flex flex-col items-center flex-1 max-w-[45%]">
              <div className="relative w-full">
                {/* 标签 */}
                <div className="absolute -top-1 sm:-top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-4 py-0.5 sm:py-1.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white text-[8px] sm:text-xs font-medium rounded-full shadow-lg shadow-purple-500/30 whitespace-nowrap">
                    <svg className="w-2 h-2 sm:w-3.5 sm:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                    </svg>
                    拼豆图纸示例
                  </span>
                </div>

                {/* 图片容器 */}
                <div className="w-full aspect-square bg-white dark:bg-gray-700 rounded-lg sm:rounded-2xl shadow-lg border-2 sm:border-4 border-purple-200 dark:border-gray-600 p-1 sm:p-3 flex items-center justify-center overflow-hidden group hover:shadow-xl hover:shadow-purple-500/20 hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-300">
                  <img
                    src="/demo-pixelated.png"
                    alt="拼豆图纸示例"
                    className="w-full h-full object-contain rounded group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 底部提示 */}
          <div className="mt-2 sm:mt-8 flex flex-wrap justify-center gap-1 sm:gap-4">
            <div className="flex items-center gap-0.5 sm:gap-2 text-[8px] sm:text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 px-1.5 sm:px-4 py-0.5 sm:py-2 rounded-full shadow-sm">
              <svg className="w-2 h-2 sm:w-4 sm:h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
              </svg>
              <span>支持 JPG/PNG 格式</span>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-2 text-[8px] sm:text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 px-1.5 sm:px-4 py-0.5 sm:py-2 rounded-full shadow-sm">
              <svg className="w-2 h-2 sm:w-4 sm:h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>智能颜色匹配</span>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-2 text-[8px] sm:text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 px-1.5 sm:px-4 py-0.5 sm:py-2 rounded-full shadow-sm">
              <svg className="w-2 h-2 sm:w-4 sm:h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              <span>5种色号系统</span>
            </div>
          </div>
        </div>
      </section>

      {/* 预览视频效果区 */}
      <section className="w-full max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-2xl sm:rounded-3xl shadow-xl border border-indigo-100 dark:border-gray-600 p-4 sm:p-8">
          {/* 标题区域 */}
          <div className="text-center mb-5 sm:mb-6">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-[10px] sm:text-xs font-medium text-red-500 uppercase tracking-wider">视频教程</span>
            </div>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              预览视频效果
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-2 sm:mt-3 max-w-2xl mx-auto leading-relaxed px-2">
              通过详细的视频教程，从零开始学习如何使用小瓜拼豆生成器制作完美的拼豆图案。
              了解每个功能的使用技巧，快速提升你的出图效率和成品质量。
            </p>
          </div>

          {/* 功能亮点 */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white dark:bg-gray-700 rounded-full shadow-sm border border-indigo-100 dark:border-gray-600">
              <svg className="w-3 sm:w-4 h-3 sm:h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
              </svg>
              <span class="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">高清演示</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white dark:bg-gray-700 rounded-full shadow-sm border border-purple-100 dark:border-gray-600">
              <svg className="w-3 sm:w-4 h-3 sm:h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span class="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">完整流程</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white dark:bg-gray-700 rounded-full shadow-sm border border-pink-100 dark:border-gray-600">
              <svg className="w-3 sm:w-4 h-3 sm:h-4 text-pink-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
              <span class="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">新手友好</span>
            </div>
          </div>

          {/* 视频播放器 */}
          <div className="relative w-full max-w-3xl mx-auto">
            <div className="relative bg-gray-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border-2 sm:border-4 border-white dark:border-gray-700 aspect-video group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-300">
              {BILIBILI_CONFIG.enabled ? (
                /* B站视频嵌入 */
                <iframe
                  src={`//player.bilibili.com/player.html?bvid=${BILIBILI_CONFIG.bvid}&page=1&high_quality=1&danmaku=0&autoplay=0`}
                  className="w-full h-full"
                  allowFullScreen
                  scrolling="no"
                  border="0"
                  frameBorder="no"
                  framespacing="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              ) : (
                /* 模拟播放器（无视频时显示） */
                <>
                  {/* 视频封面/占位图 */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={BILIBILI_CONFIG.poster}
                      alt="视频预览"
                      className="w-full h-full object-cover opacity-60"
                    />
                  </div>

                  {/* 播放按钮 */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="w-16 h-16 sm:w-20 sm:h-20 bg-white/95 hover:bg-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 group-hover:ring-4 group-hover:ring-indigo-500/30">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>
                </>
              )}

              {/* 装饰性边框 */}
              <div className="absolute inset-0 pointer-events-none rounded-xl sm:rounded-2xl ring-2 ring-white/20 dark:ring-white/5"></div>
            </div>

            {/* 底部提示 */}
            <div className="mt-3 sm:mt-4 flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
              <svg className="w-3 sm:w-4 h-3 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>视频时长约 5 分钟，建议全屏观看效果更佳</span>
            </div>
          </div>
        </div>
      </section>

      {/* 强大功能区 */}
      <section className="w-full max-w-6xl mx-auto">
        <div className="relative overflow-hidden">
          {/* 背景装饰 */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-white to-teal-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-green-50/20 to-transparent dark:via-green-900/10"></div>

          {/* 内容容器 */}
          <div className="relative p-4 sm:p-8">
            {/* 标题区域 */}
            <div className="text-center mb-6 sm:mb-10">
              <div className="inline-flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">功能特色</span>
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                强大功能
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                创建完美拼豆图案所需的一切能力，简单易上手
              </p>
            </div>

            {/* 功能卡片网格 */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 lg:gap-6">
              {/* 功能卡片 1: 品牌配色板 */}
              <div className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-2 border border-gray-100 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600/50">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 mb-3 sm:mb-4 group-hover:scale-105 transition-transform duration-300">
                  <svg className="w-8 h-8 sm:w-12 sm:h-12 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <h4 className="text-xs sm:text-base font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">品牌配色板</h4>
                <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">多种品牌色号系统可选，精确匹配实物珠子颜色</p>
              </div>

              {/* 功能卡片 2: 手动颜色编辑 */}
              <div className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/20 hover:-translate-y-2 border border-gray-100 dark:border-gray-700/50 hover:border-orange-300 dark:hover:border-orange-600/50">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 mb-3 sm:mb-4 group-hover:scale-105 transition-transform duration-300">
                  <svg className="w-8 h-8 sm:w-12 sm:h-12 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <h4 className="text-xs sm:text-base font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">手动颜色编辑</h4>
                <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">不满意自动配色？手动微调每个格子的颜色</p>
              </div>

              {/* 功能卡片 3: 自动珠子计数 */}
              <div className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-2 border border-gray-100 dark:border-gray-700/50 hover:border-emerald-300 dark:hover:border-emerald-600/50">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-4 mb-3 sm:mb-4 group-hover:scale-105 transition-transform duration-300">
                  <svg className="w-8 h-8 sm:w-12 sm:h-12 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="text-xs sm:text-base font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">自动珠子计数</h4>
                <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">自动统计每种颜色所需珠子数量，开工前心里有数</p>
              </div>

              {/* 功能卡片 4: 可调节网格大小 */}
              <div className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/20 hover:-translate-y-2 border border-gray-100 dark:border-gray-700/50 hover:border-violet-300 dark:hover:border-violet-600/50">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 p-4 mb-3 sm:mb-4 group-hover:scale-105 transition-transform duration-300">
                  <svg className="w-8 h-8 sm:w-12 sm:h-12 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
                <h4 className="text-xs sm:text-base font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">可调节网格大小</h4>
                <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">自由调整图纸精细度，从简单到复杂随心控制</p>
              </div>

              {/* 功能卡片 5: 可下载图案 */}
              <div className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-pink-500/20 hover:-translate-y-2 border border-gray-100 dark:border-gray-700/50 hover:border-pink-300 dark:hover:border-pink-600/50">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 p-4 mb-3 sm:mb-4 group-hover:scale-105 transition-transform duration-300">
                  <svg className="w-8 h-8 sm:w-12 sm:h-12 text-pink-600 dark:text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <h4 className="text-xs sm:text-base font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">可下载图案</h4>
                <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">一键导出高清图纸图片，方便打印或分享</p>
              </div>

              {/* 功能卡片 6: 即时处理 */}
              <div className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-cyan-500/20 hover:-translate-y-2 border border-gray-100 dark:border-gray-700/50 hover:border-cyan-300 dark:hover:border-cyan-600/50">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 p-4 mb-3 sm:mb-4 group-hover:scale-105 transition-transform duration-300">
                  <svg className="w-8 h-8 sm:w-12 sm:h-12 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="text-xs sm:text-base font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">即时处理</h4>
                <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">上传即生成，无需等待，实时预览效果</p>
              </div>
            </div>

            {/* 底部提示 */}
            <div className="mt-8 sm:mt-12 text-center">
              <button className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300 hover:scale-105">
                <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span className="text-sm sm:text-base font-semibold">立即开始创作</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
