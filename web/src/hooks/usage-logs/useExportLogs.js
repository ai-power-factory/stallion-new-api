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
 * 使用日志导出 Hook
 * 提供导出状态管理和导出操作函数，支持 CSV 和 Excel 两种格式
 */
import { useState } from 'react';
import { API, showError, showSuccess } from '@/helpers';
import {
  logsToExportRows,
  exportToCSV,
  exportToXLSX,
} from '@/helpers/export';

/**
 * 日志导出 Hook
 * @param {Object} params
 * @param {Function} params.getFormValues - 获取当前筛选表单值的函数
 * @param {boolean} params.isAdminUser - 是否为管理员
 * @param {Function} params.t - i18n 翻译函数
 * @returns {{ exporting: boolean, handleExport: Function }}
 */
export const useExportLogs = ({ getFormValues, isAdminUser, t }) => {
  // 导出中的 loading 状态
  const [exporting, setExporting] = useState(false);

  /**
   * 从导出专用接口获取所有匹配的日志数据
   * 该接口支持最多 10000 条记录，不受常规分页 100 条限制
   * @returns {Promise<Array>} 日志记录数组
   */
  const fetchExportLogs = async () => {
    const {
      username,
      token_name,
      model_name,
      start_timestamp,
      end_timestamp,
      channel,
      group,
      request_id,
      logType,
    } = getFormValues();

    const localStartTimestamp = Date.parse(start_timestamp) / 1000;
    const localEndTimestamp = Date.parse(end_timestamp) / 1000;

    // 根据用户角色调用不同的导出接口
    let url;
    if (isAdminUser) {
      url = `/api/log/export?p=1&page_size=10000&type=${logType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}&group=${group}&request_id=${request_id}`;
    } else {
      url = `/api/log/self/export?p=1&page_size=10000&type=${logType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&group=${group}&request_id=${request_id}`;
    }
    url = encodeURI(url);

    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (!success) {
      throw new Error(message);
    }
    return data.items;
  };

  /**
   * 执行导出操作
   * 获取数据后在浏览器端生成文件并触发下载
   * @param {'csv'|'xlsx'} format - 导出格式
   */
  const handleExport = async (format = 'xlsx') => {
    // 防止重复点击
    if (exporting) return;
    setExporting(true);

    try {
      const logs = await fetchExportLogs();

      // 空数据检查
      if (!logs || logs.length === 0) {
        showError(t('没有可导出的数据'));
        return;
      }

      // 将原始日志转换为扁平行对象
      const rows = logsToExportRows(logs, isAdminUser, t);

      // 生成带日期的文件名
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `usage-logs-${timestamp}`;

      // 根据格式调用对应的导出函数
      if (format === 'csv') {
        exportToCSV(rows, `${filename}.csv`);
      } else {
        exportToXLSX(rows, `${filename}.xlsx`);
      }

      showSuccess(t('导出成功') + ` (${logs.length} ${t('条记录')})`);
    } catch (err) {
      console.error('Export logs failed:', err);
      showError(err.message || t('导出日志失败'));
    } finally {
      setExporting(false);
    }
  };

  return { exporting, handleExport };
};
