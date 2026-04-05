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
 * 用户详情页面
 *
 * 管理员查看和管理单个用户的详细信息，包括：
 * - 用户基本信息展示（基本信息、额度信息、绑定状态）
 * - 用户管理操作（编辑、启用/禁用、提升/降级）
 * - 令牌管理（列表、搜索、添加、编辑、删除）
 * - 使用日志查看（带筛选、统计和分页）
 */

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Breadcrumb,
  Card,
  Tag,
  Tabs,
  TabPane,
  Button,
  Space,
  Spin,
  Typography,
  Descriptions,
} from '@douyinfe/semi-ui';
import { IconArrowLeft } from '@douyinfe/semi-icons';

// 辅助函数
import { renderQuota, renderGroup, renderNumber } from '../../helpers';
import { useUserDetail } from '../../hooks/users/useUserDetail';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../helpers/utils';

// 令牌组件
import TokensTable from '../../components/table/tokens/TokensTable';
import TokensActions from '../../components/table/tokens/TokensActions';
import TokensFilters from '../../components/table/tokens/TokensFilters';
import TokensDescription from '../../components/table/tokens/TokensDescription';
import EditTokenModal from '../../components/table/tokens/modals/EditTokenModal';
import CardPro from '../../components/common/ui/CardPro';

// 日志组件
import LogsTable from '../../components/table/usage-logs/UsageLogsTable';
import LogsActions from '../../components/table/usage-logs/UsageLogsActions';
import LogsFilters from '../../components/table/usage-logs/UsageLogsFilters';
import ColumnSelectorModal from '../../components/table/usage-logs/modals/ColumnSelectorModal';
import UserInfoModal from '../../components/table/usage-logs/modals/UserInfoModal';
import ChannelAffinityUsageCacheModal from '../../components/table/usage-logs/modals/ChannelAffinityUsageCacheModal';
import ParamOverrideModal from '../../components/table/usage-logs/modals/ParamOverrideModal';

// 用户管理弹窗
import EditUserModal from '../../components/table/users/modals/EditUserModal';
import PromoteUserModal from '../../components/table/users/modals/PromoteUserModal';
import DemoteUserModal from '../../components/table/users/modals/DemoteUserModal';
import EnableDisableUserModal from '../../components/table/users/modals/EnableDisableUserModal';

const { Text, Title } = Typography;
const sectionTitleClassName = 'mb-6 mb-24';

/**
 * 渲染用户角色标签
 * @param {number} role - 角色值
 * @param {Function} t - 翻译函数
 * @returns {JSX.Element} 角色标签
 */
const renderRoleTag = (role, t) => {
  const roleMap = {
    1: { text: t('普通用户'), color: 'blue' },
    10: { text: t('管理员'), color: 'yellow' },
    100: { text: t('超级管理员'), color: 'orange' },
  };
  const info = roleMap[role] || { text: t('未知角色'), color: 'grey' };
  return <Tag color={info.color}>{info.text}</Tag>;
};

/**
 * 渲染用户状态标签
 * @param {number} status - 状态值
 * @param {Function} t - 翻译函数
 * @returns {JSX.Element} 状态标签
 */
const renderStatusTag = (status, t) => {
  if (status === 1) {
    return <Tag color='green'>{t('已启用')}</Tag>;
  }
  return <Tag color='red'>{t('已禁用')}</Tag>;
};

/**
 * 渲染绑定状态标签
 * @param {*} value - 绑定 ID 值
 * @param {Function} t - 翻译函数
 * @returns {JSX.Element} 绑定状态标签
 */
const renderBindingTag = (value, t) => {
  if (value && value !== '' && value !== '0' && value !== 0) {
    return <Tag color='green' size='small'>{t('已绑定')}</Tag>;
  }
  return <Tag color='grey' size='small'>{t('未绑定')}</Tag>;
};

/**
 * 用户详情页面组件
 */
const UserDetail = () => {
  const { id: userId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // 获取用户详情 Hook 的全部数据和方法
  const {
    user,
    userLoading,
    refreshUser,
    showEditUser,
    setShowEditUser,
    editingUser,
    setEditingUser,
    showPromoteModal,
    setShowPromoteModal,
    showDemoteModal,
    setShowDemoteModal,
    showEnableDisableModal,
    setShowEnableDisableModal,
    enableDisableAction,
    setEnableDisableAction,
    manageUser,
    tokensData,
    logsData,
    activeTab,
    setActiveTab,
  } = useUserDetail(userId);

  // ========================
  // 用户操作处理函数
  // ========================

  /**
   * 打开编辑用户弹窗
   */
  const handleEdit = () => {
    setEditingUser({ id: userId });
    setShowEditUser(true);
  };

  /**
   * 关闭编辑用户弹窗
   */
  const handleCloseEditUser = () => {
    setShowEditUser(false);
    setEditingUser({ id: undefined });
  };

  /**
   * 打开启用/禁用确认弹窗
   */
  const handleToggleStatus = () => {
    const action = user?.status === 1 ? 'disable' : 'enable';
    setEnableDisableAction(action);
    setShowEnableDisableModal(true);
  };

  /**
   * 确认启用/禁用操作
   */
  const handleConfirmEnableDisable = async () => {
    await manageUser(enableDisableAction);
    setShowEnableDisableModal(false);
  };

  /**
   * 打开提升确认弹窗
   */
  const handlePromote = () => {
    setShowPromoteModal(true);
  };

  /**
   * 确认提升操作
   */
  const handleConfirmPromote = async () => {
    await manageUser('promote');
    setShowPromoteModal(false);
  };

  /**
   * 打开降级确认弹窗
   */
  const handleDemote = () => {
    setShowDemoteModal(true);
  };

  /**
   * 确认降级操作
   */
  const handleConfirmDemote = async () => {
    await manageUser('demote');
    setShowDemoteModal(false);
  };

  // ========================
  // 用户信息卡片数据
  // ========================

  /**
   * 构造基本信息描述数据
   */
  const basicInfoData = useMemo(() => {
    if (!user) return [];
    return [
      { key: t('用户名'), value: user.username || '-' },
      { key: t('显示名称'), value: user.display_name || '-' },
      { key: t('邮箱'), value: user.email || '-' },
      { key: t('角色'), value: renderRoleTag(user.role, t) },
      { key: t('状态'), value: renderStatusTag(user.status, t) },
      { key: t('分组'), value: user.group ? renderGroup(user.group) : '-' },
      { key: t('备注'), value: user.remark || '-' },
    ];
  }, [user, t]);

  /**
   * 构造额度信息描述数据
   */
  const quotaInfoData = useMemo(() => {
    if (!user) return [];
    return [
      { key: t('总额度'), value: renderQuota((user.quota || 0) + (user.used_quota || 0)) },
      { key: t('已用额度'), value: renderQuota(user.used_quota || 0) },
      { key: t('剩余额度'), value: renderQuota(user.quota || 0) },
      { key: t('请求次数'), value: renderNumber(user.request_count || 0) },
    ];
  }, [user, t]);

  /**
   * 构造绑定状态描述数据
   */
  const bindingInfoData = useMemo(() => {
    if (!user) return [];
    return [
      { key: 'GitHub', value: renderBindingTag(user.github_id, t) },
      { key: 'Discord', value: renderBindingTag(user.discord_id, t) },
      { key: 'OIDC', value: renderBindingTag(user.oidc_id, t) },
      { key: t('微信'), value: renderBindingTag(user.wechat_id, t) },
      { key: 'Telegram', value: renderBindingTag(user.telegram_id, t) },
      { key: 'Linux DO', value: renderBindingTag(user.linux_do_id, t) },
    ];
  }, [user, t]);

  // ========================
  // 渲染
  // ========================

  // 加载状态
  if (userLoading && !user) {
    return (
      <div className='flex justify-center items-center py-20'>
        <Spin size='large' tip={t('加载中...')} />
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* 面包屑导航 */}
      <div className='flex items-center gap-3'>
        <Button
          icon={<IconArrowLeft />}
          theme='borderless'
          onClick={() => navigate('/console/user')}
        />
        <Breadcrumb>
          <Breadcrumb.Item href='/console/user'>{t('用户管理')}</Breadcrumb.Item>
          <Breadcrumb.Item>{user?.username || t('用户详情')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      {/* 用户信息卡片 */}
      <Card className='!rounded-2xl'>
        <Spin spinning={userLoading}>
          <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
            {/* 第一列：基本信息 */}
            <div>
              <Title heading={6} className={sectionTitleClassName}>
                {t('基本信息')}
              </Title>
              <Descriptions
                data={basicInfoData}
                column={1}
                size='small'
              />
            </div>

            {/* 第二列：额度信息 */}
            <div>
              <Title heading={6} className={sectionTitleClassName}>
                {t('额度信息')}
              </Title>
              <Descriptions
                data={quotaInfoData}
                column={1}
                size='small'
              />
            </div>

            {/* 第三列：绑定状态 */}
            <div>
              <Title heading={6} className={sectionTitleClassName}>
                {t('绑定状态')}
              </Title>
              <Descriptions
                data={bindingInfoData}
                column={1}
                size='small'
              />
            </div>
          </div>
        </Spin>

        {/* 操作按钮 */}
        {user && (
          <div className='mt-4 pt-4' style={{ borderTop: '1px solid var(--semi-color-border)' }}>
            <Space wrap>
              <Button
                theme='solid'
                onClick={handleEdit}
              >
                {t('编辑')}
              </Button>
              <Button
                type={user.status === 1 ? 'danger' : 'primary'}
                onClick={handleToggleStatus}
              >
                {user.status === 1 ? t('禁用') : t('启用')}
              </Button>
              <Button
                type='warning'
                onClick={handlePromote}
              >
                {t('提升')}
              </Button>
              <Button
                type='tertiary'
                onClick={handleDemote}
              >
                {t('降级')}
              </Button>
            </Space>
          </div>
        )}
      </Card>

      {/* 标签页：令牌管理和使用日志 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type='line'
      >
        {/* 令牌管理标签页 */}
        <TabPane tab={t('令牌管理')} itemKey='tokens'>
          {/* 令牌编辑弹窗 */}
          <EditTokenModal
            refresh={tokensData.refresh}
            editingToken={tokensData.editingToken}
            visiable={tokensData.showEdit}
            handleClose={tokensData.closeEdit}
            apiBasePath={`/api/user/${userId}/tokens`}
            groupsApiPath={`/api/user/${userId}/groups`}
          />

          {/* 令牌列表卡片 */}
          <CardPro
            type='type1'
            descriptionArea={
              <TokensDescription
                compactMode={tokensData.compactMode}
                setCompactMode={tokensData.setCompactMode}
                t={t}
              />
            }
            actionsArea={
              <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
                <TokensActions
                  selectedKeys={tokensData.selectedKeys}
                  setEditingToken={tokensData.setEditingToken}
                  setShowEdit={tokensData.setShowEdit}
                  batchCopyTokens={tokensData.batchCopyTokens}
                  batchDeleteTokens={tokensData.batchDeleteTokens}
                  t={t}
                />
                <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
                  <TokensFilters
                    formInitValues={tokensData.formInitValues}
                    setFormApi={tokensData.setFormApi}
                    searchTokens={tokensData.searchTokens}
                    loading={tokensData.loading}
                    searching={tokensData.searching}
                    t={t}
                  />
                </div>
              </div>
            }
            paginationArea={createCardProPagination({
              currentPage: tokensData.activePage,
              pageSize: tokensData.pageSize,
              total: tokensData.tokenCount,
              onPageChange: tokensData.handlePageChange,
              onPageSizeChange: tokensData.handlePageSizeChange,
              isMobile: isMobile,
              t: t,
            })}
            t={t}
          >
            <TokensTable {...tokensData} />
          </CardPro>
        </TabPane>

        {/* 使用日志标签页 */}
        <TabPane tab={t('使用日志')} itemKey='logs'>
          {/* 日志相关弹窗 */}
          <ColumnSelectorModal {...logsData} />
          <UserInfoModal {...logsData} />
          <ChannelAffinityUsageCacheModal {...logsData} />
          <ParamOverrideModal {...logsData} />

          {/* 日志列表卡片 */}
          <CardPro
            type='type2'
            statsArea={<LogsActions {...logsData} />}
            searchArea={<LogsFilters {...logsData} />}
            paginationArea={createCardProPagination({
              currentPage: logsData.activePage,
              pageSize: logsData.pageSize,
              total: logsData.logCount,
              onPageChange: logsData.handlePageChange,
              onPageSizeChange: logsData.handlePageSizeChange,
              isMobile: isMobile,
              t: t,
            })}
            t={t}
          >
            <LogsTable {...logsData} />
          </CardPro>
        </TabPane>
      </Tabs>

      {/* 用户管理弹窗 */}
      <EditUserModal
        visible={showEditUser}
        editingUser={editingUser}
        handleClose={handleCloseEditUser}
        refresh={() => {
          refreshUser();
        }}
      />

      <PromoteUserModal
        visible={showPromoteModal}
        onCancel={() => setShowPromoteModal(false)}
        onConfirm={handleConfirmPromote}
        user={user}
        t={t}
      />

      <DemoteUserModal
        visible={showDemoteModal}
        onCancel={() => setShowDemoteModal(false)}
        onConfirm={handleConfirmDemote}
        user={user}
        t={t}
      />

      <EnableDisableUserModal
        visible={showEnableDisableModal}
        onCancel={() => setShowEnableDisableModal(false)}
        onConfirm={handleConfirmEnableDisable}
        user={user}
        action={enableDisableAction}
        t={t}
      />
    </div>
  );
};

export default UserDetail;
