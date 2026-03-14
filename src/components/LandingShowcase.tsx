'use client';

import React, { useState, useRef } from 'react';

// 视频配置 - 将视频文件放到 public 目录下，然后修改这里的路径
const VIDEO_CONFIG = {
  // 视频路径
  src: '/demo-video.mp4',
  // 封面图路径（视频未播放时显示）
  poster: '/demo-pixelated.png',
  // 视频时长显示
  duration: '1:18',
  // 是否启用视频功能（设为 true 后会显示真实视频播放器）
  enabled: false,
};

/**
 * 首页展示模块
 * 包含：效果展示、视频预览、功能卡片
 */
export default function LandingShowcase() {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8 mt-8 sm:mt-12">
      {/* 效果展示区 */}
      <section className="w-full max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="text-center mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">效果展示</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              左侧上传任意图片，右侧即可自动生成可直接制作的拼豆图纸效果
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            {/* 原图示例 */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-blue-500 font-medium mb-2 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">原图示例</span>
              <div className="w-40 h-40 sm:w-48 sm:h-48 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                <img 
                  src="/demo-original.png" 
                  alt="原图示例" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* 箭头 */}
            <div className="flex items-center justify-center">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300 dark:text-gray-600 rotate-90 sm:rotate-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            
            {/* 拼豆图纸示例 */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-purple-500 font-medium mb-2 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">拼豆图纸示例</span>
              <div className="w-40 h-40 sm:w-48 sm:h-48 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                <img 
                  src="/demo-pixelated.png" 
                  alt="拼豆图纸示例" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 预览视频效果区 */}
      <section className="w-full max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="text-center mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">预览视频效果</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              下单前直观看到成品效果，提升出图效率与成品质量
            </p>
          </div>
          
          <div className="relative w-full max-w-2xl mx-auto">
            {/* 视频播放器 */}
            <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
              {VIDEO_CONFIG.enabled ? (
                /* 真实视频播放器 */
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    poster={VIDEO_CONFIG.poster}
                    onEnded={handleVideoEnd}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    playsInline
                    controls={isPlaying}
                  >
                    <source src={VIDEO_CONFIG.src} type="video/mp4" />
                    您的浏览器不支持视频播放
                  </video>
                  
                  {/* 自定义播放按钮（未播放时显示） */}
                  {!isPlaying && (
                    <>
                      <div className="absolute inset-0 bg-black/30" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button 
                          onClick={handlePlayClick}
                          className="w-16 h-16 sm:w-20 sm:h-20 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105"
                        >
                          <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                  
                  {/* 视频时长 */}
                  {!isPlaying && (
                    <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {VIDEO_CONFIG.duration}
                    </div>
                  )}
                </>
              ) : (
                /* 模拟播放器（无视频时显示） */
                <>
                  {/* 视频封面/占位图 */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img 
                      src={VIDEO_CONFIG.poster} 
                      alt="视频预览" 
                      className="w-full h-full object-cover opacity-60"
                    />
                  </div>
                  
                  {/* 播放按钮 */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="w-16 h-16 sm:w-20 sm:h-20 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* 视频时长 */}
                  <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {VIDEO_CONFIG.duration}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 强大功能区 */}
      <section className="w-full max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">强大功能</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              创建完美拼豆图案所需的一切能力，简单易上手
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* 功能卡片 1: 品牌配色板 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">品牌配色板</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">多种品牌色号系统可选，精确匹配实物珠子颜色</p>
            </div>
            
            {/* 功能卡片 2: 手动颜色编辑 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">手动颜色编辑</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">不满意自动配色？手动微调每个格子的颜色</p>
            </div>
            
            {/* 功能卡片 3: 自动珠子计数 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">自动珠子计数</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">自动统计每种颜色所需珠子数量，开工前心里有数</p>
            </div>
            
            {/* 功能卡片 4: 可调节网格大小 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">可调节网格大小</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">自由调整图纸精细度，从简单到复杂随心控制</p>
            </div>
            
            {/* 功能卡片 5: 可下载图案 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-pink-600 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">可下载图案</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">一键导出高清图纸图片，方便打印或分享</p>
            </div>
            
            {/* 功能卡片 6: 即时处理 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">即时处理</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">上传即生成，无需等待，实时预览效果</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
