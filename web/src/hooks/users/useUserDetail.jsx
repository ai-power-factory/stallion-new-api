/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * 用户详情页面的核心数据 Hook
 *
 * 管理以下数据域：
 * 1. 用户基本信息 - 获取和刷新
 * 2. 令牌管理 - 完整的 CRUD 操作（基于管理员视角）
 * 3. 使用日志 - 日志查询和统计
 * 4. 用户管理操作 - 提升、降级、启用、禁用
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@douyinfe/semi-ui';
import {
  API,
  copy,
  showError,
  showSuccess,
  timestamp2string,
  getTodayStartTimestamp,
  renderQuota,
  renderNumber,
  getLogOther,
  isAdmin,
  renderClaudeLogContent,
  renderLogContent,
  renderAudioModelPrice,
  renderClaudeModelPrice,
  renderModelPrice,
  encodeToBase64,
} from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { useTableCompactMode } from '../common/useTableCompactMode';
import {
  fetchTokenKey as fetchTokenKeyById,
  getServerAddress,
  encodeChannelConnectionString,
} from '../../helpers/token';
import ParamOverrideEntry from '../../components/table/usage-logs/components/ParamOverrideEntry';

/**
 * 用户详情 Hook
 * @param {string|number} userId - 用户 ID
 * @returns {object} 用户详情页面所需的全部数据和方法
 */
export const useUserDetail = (userId) => {
  const { t } = useTranslation();

  // ========================
  // 标签页状态
  // ========================
  const [activeTab, setActiveTab] = useState('tokens');

  // ========================
  // 用户信息状态
  // ========================
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  // 用户编辑弹窗状态
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState({ id: undefined });

  // 用户操作弹窗状态
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showDemoteModal, setShowDemoteModal] = useState(false);
  const [showEnableDisableModal, setShowEnableDisableModal] = useState(false);
  const [enableDisableAction, setEnableDisableAction] = useState('');

  // ========================
  // 令牌相关状态
  // ========================
  const [tokens, setTokens] = useState([]);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenActivePage, setTokenActivePage] = useState(1);
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenPageSize, setTokenPageSize] = useState(ITEMS_PER_PAGE);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);

  // 令牌选择状态
  const [selectedKeys, setSelectedKeys] = useState([]);

  // 令牌编辑状态
  const [showEdit, setShowEdit] = useState(false);
  const [editingToken, setEditingToken] = useState({ id: undefined });

  // 令牌 UI 状态
  const [compactMode, setCompactMode] = useTableCompactMode('user-detail-tokens');
  const [showKeys, setShowKeys] = useState({});
  const [resolvedTokenKeys, setResolvedTokenKeys] = useState({});
  const [loadingTokenKeys, setLoadingTokenKeys] = useState({});
  const keyRequestsRef = useRef({});

  // 令牌搜索表单状态
  const [tokenFormApi, setTokenFormApi] = useState(null);
  const tokenFormInitValues = {
    searchKeyword: '',
    searchToken: '',
  };

  // ========================
  // 日志相关状态
  // ========================
  const [logs, setLogs] = useState([]);
  const [expandData, setExpandData] = useState({});
  const [logLoading, setLogLoading] = useState(false);
  const [loadingStat, setLoadingStat] = useState(false);
  const [showStat, setShowStat] = useState(false);
  const [logActivePage, setLogActivePage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [logPageSize, setLogPageSize] = useState(ITEMS_PER_PAGE);
  const [logType, setLogType] = useState(0);

  // 日志统计
  const [stat, setStat] = useState({
    quota: 0,
    token: 0,
    rpm: 0,
    tpm: 0,
  });

  // 管理员标识
  const isAdminUser = isAdmin();

  // 日志列可见性配置
  const COLUMN_KEYS = {
    TIME: 'time',
    CHANNEL: 'channel',
    USERNAME: 'username',
    TOKEN: 'token',
    GROUP: 'group',
    TYPE: 'type',
    MODEL: 'model',
    USE_TIME: 'use_time',
    PROMPT: 'prompt',
    COMPLETION: 'completion',
    COST: 'cost',
    RETRY: 'retry',
    IP: 'ip',
    DETAILS: 'details',
  };

  // 日志列可见性存储 key
  const LOG_STORAGE_KEY = 'user-detail-logs-table-columns';
  const BILLING_DISPLAY_MODE_STORAGE_KEY = 'user-detail-logs-billing-display-mode';

  /**
   * 获取默认列可见性配置
   */
  const getDefaultColumnVisibility = () => ({
    [COLUMN_KEYS.TIME]: true,
    [COLUMN_KEYS.CHANNEL]: isAdminUser,
    [COLUMN_KEYS.USERNAME]: false, // 用户详情页不需要显示用户名列
    [COLUMN_KEYS.TOKEN]: true,
    [COLUMN_KEYS.GROUP]: true,
    [COLUMN_KEYS.TYPE]: true,
    [COLUMN_KEYS.MODEL]: true,
    [COLUMN_KEYS.USE_TIME]: true,
    [COLUMN_KEYS.PROMPT]: true,
    [COLUMN_KEYS.COMPLETION]: true,
    [COLUMN_KEYS.COST]: true,
    [COLUMN_KEYS.RETRY]: isAdminUser,
    [COLUMN_KEYS.IP]: true,
    [COLUMN_KEYS.DETAILS]: true,
  });

  /**
   * 从 localStorage 获取初始列可见性
   */
  const getInitialVisibleColumns = () => {
    const defaults = getDefaultColumnVisibility();
    const savedColumns = localStorage.getItem(LOG_STORAGE_KEY);
    if (!savedColumns) return defaults;
    try {
      const parsed = JSON.parse(savedColumns);
      return { ...defaults, ...parsed };
    } catch (e) {
      console.error('解析保存的列配置失败', e);
      return defaults;
    }
  };

  /**
   * 获取初始计费显示模式
   */
  const getInitialBillingDisplayMode = () => {
    const savedMode = localStorage.getItem(BILLING_DISPLAY_MODE_STORAGE_KEY);
    if (savedMode === 'price' || savedMode === 'ratio') return savedMode;
    return localStorage.getItem('quota_display_type') === 'TOKENS' ? 'ratio' : 'price';
  };

  // 日志列可见性状态
  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [billingDisplayMode, setBillingDisplayMode] = useState(getInitialBillingDisplayMode);

  // 日志紧凑模式
  const [logCompactMode, setLogCompactMode] = useTableCompactMode('user-detail-logs');

  // 日志搜索表单状态
  const [logFormApi, setLogFormApi] = useState(null);
  const now = new Date();
  const logFormInitValues = {
    token_name: '',
    model_name: '',
    channel: '',
    group: '',
    request_id: '',
    dateRange: [
      timestamp2string(getTodayStartTimestamp()),
      timestamp2string(now.getTime() / 1000 + 3600),
    ],
    logType: '0',
  };

  // 用户信息弹窗状态（日志中点击用户名查看）
  const [showUserInfo, setShowUserInfoModal] = useState(false);
  const [userInfoData, setUserInfoData] = useState(null);

  // 渠道亲和性使用缓存弹窗状态
  const [showChannelAffinityUsageCacheModal, setShowChannelAffinityUsageCacheModal] = useState(false);
  const [channelAffinityUsageCacheTarget, setChannelAffinityUsageCacheTarget] = useState(null);

  // 参数覆盖弹窗状态
  const [showParamOverrideModal, setShowParamOverrideModal] = useState(false);
  const [paramOverrideTarget, setParamOverrideTarget] = useState(null);

  // ========================================
  // 用户信息相关方法
  // ========================================

  /**
   * 获取用户信息
   */
  const refreshUser = async () => {
    setUserLoading(true);
    try {
      const res = await API.get(`/api/user/${userId}`);
      const { success, message, data } = res.data;
      if (success) {
        setUser(data);
      } else {
        showError(message);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      showError(error.message || t('获取用户信息失败'));
    }
    setUserLoading(false);
  };

  /**
   * 管理用户操作（提升、降级、启用、禁用）
   * @param {string} action - 操作类型: promote, demote, enable, disable
   */
  const manageUser = async (action) => {
    try {
      const res = await API.post('/api/user/manage', {
        id: parseInt(userId),
        action,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('操作成功完成！'));
        // 更新本地用户数据
        setUser((prev) => ({
          ...prev,
          status: data.status,
          role: data.role,
        }));
      } else {
        showError(message);
      }
    } catch (error) {
      console.error('用户管理操作失败:', error);
      showError(error.message || t('操作失败'));
    }
  };

  // ========================================
  // 令牌相关方法
  // ========================================

  /**
   * 获取令牌搜索表单值
   */
  const getTokenFormValues = () => {
    const formValues = tokenFormApi ? tokenFormApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
      searchToken: formValues.searchToken || '',
    };
  };

  /**
   * 关闭令牌编辑弹窗
   */
  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => {
      setEditingToken({ id: undefined });
    }, 500);
  };

  /**
   * 同步令牌分页数据
   * @param {object} payload - API 返回的分页数据
   */
  const syncTokenPageData = (payload) => {
    setTokens(payload.items || []);
    setTokenCount(payload.total || 0);
    setTokenActivePage(payload.page || 1);
    setTokenPageSize(payload.page_size || tokenPageSize);
    setShowKeys({});
  };

  /**
   * 加载用户的令牌列表
   * @param {number} page - 页码
   * @param {number} size - 每页数量
   */
  const loadTokens = async (page = 1, size = tokenPageSize) => {
    setTokenLoading(true);
    setSearchMode(false);
    try {
      const res = await API.get(`/api/user/${userId}/tokens?p=${page}&size=${size}`);
      const { success, message, data } = res.data;
      if (success) {
        syncTokenPageData(data);
      } else {
        showError(message);
      }
    } catch (error) {
      console.error('加载令牌失败:', error);
      showError(error.message || t('加载令牌失败'));
    }
    setTokenLoading(false);
  };

  /**
   * 刷新令牌列表
   * @param {number} page - 要刷新到的页码
   */
  const refreshTokens = async (page = tokenActivePage) => {
    await loadTokens(page);
    setSelectedKeys([]);
  };

  /**
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   */
  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制到剪贴板！'));
    } else {
      Modal.error({
        title: t('无法复制到剪贴板，请手动复制'),
        content: text,
        size: 'large',
      });
    }
  };

  /**
   * 获取令牌密钥
   * @param {object|number} tokenOrId - 令牌对象或令牌 ID
   * @param {object} options - 可选参数
   * @returns {Promise<string>} 令牌密钥
   */
  const fetchTokenKey = async (tokenOrId, options = {}) => {
    const { suppressError = false } = options;
    const tokenId = typeof tokenOrId === 'object' ? tokenOrId?.id : Number(tokenOrId);

    if (!tokenId) {
      const error = new Error(t('令牌不存在'));
      if (!suppressError) showError(error.message);
      throw error;
    }

    // 如果已缓存，直接返回
    if (resolvedTokenKeys[tokenId]) {
      return resolvedTokenKeys[tokenId];
    }

    // 如果正在请求中，返回现有 Promise
    if (keyRequestsRef.current[tokenId]) {
      return keyRequestsRef.current[tokenId];
    }

    // 发起新请求，使用管理员端点获取令牌密钥
    const request = (async () => {
      setLoadingTokenKeys((prev) => ({ ...prev, [tokenId]: true }));
      try {
        const res = await API.post(`/api/user/${userId}/tokens/${tokenId}/key`);
        const { success, data, message } = res.data || {};
        if (!success || !data?.key) {
          throw new Error(message || t('获取令牌密钥失败'));
        }
        const fullKey = data.key;
        setResolvedTokenKeys((prev) => ({ ...prev, [tokenId]: fullKey }));
        return fullKey;
      } catch (error) {
        const normalizedError = new Error(error?.message || t('获取令牌密钥失败'));
        if (!suppressError) showError(normalizedError.message);
        throw normalizedError;
      } finally {
        delete keyRequestsRef.current[tokenId];
        setLoadingTokenKeys((prev) => {
          const next = { ...prev };
          delete next[tokenId];
          return next;
        });
      }
    })();

    keyRequestsRef.current[tokenId] = request;
    return request;
  };

  /**
   * 切换令牌密钥的可见性
   * @param {object} record - 令牌记录
   */
  const toggleTokenVisibility = async (record) => {
    const tokenId = record?.id;
    if (!tokenId) return;

    if (showKeys[tokenId]) {
      setShowKeys((prev) => ({ ...prev, [tokenId]: false }));
      return;
    }

    const fullKey = await fetchTokenKey(record);
    if (fullKey) {
      setShowKeys((prev) => ({ ...prev, [tokenId]: true }));
    }
  };

  /**
   * 复制令牌密钥（带 sk- 前缀）
   * @param {object} record - 令牌记录
   */
  const copyTokenKey = async (record) => {
    const fullKey = await fetchTokenKey(record);
    await copyText(`sk-${fullKey}`);
  };

  /**
   * 复制令牌连接字符串
   * @param {object} record - 令牌记录
   */
  const copyTokenConnectionString = async (record) => {
    const fullKey = await fetchTokenKey(record);
    const serverUrl = getServerAddress();
    const connStr = encodeChannelConnectionString(`sk-${fullKey}`, serverUrl);
    await copyText(connStr);
  };

  /**
   * 打开外部链接（用于聊天集成）
   * @param {string} type - 链接类型
   * @param {string} url - 链接 URL
   * @param {object} record - 令牌记录
   */
  const onOpenLink = async (type, url, record) => {
    const fullKey = await fetchTokenKey(record);
    // 仅处理基本链接打开，FluentRead 和 CCSwitch 在用户详情页不支持
    let status = localStorage.getItem('status');
    let serverAddress = '';
    if (status) {
      status = JSON.parse(status);
      serverAddress = status.server_address;
    }
    if (serverAddress === '') {
      serverAddress = window.location.origin;
    }
    if (url.includes('{cherryConfig}') === true) {
      let cherryConfig = {
        id: 'new-api',
        baseUrl: serverAddress,
        apiKey: `sk-${fullKey}`,
      };
      let encodedConfig = encodeURIComponent(encodeToBase64(JSON.stringify(cherryConfig)));
      url = url.replaceAll('{cherryConfig}', encodedConfig);
    } else if (url.includes('{aionuiConfig}') === true) {
      let aionuiConfig = {
        platform: 'new-api',
        baseUrl: serverAddress,
        apiKey: `sk-${fullKey}`,
      };
      let encodedConfig = encodeURIComponent(encodeToBase64(JSON.stringify(aionuiConfig)));
      url = url.replaceAll('{aionuiConfig}', encodedConfig);
    } else {
      let encodedServerAddress = encodeURIComponent(serverAddress);
      url = url.replaceAll('{address}', encodedServerAddress);
      url = url.replaceAll('{key}', `sk-${fullKey}`);
    }
    window.open(url, '_blank');
  };

  /**
   * 管理令牌操作（删除、启用、禁用）
   * @param {number} id - 令牌 ID
   * @param {string} action - 操作类型: delete, enable, disable
   * @param {object} record - 令牌记录
   */
  const manageToken = async (id, action, record) => {
    setTokenLoading(true);
    try {
      let data = { id };
      let res;
      switch (action) {
        case 'delete':
          res = await API.delete(`/api/user/${userId}/tokens/${id}`);
          break;
        case 'enable':
          data.status = 1;
          res = await API.put(`/api/user/${userId}/tokens?status_only=true`, data);
          break;
        case 'disable':
          data.status = 2;
          res = await API.put(`/api/user/${userId}/tokens?status_only=true`, data);
          break;
      }
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('操作成功完成！'));
        let token = res.data.data;
        let newTokens = [...tokens];
        if (action !== 'delete') {
          record.status = token.status;
        }
        setTokens(newTokens);
      } else {
        showError(message);
      }
    } catch (error) {
      console.error('令牌操作失败:', error);
      showError(error.message || t('操作失败'));
    }
    setTokenLoading(false);
  };

  /**
   * 搜索令牌
   * @param {number} page - 页码
   * @param {number} size - 每页数量
   */
  const searchTokens = async (page = 1, size = tokenPageSize) => {
    const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const normalizedSize = Number.isInteger(size) && size > 0 ? size : tokenPageSize;

    const { searchKeyword, searchToken } = getTokenFormValues();
    if (searchKeyword === '' && searchToken === '') {
      setSearchMode(false);
      await loadTokens(1);
      return;
    }
    setSearching(true);
    try {
      const res = await API.get(
        `/api/user/${userId}/tokens/search?keyword=${encodeURIComponent(searchKeyword)}&token=${encodeURIComponent(searchToken)}&p=${normalizedPage}&size=${normalizedSize}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setSearchMode(true);
        syncTokenPageData(data);
      } else {
        showError(message);
      }
    } catch (error) {
      console.error('搜索令牌失败:', error);
      showError(error.message || t('搜索失败'));
    }
    setSearching(false);
  };

  /**
   * 令牌排序
   * @param {string} key - 排序字段
   */
  const sortToken = (key) => {
    if (tokens.length === 0) return;
    setTokenLoading(true);
    let sortedTokens = [...tokens];
    sortedTokens.sort((a, b) => {
      return ('' + a[key]).localeCompare(b[key]);
    });
    if (sortedTokens[0].id === tokens[0].id) {
      sortedTokens.reverse();
    }
    setTokens(sortedTokens);
    setTokenLoading(false);
  };

  /**
   * 令牌分页切换
   * @param {number} page - 页码
   */
  const handleTokenPageChange = (page) => {
    if (searchMode) {
      searchTokens(page, tokenPageSize).then();
    } else {
      loadTokens(page, tokenPageSize).then();
    }
  };

  /**
   * 令牌每页数量切换
   * @param {number} size - 每页数量
   */
  const handleTokenPageSizeChange = async (size) => {
    setTokenPageSize(size);
    if (searchMode) {
      await searchTokens(1, size);
    } else {
      await loadTokens(1, size);
    }
  };

  /**
   * 令牌行选择配置
   */
  const tokenRowSelection = {
    onSelect: (record, selected) => {},
    onSelectAll: (selected, selectedRows) => {},
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedKeys(selectedRows);
    },
  };

  /**
   * 令牌行样式处理（禁用的令牌显示不同背景）
   * @param {object} record - 令牌记录
   * @param {number} index - 行索引
   */
  const handleTokenRow = (record, index) => {
    if (record.status !== 1) {
      return {
        style: {
          background: 'var(--semi-color-disabled-border)',
        },
      };
    }
    return {};
  };

  /**
   * 批量删除令牌
   */
  const batchDeleteTokens = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请先选择要删除的令牌！'));
      return;
    }
    setTokenLoading(true);
    try {
      const ids = selectedKeys.map((token) => token.id);
      const res = await API.post(`/api/user/${userId}/tokens/batch`, { ids });
      if (res?.data?.success) {
        const count = res.data.data || 0;
        showSuccess(t('已删除 {{count}} 个令牌！', { count }));
        await refreshTokens();
        setTimeout(() => {
          if (tokens.length === 0 && tokenActivePage > 1) {
            refreshTokens(tokenActivePage - 1);
          }
        }, 100);
      } else {
        showError(res?.data?.message || t('删除失败'));
      }
    } catch (error) {
      console.error('批量删除令牌失败:', error);
      showError(error.message);
    } finally {
      setTokenLoading(false);
    }
  };

  /**
   * 批量复制令牌
   * @param {string} copyType - 复制类型: 'key' 或 'name+key'
   */
  const batchCopyTokens = async (copyType) => {
    if (selectedKeys.length === 0) {
      showError(t('请至少选择一个令牌！'));
      return;
    }
    try {
      const keys = await Promise.all(
        selectedKeys.map((token) => fetchTokenKey(token, { suppressError: true })),
      );
      let content = '';
      for (let i = 0; i < selectedKeys.length; i++) {
        const fullKey = keys[i];
        if (copyType === 'name+key') {
          content += `${selectedKeys[i].name}    sk-${fullKey}\n`;
        } else {
          content += `sk-${fullKey}\n`;
        }
      }
      await copyText(content);
    } catch (error) {
      console.error('批量复制令牌失败:', error);
      showError(error?.message || t('复制令牌失败'));
    }
  };

  // ========================================
  // 日志相关方法
  // ========================================

  /**
   * 获取日志搜索表单值
   */
  const getLogFormValues = () => {
    const formValues = logFormApi ? logFormApi.getValues() : {};

    let start_timestamp = timestamp2string(getTodayStartTimestamp());
    let end_timestamp = timestamp2string(now.getTime() / 1000 + 3600);

    if (
      formValues.dateRange &&
      Array.isArray(formValues.dateRange) &&
      formValues.dateRange.length === 2
    ) {
      start_timestamp = formValues.dateRange[0];
      end_timestamp = formValues.dateRange[1];
    }

    return {
      token_name: formValues.token_name || '',
      model_name: formValues.model_name || '',
      start_timestamp,
      end_timestamp,
      channel: formValues.channel || '',
      group: formValues.group || '',
      request_id: formValues.request_id || '',
      logType: formValues.logType ? parseInt(formValues.logType) : 0,
    };
  };

  /**
   * 初始化默认列可见性
   */
  const initDefaultColumns = () => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(defaults));
  };

  /**
   * 处理列可见性变更
   * @param {string} columnKey - 列标识
   * @param {boolean} checked - 是否可见
   */
  const handleColumnVisibilityChange = (columnKey, checked) => {
    const updatedColumns = { ...visibleColumns, [columnKey]: checked };
    setVisibleColumns(updatedColumns);
  };

  /**
   * 处理全选/取消全选
   * @param {boolean} checked - 是否全选
   */
  const handleSelectAll = (checked) => {
    const allKeys = Object.keys(COLUMN_KEYS).map((key) => COLUMN_KEYS[key]);
    const updatedColumns = {};
    allKeys.forEach((key) => {
      if (key === COLUMN_KEYS.USERNAME) {
        // 用户详情页始终隐藏用户名列
        updatedColumns[key] = false;
      } else if (
        (key === COLUMN_KEYS.CHANNEL || key === COLUMN_KEYS.RETRY) &&
        !isAdminUser
      ) {
        updatedColumns[key] = false;
      } else {
        updatedColumns[key] = checked;
      }
    });
    setVisibleColumns(updatedColumns);
  };

  /**
   * 显示用户信息弹窗（日志中点击用户名查看）
   * @param {number} uid - 用户 ID
   */
  const showUserInfoFunc = async (uid) => {
    if (!isAdminUser) return;
    try {
      const res = await API.get(`/api/user/${uid}`);
      const { success, message, data } = res.data;
      if (success) {
        setUserInfoData(data);
        setShowUserInfoModal(true);
      } else {
        showError(message);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      showError(error.message || t('获取用户信息失败'));
    }
  };

  /**
   * 打开渠道亲和性使用缓存弹窗
   * @param {object} affinity - 亲和性数据
   */
  const openChannelAffinityUsageCacheModal = (affinity) => {
    const a = affinity || {};
    setChannelAffinityUsageCacheTarget({
      rule_name: a.rule_name || a.reason || '',
      using_group: a.using_group || '',
      key_hint: a.key_hint || '',
      key_fp: a.key_fp || '',
    });
    setShowChannelAffinityUsageCacheModal(true);
  };

  /**
   * 打开参数覆盖弹窗
   * @param {object} log - 日志记录
   * @param {object} other - 日志附加信息
   */
  const openParamOverrideModal = (log, other) => {
    const lines = Array.isArray(other?.po) ? other.po.filter(Boolean) : [];
    if (lines.length === 0) return;
    setParamOverrideTarget({
      lines,
      modelName: log?.model_name || '',
      requestId: log?.request_id || '',
      requestPath: other?.request_path || '',
    });
    setShowParamOverrideModal(true);
  };

  /**
   * 格式化日志数据（与 useUsageLogsData 保持一致）
   * @param {Array} logsArr - 原始日志数组
   */
  const setLogsFormat = (logsArr) => {
    const requestConversionDisplayValue = (conversionChain) => {
      const chain = Array.isArray(conversionChain) ? conversionChain.filter(Boolean) : [];
      if (chain.length <= 1) return t('原生格式');
      return `${chain.join(' -> ')}`;
    };

    let expandDatesLocal = {};
    for (let i = 0; i < logsArr.length; i++) {
      logsArr[i].timestamp2string = timestamp2string(logsArr[i].created_at);
      logsArr[i].key = logsArr[i].id;
      let other = getLogOther(logsArr[i].other);
      let expandDataLocal = [];

      // 渠道信息（管理员可见）
      if (isAdminUser && (logsArr[i].type === 0 || logsArr[i].type === 2 || logsArr[i].type === 6)) {
        expandDataLocal.push({
          key: t('渠道信息'),
          value: `${logsArr[i].channel} - ${logsArr[i].channel_name || '[未知]'}`,
        });
      }
      // Request ID
      if (logsArr[i].request_id) {
        expandDataLocal.push({ key: t('Request ID'), value: logsArr[i].request_id });
      }
      // 语音相关
      if (other?.ws || other?.audio) {
        expandDataLocal.push({ key: t('语音输入'), value: other.audio_input });
        expandDataLocal.push({ key: t('语音输出'), value: other.audio_output });
        expandDataLocal.push({ key: t('文字输入'), value: other.text_input });
        expandDataLocal.push({ key: t('文字输出'), value: other.text_output });
      }
      // 缓存相关
      if (other?.cache_tokens > 0) {
        expandDataLocal.push({ key: t('缓存 Tokens'), value: other.cache_tokens });
      }
      if (other?.cache_creation_tokens > 0) {
        expandDataLocal.push({ key: t('缓存创建 Tokens'), value: other.cache_creation_tokens });
      }
      // 消费日志详情
      if (logsArr[i].type === 2) {
        expandDataLocal.push({
          key: t('日志详情'),
          value: other?.claude
            ? renderClaudeLogContent(
                other?.model_ratio, other.completion_ratio, other.model_price,
                other.group_ratio, other?.user_group_ratio, other.cache_ratio || 1.0,
                other.cache_creation_ratio || 1.0,
                other.cache_creation_tokens_5m || 0,
                other.cache_creation_ratio_5m || other.cache_creation_ratio || 1.0,
                other.cache_creation_tokens_1h || 0,
                other.cache_creation_ratio_1h || other.cache_creation_ratio || 1.0,
                billingDisplayMode,
              )
            : renderLogContent(
                other?.model_ratio, other.completion_ratio, other.model_price,
                other.group_ratio, other?.user_group_ratio, other.cache_ratio || 1.0,
                false, 1.0,
                other.web_search || false, other.web_search_call_count || 0,
                other.file_search || false, other.file_search_call_count || 0,
                billingDisplayMode,
              ),
        });
        if (logsArr[i]?.content) {
          expandDataLocal.push({ key: t('其他详情'), value: logsArr[i].content });
        }
        if (isAdminUser && other?.reject_reason) {
          expandDataLocal.push({ key: t('拦截原因'), value: other.reject_reason });
        }
      }
      // 模型映射
      if (logsArr[i].type === 2) {
        let modelMapped = other?.is_model_mapped && other?.upstream_model_name && other?.upstream_model_name !== '';
        if (modelMapped) {
          expandDataLocal.push({ key: t('请求并计费模型'), value: logsArr[i].model_name });
          expandDataLocal.push({ key: t('实际模型'), value: other.upstream_model_name });
        }

        const isViolationFeeLog =
          other?.violation_fee === true || Boolean(other?.violation_fee_code) || Boolean(other?.violation_fee_marker);

        let content = '';
        if (!isViolationFeeLog) {
          if (other?.ws || other?.audio) {
            content = renderAudioModelPrice(
              other?.text_input, other?.text_output, other?.model_ratio, other?.model_price,
              other?.completion_ratio, other?.audio_input, other?.audio_output,
              other?.audio_ratio, other?.audio_completion_ratio, other?.group_ratio,
              other?.user_group_ratio, other?.cache_tokens || 0, other?.cache_ratio || 1.0,
              billingDisplayMode,
            );
          } else if (other?.claude) {
            content = renderClaudeModelPrice(
              logsArr[i].prompt_tokens, logsArr[i].completion_tokens,
              other.model_ratio, other.model_price, other.completion_ratio,
              other.group_ratio, other?.user_group_ratio,
              other.cache_tokens || 0, other.cache_ratio || 1.0,
              other.cache_creation_tokens || 0, other.cache_creation_ratio || 1.0,
              other.cache_creation_tokens_5m || 0,
              other.cache_creation_ratio_5m || other.cache_creation_ratio || 1.0,
              other.cache_creation_tokens_1h || 0,
              other.cache_creation_ratio_1h || other.cache_creation_ratio || 1.0,
              billingDisplayMode,
            );
          } else {
            content = renderModelPrice(
              logsArr[i].prompt_tokens, logsArr[i].completion_tokens,
              other?.model_ratio, other?.model_price, other?.completion_ratio,
              other?.group_ratio, other?.user_group_ratio,
              other?.cache_tokens || 0, other?.cache_ratio || 1.0,
              other?.image || false, other?.image_ratio || 0, other?.image_output || 0,
              other?.web_search || false, other?.web_search_call_count || 0, other?.web_search_price || 0,
              other?.file_search || false, other?.file_search_call_count || 0, other?.file_search_price || 0,
              other?.audio_input_seperate_price || false, other?.audio_input_token_count || 0,
              other?.audio_input_price || 0,
              other?.image_generation_call || false, other?.image_generation_call_price || 0,
              billingDisplayMode,
            );
          }
          expandDataLocal.push({ key: t('计费过程'), value: content });
        }
        if (other?.reasoning_effort) {
          expandDataLocal.push({ key: t('Reasoning Effort'), value: other.reasoning_effort });
        }
      }
      // 退款日志
      if (logsArr[i].type === 6) {
        if (other?.task_id) {
          expandDataLocal.push({ key: t('任务ID'), value: other.task_id });
        }
        if (other?.reason) {
          expandDataLocal.push({
            key: t('失败原因'),
            value: (
              <div style={{ maxWidth: 600, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.6 }}>
                {other.reason}
              </div>
            ),
          });
        }
      }
      // 请求路径
      if (other?.request_path) {
        expandDataLocal.push({ key: t('请求路径'), value: other.request_path });
      }
      // 流状态（管理员可见）
      if (isAdminUser && other?.stream_status) {
        const ss = other.stream_status;
        const isOk = ss.status === 'ok';
        const statusLabel = isOk ? '✓ ' + t('正常') : '✗ ' + t('异常');
        let streamValue = statusLabel + ' (' + (ss.end_reason || 'unknown') + ')';
        if (ss.error_count > 0) {
          streamValue += ` [${t('软错误')}: ${ss.error_count}]`;
        }
        if (ss.end_error) {
          streamValue += ` - ${ss.end_error}`;
        }
        expandDataLocal.push({ key: t('流状态'), value: streamValue });
        if (Array.isArray(ss.errors) && ss.errors.length > 0) {
          expandDataLocal.push({
            key: t('流错误详情'),
            value: (
              <div style={{ maxWidth: 600, whiteSpace: 'pre-line', wordBreak: 'break-word', lineHeight: 1.6 }}>
                {ss.errors.join('\n')}
              </div>
            ),
          });
        }
      }
      // 参数覆盖
      if (Array.isArray(other?.po) && other.po.length > 0) {
        expandDataLocal.push({
          key: t('参数覆盖'),
          value: (
            <ParamOverrideEntry
              count={other.po.length}
              t={t}
              onOpen={(event) => {
                event.stopPropagation();
                openParamOverrideModal(logsArr[i], other);
              }}
            />
          ),
        });
      }
      // 订阅计费
      if (other?.billing_source === 'subscription') {
        const planId = other?.subscription_plan_id;
        const planTitle = other?.subscription_plan_title || '';
        const subscriptionId = other?.subscription_id;
        const unit = t('额度');
        const pre = other?.subscription_pre_consumed ?? 0;
        const postDelta = other?.subscription_post_delta ?? 0;
        const finalConsumed = other?.subscription_consumed ?? pre + postDelta;
        const remain = other?.subscription_remain;
        const total = other?.subscription_total;
        if (planId) {
          expandDataLocal.push({ key: t('订阅套餐'), value: `#${planId} ${planTitle}`.trim() });
        }
        if (subscriptionId) {
          expandDataLocal.push({ key: t('订阅实例'), value: `#${subscriptionId}` });
        }
        const settlementLines = [
          `${t('预扣')}：${pre} ${unit}`,
          `${t('结算差额')}：${postDelta > 0 ? '+' : ''}${postDelta} ${unit}`,
          `${t('最终抵扣')}：${finalConsumed} ${unit}`,
        ].filter(Boolean).join('\n');
        expandDataLocal.push({
          key: t('订阅结算'),
          value: <div style={{ whiteSpace: 'pre-line' }}>{settlementLines}</div>,
        });
        if (remain !== undefined && total !== undefined) {
          expandDataLocal.push({ key: t('订阅剩余'), value: `${remain}/${total} ${unit}` });
        }
        expandDataLocal.push({
          key: t('订阅说明'),
          value: t('token 会按倍率换算成"额度/次数"，请求结束后再做差额结算（补扣/返还）。'),
        });
      }
      // 请求转换（管理员可见）
      if (isAdminUser && logsArr[i].type !== 6) {
        expandDataLocal.push({ key: t('请求转换'), value: requestConversionDisplayValue(other?.request_conversion) });
      }
      // 计费模式（管理员可见）
      if (isAdminUser && logsArr[i].type !== 6) {
        let localCountMode = '';
        if (other?.admin_info?.local_count_tokens) {
          localCountMode = t('本地计费');
        } else {
          localCountMode = t('上游返回');
        }
        expandDataLocal.push({ key: t('计费模式'), value: localCountMode });
      }
      expandDatesLocal[logsArr[i].key] = expandDataLocal;
    }

    setExpandData(expandDatesLocal);
    setLogs(logsArr);
  };

  /**
   * 获取日志统计信息
   */
  const getLogStat = async () => {
    const {
      token_name, model_name, start_timestamp, end_timestamp,
      channel, group, logType: formLogType,
    } = getLogFormValues();
    const currentLogType = formLogType !== undefined ? formLogType : logType;
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;

    // 管理员查看特定用户的统计，使用管理员 API
    let url = `/api/log/stat?type=${currentLogType}&username=${user?.username || ''}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}&group=${group}`;
    url = encodeURI(url);
    try {
      let res = await API.get(url);
      const { success, message, data } = res.data;
      if (success) {
        setStat(data);
      } else {
        showError(message);
      }
    } catch (error) {
      console.error('获取日志统计失败:', error);
    }
  };

  /**
   * 处理统计信息点击（眼睛图标点击事件）
   */
  const handleEyeClick = async () => {
    if (loadingStat) return;
    setLoadingStat(true);
    await getLogStat();
    setShowStat(true);
    setLoadingStat(false);
  };

  /**
   * 加载用户的日志列表
   * @param {number} startIdx - 页码
   * @param {number} pageSizeArg - 每页数量
   * @param {number|null} customLogType - 自定义日志类型
   */
  const loadLogs = async (startIdx, pageSizeArg, customLogType = null) => {
    setLogLoading(true);

    const {
      token_name, model_name, start_timestamp, end_timestamp,
      channel, group, request_id, logType: formLogType,
    } = getLogFormValues();

    const currentLogType =
      customLogType !== null
        ? customLogType
        : formLogType !== undefined
          ? formLogType
          : logType;

    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;

    // 使用管理员的用户日志 API
    let url = `/api/user/${userId}/logs?p=${startIdx}&page_size=${pageSizeArg}&type=${currentLogType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}&group=${group}&request_id=${request_id}`;
    url = encodeURI(url);

    try {
      const res = await API.get(url);
      const { success, message, data } = res.data;
      if (success) {
        const newPageData = data.items;
        setLogActivePage(data.page);
        setLogPageSize(data.page_size);
        setLogCount(data.total);
        setLogsFormat(newPageData);
      } else {
        showError(message);
      }
    } catch (error) {
      console.error('加载日志失败:', error);
      showError(error.message || t('加载日志失败'));
    }
    setLogLoading(false);
  };

  /**
   * 日志分页切换
   * @param {number} page - 页码
   */
  const handleLogPageChange = (page) => {
    setLogActivePage(page);
    loadLogs(page, logPageSize).then();
  };

  /**
   * 日志每页数量切换
   * @param {number} size - 每页数量
   */
  const handleLogPageSizeChange = async (size) => {
    setLogPageSize(size);
    setLogActivePage(1);
    loadLogs(1, size).then().catch((reason) => {
      showError(reason);
    });
  };

  /**
   * 刷新日志数据
   */
  const refreshLogs = async () => {
    setLogActivePage(1);
    handleEyeClick();
    await loadLogs(1, logPageSize);
  };

  /**
   * 日志复制文本函数（与 useUsageLogsData 接口一致）
   * @param {Event} e - 事件对象
   * @param {string} text - 要复制的文本
   */
  const logCopyText = async (e, text) => {
    e.stopPropagation();
    if (await copy(text)) {
      showSuccess('已复制：' + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  /**
   * 检查是否有可展开的行
   */
  const hasExpandableRows = () => {
    return logs.some((log) => expandData[log.key] && expandData[log.key].length > 0);
  };

  // ========================================
  // 副作用
  // ========================================

  // 持久化列可见性配置
  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  // 持久化计费显示模式
  useEffect(() => {
    localStorage.setItem(BILLING_DISPLAY_MODE_STORAGE_KEY, billingDisplayMode);
  }, [billingDisplayMode]);

  // 初始化加载用户信息
  useEffect(() => {
    if (userId) {
      refreshUser();
    }
  }, [userId]);

  // 当切换到令牌标签时加载令牌数据
  useEffect(() => {
    if (userId && activeTab === 'tokens') {
      loadTokens(1).catch((reason) => {
        console.error('加载令牌失败:', reason);
        showError(reason);
      });
    }
  }, [userId, activeTab]);

  // 当切换到日志标签时加载日志数据
  useEffect(() => {
    if (userId && activeTab === 'logs') {
      const localPageSize = parseInt(localStorage.getItem('page-size')) || ITEMS_PER_PAGE;
      setLogPageSize(localPageSize);
      loadLogs(1, localPageSize).catch((reason) => {
        console.error('加载日志失败:', reason);
        showError(reason);
      });
    }
  }, [userId, activeTab]);

  // 日志统计初始化（当日志表单 API 可用时）
  useEffect(() => {
    if (logFormApi && activeTab === 'logs') {
      handleEyeClick();
    }
  }, [logFormApi, activeTab]);

  // ========================================
  // 返回值
  // ========================================
  return {
    // 用户信息
    user,
    userLoading,
    refreshUser,

    // 用户编辑弹窗
    showEditUser,
    setShowEditUser,
    editingUser,
    setEditingUser,

    // 用户操作弹窗
    showPromoteModal,
    setShowPromoteModal,
    showDemoteModal,
    setShowDemoteModal,
    showEnableDisableModal,
    setShowEnableDisableModal,
    enableDisableAction,
    setEnableDisableAction,

    // 用户管理操作
    manageUser,

    // 令牌数据（与 TokensTable 组件接口兼容）
    tokensData: {
      tokens,
      loading: tokenLoading,
      activePage: tokenActivePage,
      tokenCount,
      pageSize: tokenPageSize,
      searching,
      selectedKeys,
      setSelectedKeys,
      showEdit,
      setShowEdit,
      editingToken,
      setEditingToken,
      closeEdit,
      compactMode,
      setCompactMode,
      showKeys,
      setShowKeys,
      resolvedTokenKeys,
      loadingTokenKeys,
      formApi: tokenFormApi,
      setFormApi: setTokenFormApi,
      formInitValues: tokenFormInitValues,
      getFormValues: getTokenFormValues,
      loadTokens,
      refresh: refreshTokens,
      copyText,
      fetchTokenKey,
      toggleTokenVisibility,
      copyTokenKey,
      copyTokenConnectionString,
      onOpenLink,
      manageToken,
      searchTokens,
      sortToken,
      handlePageChange: handleTokenPageChange,
      handlePageSizeChange: handleTokenPageSizeChange,
      rowSelection: tokenRowSelection,
      handleRow: handleTokenRow,
      batchDeleteTokens,
      batchCopyTokens,
      syncPageData: syncTokenPageData,
      t,
    },

    // 日志数据（与 UsageLogsTable 组件接口兼容）
    logsData: {
      logs,
      expandData,
      showStat,
      loading: logLoading,
      loadingStat,
      activePage: logActivePage,
      logCount,
      pageSize: logPageSize,
      logType,
      stat,
      isAdminUser,
      formApi: logFormApi,
      setFormApi: setLogFormApi,
      formInitValues: logFormInitValues,
      getFormValues: getLogFormValues,
      visibleColumns,
      showColumnSelector,
      setShowColumnSelector,
      billingDisplayMode,
      setBillingDisplayMode,
      handleColumnVisibilityChange,
      handleSelectAll,
      initDefaultColumns,
      COLUMN_KEYS,
      compactMode: logCompactMode,
      setCompactMode: setLogCompactMode,
      showUserInfo,
      setShowUserInfoModal,
      userInfoData,
      showUserInfoFunc,
      showChannelAffinityUsageCacheModal,
      setShowChannelAffinityUsageCacheModal,
      channelAffinityUsageCacheTarget,
      openChannelAffinityUsageCacheModal,
      showParamOverrideModal,
      setShowParamOverrideModal,
      paramOverrideTarget,
      loadLogs,
      handlePageChange: handleLogPageChange,
      handlePageSizeChange: handleLogPageSizeChange,
      refresh: refreshLogs,
      copyText: logCopyText,
      handleEyeClick,
      setLogsFormat,
      hasExpandableRows,
      setLogType,
      openParamOverrideModal,
      t,
    },

    // 标签页状态
    activeTab,
    setActiveTab,

    // 国际化
    t,
  };
};
