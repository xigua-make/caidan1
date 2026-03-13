'use client';

import React, { useState, useEffect } from 'react';

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

const DURATION_OPTIONS = [
  { value: '1d', label: '1天' },
  { value: '7d', label: '7天' },
  { value: 'permanent', label: '永久' },
];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 生成激活码表单
  const [durationType, setDurationType] = useState('1d');
  const [maxUses, setMaxUses] = useState('1');
  const [generateCount, setGenerateCount] = useState('1');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [showGeneratedCodes, setShowGeneratedCodes] = useState(false);

  // 登录
  const handleLogin = () => {
    if (password) {
      setIsAuthenticated(true);
      setLoginError('');
      fetchCodes(password);
    } else {
      setLoginError('请输入密码');
    }
  };

  // 获取激活码列表
  const fetchCodes = async (authPassword: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/codes', {
        headers: { Authorization: `Bearer ${authPassword}` },
      });
      const data = await res.json();
      if (data.success) {
        setCodes(data.data);
      } else {
        if (data.error === '未授权') {
          setIsAuthenticated(false);
          setLoginError('密码错误');
        }
      }
    } catch (error) {
      console.error('获取激活码失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 生成激活码
  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedCodes([]);
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
        setShowGeneratedCodes(true);
        fetchCodes(password);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('生成激活码失败:', error);
      alert('生成失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换激活码状态
  const handleToggle = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCodes(password);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('更新状态失败:', error);
    }
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
        fetchCodes(password);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  // 获取有效期标签
  const getDurationLabel = (type: string) => {
    return DURATION_OPTIONS.find(o => o.value === type)?.label || type;
  };

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCodes(password);
    }
  }, [isAuthenticated]);

  // 登录页面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
            激活码管理后台
          </h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                管理员密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="请输入管理员密码"
              />
            </div>
            {loginError && (
              <p className="text-red-500 text-sm">{loginError}</p>
            )}
            <button
              onClick={handleLogin}
              className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 管理页面
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            激活码管理
          </h1>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setPassword('');
            }}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            退出登录
          </button>
        </div>

        {/* 生成激活码 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            生成激活码
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                有效期
              </label>
              <select
                value={durationType}
                onChange={(e) => setDurationType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                最大使用次数
              </label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                min="-1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">-1 表示无限</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                生成数量
              </label>
              <input
                type="number"
                value={generateCount}
                onChange={(e) => setGenerateCount(e.target.value)}
                min="1"
                max="100"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? '生成中...' : '生成'}
              </button>
            </div>
          </div>

          {/* 生成的激活码 */}
          {showGeneratedCodes && generatedCodes.length > 0 && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-green-800 dark:text-green-300">
                  已生成 {generatedCodes.length} 个激活码：
                </h3>
                <button
                  onClick={() => copyToClipboard(generatedCodes.join('\n'))}
                  className="text-sm text-green-600 hover:text-green-700"
                >
                  复制全部
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {generatedCodes.map((code) => (
                  <span
                    key={code}
                    onClick={() => copyToClipboard(code)}
                    className="px-3 py-1 bg-white dark:bg-gray-700 rounded-lg font-mono text-lg cursor-pointer hover:bg-green-100 dark:hover:bg-gray-600"
                  >
                    {code}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setShowGeneratedCodes(false)}
                className="mt-3 text-sm text-gray-500 hover:text-gray-700"
              >
                关闭
              </button>
            </div>
          )}
        </div>

        {/* 激活码列表 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              激活码列表 ({codes.length})
            </h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">加载中...</div>
          ) : codes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无激活码</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">激活码</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">有效期</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">使用次数</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">激活人数</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">创建时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {codes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-mono text-lg">{code.code}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm">
                          {getDurationLabel(code.duration_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {code.used_count} / {code.max_uses === -1 ? '∞' : code.max_uses}
                      </td>
                      <td className="px-4 py-3">{code.totalActivations}</td>
                      <td className="px-4 py-3">
                        {code.is_active ? (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-sm">
                            启用
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm">
                            禁用
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(code.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggle(code.id, code.is_active)}
                            className={`px-3 py-1 text-sm rounded ${
                              code.is_active
                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {code.is_active ? '禁用' : '启用'}
                          </button>
                          <button
                            onClick={() => handleDelete(code.id, code.code)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
