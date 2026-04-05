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
 * 使用日志导出工具模块
 * 支持将日志数据导出为 CSV 和 Excel (XLSX) 格式
 */
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { renderQuota, timestamp2string, getLogOther } from '@/helpers';

/**
 * 将日志类型数字映射为可读的文本标签
 * @param {number} type - 日志类型编号
 * @param {Function} t - i18n 翻译函数
 * @returns {string} 类型文本
 */
function getLogTypeLabel(type, t) {
  const map = {
    1: t('充值'),
    2: t('消费'),
    3: t('管理'),
    4: t('系统'),
    5: t('错误'),
    6: t('退款'),
  };
  return map[type] || t('未知');
}

/**
 * 将原始日志记录数组转换为导出用的扁平行对象数组
 * 管理员和普通用户的导出列有所不同
 * @param {Array} logs - 从 API 获取的原始日志记录
 * @param {boolean} isAdmin - 是否为管理员（决定是否包含渠道、用户名等额外列）
 * @param {Function} t - i18n 翻译函数
 * @returns {Array} 包含扁平对象的数组，每个对象的 key 为列标题
 */
export function logsToExportRows(logs, isAdmin, t) {
  return logs.map((log) => {
    const other = getLogOther(log.other);

    // 基础列 — 所有用户可见
    const row = {};

    row[t('时间')] = timestamp2string(log.created_at);
    row[t('类型')] = getLogTypeLabel(log.type, t);

    // 管理员额外列（放在类型之后，模型之前，便于阅读）
    if (isAdmin) {
      row[t('渠道ID')] = log.channel || '';
      row[t('渠道名称')] = log.channel_name || '';
      row[t('用户名')] = log.username || '';
    }

    row[t('令牌')] = log.token_name || '';
    row[t('分组')] = log.group || '';
    row[t('模型')] = log.model_name || '';
    row[t('输入Tokens')] = log.prompt_tokens || 0;
    row[t('输出Tokens')] = log.completion_tokens || 0;
    row[t('花费')] = renderQuota(log.quota, 6);
    row[t('用时(秒)')] = log.use_time || 0;
    row[t('流式')] = log.is_stream ? t('是') : t('否');
    row[t('IP')] = log.ip || '';
    row['Request ID'] = log.request_id || '';

    // 缓存 Tokens 信息（如果有）
    if (other?.cache_tokens > 0) {
      row[t('缓存 Tokens')] = other.cache_tokens;
    }

    row[t('详情')] = log.content || '';

    return row;
  });
}

/**
 * 将行数据导出为 CSV 文件
 * 添加 BOM 前缀以确保 Excel 正确识别 UTF-8 编码
 * @param {Array} rows - logsToExportRows 返回的行对象数组
 * @param {string} filename - 下载的文件名（含 .csv 后缀）
 */
export function exportToCSV(rows, filename = 'usage-logs.csv') {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  // 添加 UTF-8 BOM 前缀，确保 Windows Excel 正确识别中文编码
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8',
  });
  saveAs(blob, filename);
}

/**
 * 将行数据导出为 Excel (XLSX) 文件
 * @param {Array} rows - logsToExportRows 返回的行对象数组
 * @param {string} filename - 下载的文件名（含 .xlsx 后缀）
 */
export function exportToXLSX(rows, filename = 'usage-logs.xlsx') {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Usage Logs');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, filename);
}
