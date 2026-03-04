import * as XLSX from 'xlsx';

interface SheetConfig {
  name: string;
  data: Record<string, any>[];
  columns?: { header: string; key: string; width?: number; format?: (val: any) => any }[];
}

/**
 * Export data to an Excel file with multiple sheets, auto-column widths, styled headers, and proper formatting.
 */
export function exportToExcel(
  sheets: SheetConfig[],
  filename: string
) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    if (!sheet.data || sheet.data.length === 0) continue;

    let wsData: any[][];
    let colWidths: number[];

    if (sheet.columns) {
      // Build rows using column config
      const headers = sheet.columns.map((c) => c.header);
      const rows = sheet.data.map((row) =>
        sheet.columns!.map((c) => {
          const val = row[c.key];
          return c.format ? c.format(val) : val ?? '';
        })
      );
      wsData = [headers, ...rows];
      colWidths = sheet.columns.map((c) => {
        const headerLen = c.header.length;
        const maxDataLen = rows.reduce(
          (max, row) => Math.max(max, String(row[sheet.columns!.indexOf(c)] ?? '').length),
          0
        );
        return c.width || Math.min(40, Math.max(headerLen, maxDataLen) + 2);
      });
    } else {
      // Auto-detect columns from data keys
      const keys = Array.from(
        new Set(sheet.data.flatMap((row) => Object.keys(row)))
      );
      const headers = keys.map((k) => formatHeader(k));
      const rows = sheet.data.map((row) =>
        keys.map((k) => {
          const val = row[k];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object' && !(val instanceof Date)) return JSON.stringify(val);
          return val;
        })
      );
      wsData = [headers, ...rows];
      colWidths = keys.map((_k, i) => {
        const headerLen = headers[i].length;
        const maxDataLen = rows.reduce(
          (max, row) => Math.max(max, String(row[i] ?? '').length),
          0
        );
        return Math.min(40, Math.max(headerLen, maxDataLen) + 2);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = colWidths.map((w) => ({ wch: w }));

    // Freeze the header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName(sheet.name));
  }

  // Generate and download
  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`);
}

/**
 * Quick single-sheet export
 */
export function exportSingleSheet(
  data: Record<string, any>[],
  sheetName: string,
  filename: string,
  columns?: SheetConfig['columns']
) {
  exportToExcel([{ name: sheetName, data, columns }], filename);
}

/**
 * Convert camelCase / snake_case key to human-readable header
 */
function formatHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Sheet names cannot exceed 31 chars or contain special characters
 */
function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, '').slice(0, 31);
}

/* ──────────────── Pre-built export configs for each page ──────────────── */

export const transactionColumns: SheetConfig['columns'] = [
  { header: 'Date', key: 'date', width: 14, format: (v) => v ? new Date(v).toLocaleDateString() : '' },
  { header: 'Type', key: 'type', width: 10 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Merchant', key: 'merchant', width: 22 },
  { header: 'Description', key: 'description', width: 30 },
  { header: 'Amount ($)', key: 'amount', width: 14, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : v },
  { header: 'Anomaly', key: 'isAnomaly', width: 10, format: (v) => v ? 'Yes' : 'No' },
  { header: 'Anomaly Score', key: 'anomalyScore', width: 14, format: (v) => typeof v === 'number' ? Number((v * 100).toFixed(1)) : '' },
  { header: 'Anomaly Reason', key: 'anomalyReason', width: 25 },
  { header: 'AI Category', key: 'suggestedCategory', width: 18 },
  { header: 'Source', key: 'source', width: 12 },
];

export const budgetColumns: SheetConfig['columns'] = [
  { header: 'Category', key: 'category', width: 20 },
  { header: 'Period', key: 'period', width: 12 },
  { header: 'Budget Limit ($)', key: 'limitAmount', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : v },
  { header: 'Current Spend ($)', key: 'currentSpend', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : v },
  { header: 'Remaining ($)', key: 'remainingAmount', width: 14, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : v },
  { header: 'Utilization %', key: 'utilizationPercent', width: 14, format: (v) => typeof v === 'number' ? Number(v.toFixed(1)) : v },
  { header: 'Alert Threshold %', key: 'alertThreshold', width: 16 },
  { header: 'AI Suggested ($)', key: 'aiSuggestedLimit', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : '' },
  { header: 'Active', key: 'isActive', width: 8, format: (v) => v ? 'Yes' : 'No' },
];

export const varianceColumns: SheetConfig['columns'] = [
  { header: 'Category', key: 'category', width: 20 },
  { header: 'Budget ($)', key: 'budget', width: 14 },
  { header: 'Actual ($)', key: 'actual', width: 14 },
  { header: 'Variance ($)', key: 'variance', width: 14 },
  { header: 'Status', key: 'status', width: 14, format: (v) => v },
];

export const recommendationColumns: SheetConfig['columns'] = [
  { header: 'Title', key: 'title', width: 25 },
  { header: 'Description', key: 'description', width: 45 },
  { header: 'Priority', key: 'priority', width: 12 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Type', key: 'type', width: 16 },
  { header: 'Potential Savings ($)', key: 'potentialSavings', width: 20, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : '' },
  { header: 'Impact %', key: 'impact', width: 12 },
  { header: 'Status', key: 'status', width: 12 },
];

export const forecastColumns: SheetConfig['columns'] = [
  { header: 'Date', key: 'date', width: 14, format: (v) => v ? new Date(v).toLocaleDateString() : '' },
  { header: 'Predicted ($)', key: 'predicted', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : '' },
  { header: 'Lower Bound ($)', key: 'lowerBound', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : '' },
  { header: 'Upper Bound ($)', key: 'upperBound', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : '' },
];

export const anomalyColumns: SheetConfig['columns'] = [
  { header: 'Date', key: 'date', width: 14, format: (v) => v ? new Date(v).toLocaleDateString() : '' },
  { header: 'Merchant', key: 'merchant', width: 22 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Amount ($)', key: 'amount', width: 14, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : v },
  { header: 'Anomaly Score', key: 'anomalyScore', width: 14, format: (v) => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '' },
  { header: 'Reason', key: 'anomalyReason', width: 30 },
];

export const recurringColumns: SheetConfig['columns'] = [
  { header: 'Merchant', key: '_id', width: 22 },
  { header: 'Frequency', key: 'frequency', width: 14 },
  { header: 'Occurrences', key: 'count', width: 14 },
  { header: 'Avg Amount ($)', key: 'avgAmount', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : '' },
  { header: 'Total Spent ($)', key: 'totalSpent', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : '' },
];

export const categoryBreakdownColumns: SheetConfig['columns'] = [
  { header: 'Category', key: '_id', width: 20 },
  { header: 'Total ($)', key: 'total', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : '' },
  { header: 'Count', key: 'count', width: 10 },
  { header: 'Percentage %', key: 'percentage', width: 14, format: (v) => typeof v === 'number' ? Number(v.toFixed(1)) : '' },
];

export const trendColumns: SheetConfig['columns'] = [
  { header: 'Period', key: '_id', width: 14 },
  { header: 'Total ($)', key: 'total', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : '' },
  { header: 'Count', key: 'count', width: 10 },
  { header: 'Average ($)', key: 'avg', width: 16, format: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : '' },
];
