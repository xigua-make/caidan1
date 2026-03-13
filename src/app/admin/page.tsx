'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ActivationCode {
  id: number;
  code: string;
  duration_type: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  totalActivations: number;
}

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const DURATION_OPTIONS = [
  { value: '1d', label: '1天', color: 'type-day1' },
  { value: '7d', label: '7天', color: 'type-day7' },
  { value: 'permanent', label: '永久', color: 'type-permanent' },
];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // 生成激活码表单
  const [durationType, setDurationType] = useState('1d');
  const [maxUses, setMaxUses] = useState('1');
  const [generateCount, setGenerateCount] = useState('1');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  
  // 搜索和筛选
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // 编辑模式
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMaxUses, setEditMaxUses] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Toast 通知
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // 登录
  const handleLogin = async () => {
    if (!password.trim()) {
      setLoginError('请输入密码');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/codes', {
        headers: { Authorization: `Bearer ${password}` },
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        setLoginError('');
        setCodes(data.data);
      } else {
        setLoginError('密码错误');
      }
    } catch (error) {
      setLoginError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 获取激活码列表
  const fetchCodes = async () => {
    try {
      const res = await fetch('/api/admin/codes', {
        headers: { Authorization: `Bearer ${password}` },
      });
      const data = await res.json();
      if (data.success) {
        setCodes(data.data);
      } else if (data.error === '未授权') {
        setIsAuthenticated(false);
        setLoginError('会话已过期');
      }
    } catch (error) {
      console.error('获取激活码失败:', error);
    }
  };

  // 生成激活码
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({
          durationType,
          maxUses: parseInt(maxUses),
          count: parseInt(generateCount),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedCodes(data.data);
        showToast(`成功生成 ${data.data.length} 个激活码`, 'success');
        fetchCodes();
      } else {
        showToast(data.error || '生成失败', 'error');
      }
    } catch (error) {
      showToast('网络错误', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 保存编辑
  const handleSaveEdit = async (id: number) => {
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ 
          id, 
          isActive: editIsActive,
          maxUses: parseInt(editMaxUses)
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('保存成功', 'success');
        setEditingId(null);
        fetchCodes();
      } else {
        showToast(data.error || '保存失败', 'error');
      }
    } catch (error) {
      showToast('网络错误', 'error');
    }
  };

  // 开始编辑
  const startEdit = (code: ActivationCode) => {
    setEditingId(code.id);
    setEditMaxUses(code.max_uses.toString());
    setEditIsActive(code.is_active);
  };

  // 删除激活码
  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`确定要删除激活码 ${code} 吗？此操作不可恢复。`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/codes?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${password}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast('删除成功', 'success');
        fetchCodes();
      } else {
        showToast(data.error || '删除失败', 'error');
      }
    } catch (error) {
      showToast('网络错误', 'error');
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
  };

  // 退出登录
  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setCodes([]);
  };

  // 统计数据
  const stats = {
    total: codes.length,
    active: codes.filter(c => c.is_active).length,
    inactive: codes.filter(c => !c.is_active).length,
    totalActivations: codes.reduce((sum, c) => sum + c.totalActivations, 0),
    type1d: codes.filter(c => c.duration_type === '1d').length,
    type7d: codes.filter(c => c.duration_type === '7d').length,
    typePermanent: codes.filter(c => c.duration_type === 'permanent').length,
  };

  // 筛选后的激活码列表
  const filteredCodes = codes.filter(code => {
    const matchSearch = code.code.includes(searchQuery);
    const matchType = filterType === 'all' || code.duration_type === filterType;
    const matchStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && code.is_active) ||
      (filterStatus === 'inactive' && !code.is_active);
    return matchSearch && matchType && matchStatus;
  });

  // 获取有效期标签
  const getDurationLabel = (type: string) => {
    return DURATION_OPTIONS.find(o => o.value === type)?.label || type;
  };

  const getDurationColor = (type: string) => {
    return DURATION_OPTIONS.find(o => o.value === type)?.color || '';
  };

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCodes();
    }
  }, [isAuthenticated]);

  // 登录页面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
            激活码管理后台
          </h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                管理员密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                placeholder="请输入管理员密码"
              />
            </div>
            {loginError && (
              <p className="text-red-500 text-sm text-center">{loginError}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 管理页面
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* 侧边栏 */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-5 shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-indigo-600">激活码管理</span>
        </div>
        
        <nav className="flex-1">
          <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-medium cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>激活码列表</span>
          </div>
        </nav>

        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl w-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">激活码管理</h1>
          <button
            onClick={() => {
              setGeneratedCodes([]);
              setShowGenerateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20 font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>生成激活码</span>
          </button>
        </header>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-5">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm text-gray-500 mb-1">总激活码</h3>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-5">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm text-gray-500 mb-1">已启用</h3>
              <p className="text-2xl font-bold text-gray-800">{stats.active}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-5">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm text-gray-500 mb-1">已禁用</h3>
              <p className="text-2xl font-bold text-gray-800">{stats.inactive}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-5">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm text-gray-500 mb-1">总激活人数</h3>
              <p className="text-2xl font-bold text-gray-800">{stats.totalActivations}</p>
            </div>
          </div>
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* 类型分布 */}
          <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-6">激活码类型分布</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-500 text-right">1天</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${stats.total > 0 ? (stats.type1d / stats.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-12 text-sm font-semibold text-gray-700">{stats.type1d}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-500 text-right">7天</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${stats.total > 0 ? (stats.type7d / stats.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-12 text-sm font-semibold text-gray-700">{stats.type7d}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-500 text-right">永久</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${stats.total > 0 ? (stats.typePermanent / stats.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-12 text-sm font-semibold text-gray-700">{stats.typePermanent}</span>
              </div>
            </div>
          </div>

          {/* 使用统计 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-6">使用率统计</h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">启用率</span>
                  <span className="font-semibold text-gray-700">{stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">平均激活人数</span>
                  <span className="font-semibold text-gray-700">{stats.total > 0 ? (stats.totalActivations / stats.total).toFixed(1) : 0}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, stats.total > 0 ? (stats.totalActivations / stats.total) * 20 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 激活码列表 */}
        <div className="bg-white rounded-xl shadow-sm">
          {/* 搜索和筛选 */}
          <div className="p-6 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <div className="relative">
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索激活码..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none w-64"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="all">全部类型</option>
                <option value="1d">1天</option>
                <option value="7d">7天</option>
                <option value="permanent">永久</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="all">全部状态</option>
                <option value="active">已启用</option>
                <option value="inactive">已禁用</option>
              </select>
            </div>
            <span className="text-sm text-gray-500">共 {filteredCodes.length} 条记录</span>
          </div>

          {/* 表格 */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">激活码</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">有效期</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">使用次数</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">激活人数</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">状态</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">创建时间</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  filteredCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span 
                          onClick={() => copyToClipboard(code.code)}
                          className="font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded cursor-pointer hover:bg-indigo-100 transition-colors"
                        >
                          {code.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`type-badge ${getDurationColor(code.duration_type)}`}>
                          {getDurationLabel(code.duration_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {editingId === code.id ? (
                          <input
                            type="number"
                            value={editMaxUses}
                            onChange={(e) => setEditMaxUses(e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            min="-1"
                          />
                        ) : (
                          <span className="text-gray-700">
                            {code.used_count} / {code.max_uses === -1 ? '∞' : code.max_uses}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{code.totalActivations}</td>
                      <td className="px-6 py-4">
                        {editingId === code.id ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editIsActive}
                              onChange={(e) => setEditIsActive(e.target.checked)}
                              className="w-4 h-4 accent-indigo-500"
                            />
                            <span className="text-sm">{editIsActive ? '启用' : '禁用'}</span>
                          </label>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            code.is_active 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {code.is_active ? '启用' : '禁用'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(code.created_at)}</td>
                      <td className="px-6 py-4">
                        {editingId === code.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(code.id)}
                              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(code)}
                              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="编辑"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(code.id, code.code)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="删除"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 生成激活码弹窗 */}
      {showGenerateModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowGenerateModal(false)}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">生成激活码</h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">有效期类型</label>
                <div className="flex gap-4">
                  {DURATION_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="durationType"
                        value={opt.value}
                        checked={durationType === opt.value}
                        onChange={(e) => setDurationType(e.target.value)}
                        className="w-4 h-4 accent-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">最大使用次数</label>
                <input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  min="-1"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="输入次数，-1表示无限"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">生成数量</label>
                <input
                  type="number"
                  value={generateCount}
                  onChange={(e) => setGenerateCount(e.target.value)}
                  min="1"
                  max="100"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="输入数量 (1-100)"
                />
              </div>
            </div>

            {/* 生成的激活码 */}
            {generatedCodes.length > 0 && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-green-800">
                    已生成 {generatedCodes.length} 个激活码
                  </span>
                  <button
                    onClick={() => copyToClipboard(generatedCodes.join('\n'))}
                    className="text-sm text-green-600 hover:text-green-700 font-medium"
                  >
                    复制全部
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {generatedCodes.map((code) => (
                    <span
                      key={code}
                      onClick={() => copyToClipboard(code)}
                      className="px-3 py-1 bg-white rounded-lg font-mono text-lg cursor-pointer hover:bg-green-100 transition-colors border border-green-200"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                关闭
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? '生成中...' : '生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 通知 */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`bg-white px-5 py-3 rounded-lg shadow-lg border-l-4 flex items-center gap-3 min-w-[250px] animate-slide-in ${
              toast.type === 'success' ? 'border-l-green-500' : 'border-l-red-500'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm text-gray-700">{toast.message}</span>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .type-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          display: inline-block;
        }
        .type-day1 {
          background: #DBEAFE;
          color: #1E40AF;
        }
        .type-day7 {
          background: #FEF3C7;
          color: #92400E;
        }
        .type-permanent {
          background: #D1FAE5;
          color: #065F46;
        }
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease;
        }
      `}</style>
    </div>
  );
}
