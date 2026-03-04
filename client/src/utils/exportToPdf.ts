import jsPDF from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';

interface SheetConfig {
  name: string;
  data: Record<string, any>[];
  columns?: { header: string; key: string; width?: number; format?: (val: any) => any }[];
}

interface PdfOptions {
  orientation?: 'portrait' | 'landscape';
  title?: string;
  subtitle?: string;
  showTimestamp?: boolean;
  headerColor?: [number, number, number];
  fontSize?: number;
}

const DEFAULT_OPTIONS: Required<PdfOptions> = {
  orientation: 'landscape',
  title: '',
  subtitle: '',
  showTimestamp: true,
  headerColor: [41, 128, 185],   // nice blue
  fontSize: 9,
};

/**
 * Export data to a styled PDF file with multiple tables (one per sheet), headers, and auto-column widths.
 */
export function exportToPdf(
  sheets: SheetConfig[],
  filename: string,
  options: PdfOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const doc = new jsPDF({ orientation: opts.orientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let isFirstTable = true;

  for (const sheet of sheets) {
    if (!sheet.data || sheet.data.length === 0) continue;

    if (!isFirstTable) {
      doc.addPage();
    }

    let startY = 15;

    // ── Document / section title ─────────────────────────────────
    if (opts.title || sheet.name) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(opts.title || sheet.name, pageWidth / 2, startY, { align: 'center' });
      startY += 8;
    }

    if (opts.subtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(opts.subtitle, pageWidth / 2, startY, { align: 'center' });
      doc.setTextColor(0);
      startY += 6;
    }

    if (opts.showTimestamp) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(130);
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, startY, { align: 'center' });
      doc.setTextColor(0);
      startY += 6;
    }

    // If there are multiple tables label each section
    if (sheets.length > 1) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(sheet.name, 14, startY);
      startY += 4;
    }

    // ── Build table data ─────────────────────────────────────────
    let headers: string[];
    let rows: any[][];

    if (sheet.columns) {
      headers = sheet.columns.map((c) => c.header);
      rows = sheet.data.map((row) =>
        sheet.columns!.map((c) => {
          const val = row[c.key];
          return c.format ? c.format(val) : val ?? '';
        })
      );
    } else {
      const keys = Array.from(new Set(sheet.data.flatMap((row) => Object.keys(row))));
      headers = keys.map((k) => formatHeader(k));
      rows = sheet.data.map((row) =>
        keys.map((k) => {
          const val = row[k];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object' && !(val instanceof Date)) return JSON.stringify(val);
          return val;
        })
      );
    }

    // ── Render table ─────────────────────────────────────────────
    const tableOptions: UserOptions = {
      startY,
      head: [headers],
      body: rows.map((row) => row.map((cell) => String(cell))),
      theme: 'grid',
      styles: {
        fontSize: opts.fontSize,
        cellPadding: 2,
        overflow: 'linebreak',
        lineColor: [220, 220, 220],
        lineWidth: 0.25,
      },
      headStyles: {
        fillColor: opts.headerColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: opts.fontSize + 1,
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      columnStyles: buildColumnStyles(sheet.columns, headers),
      margin: { left: 10, right: 10 },
      didDrawPage: (data) => {
        // Footer – page numbers
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      },
    };

    autoTable(doc, tableOptions);
    isFirstTable = false;
  }

  // ── Download ─────────────────────────────────────────────────
  const timestamp = new Date().toISOString().split('T')[0];
  doc.save(`${filename}_${timestamp}.pdf`);
}

/**
 * Quick single-table PDF export
 */
export function exportSingleSheetPdf(
  data: Record<string, any>[],
  sheetName: string,
  filename: string,
  columns?: SheetConfig['columns'],
  options?: PdfOptions
) {
  exportToPdf([{ name: sheetName, data, columns }], filename, options);
}

/* ──────────────── Helpers ──────────────── */

function formatHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Map column configs to jspdf-autotable columnStyles for alignment & width hints
 */
function buildColumnStyles(
  columns: SheetConfig['columns'],
  headers: string[]
): UserOptions['columnStyles'] {
  const styles: Record<number, { halign?: string; cellWidth?: number | 'auto' }> = {};

  if (columns) {
    columns.forEach((col, i) => {
      const isNumeric = col.header.toLowerCase().includes('$') ||
        col.header.toLowerCase().includes('amount') ||
        col.header.toLowerCase().includes('%') ||
        col.header.toLowerCase().includes('score') ||
        col.header.toLowerCase().includes('count') ||
        col.header.toLowerCase().includes('total') ||
        col.header.toLowerCase().includes('savings');
      if (isNumeric) {
        styles[i] = { halign: 'right' };
      }
    });
  } else {
    headers.forEach((h, i) => {
      const lower = h.toLowerCase();
      if (lower.includes('$') || lower.includes('amount') || lower.includes('total')) {
        styles[i] = { halign: 'right' };
      }
    });
  }

  return styles as UserOptions['columnStyles'];
}

/* ──────────────── Pre-built export configs (mirrors exportToExcel.ts) ──────────────── */

export const transactionColumns: SheetConfig['columns'] = [
  { header: 'Date', key: 'date', width: 14, format: (v) => v ? new Date(v).toLocaleDateString() : '' },
  { header: 'Type', key: 'type', width: 10 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Merchant', key: 'merchant', width: 22 },
  { header: 'Description', key: 'description', width: 30 },
  { header: 'Amount ($)', key: 'amount', width: 14, format: (v) => typeof v === 'number' ? v.toFixed(2) : v },
  { header: 'Anomaly', key: 'isAnomaly', width: 10, format: (v) => v ? 'Yes' : 'No' },
  { header: 'Anomaly Score', key: 'anomalyScore', width: 14, format: (v) => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '' },
  { header: 'Anomaly Reason', key: 'anomalyReason', width: 25 },
  { header: 'AI Category', key: 'suggestedCategory', width: 18 },
  { header: 'Source', key: 'source', width: 12 },
];

export const budgetColumns: SheetConfig['columns'] = [
  { header: 'Category', key: 'category', width: 20 },
  { header: 'Period', key: 'period', width: 12 },
  { header: 'Budget Limit ($)', key: 'limitAmount', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : v },
  { header: 'Current Spend ($)', key: 'currentSpend', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : v },
  { header: 'Remaining ($)', key: 'remainingAmount', width: 14, format: (v) => typeof v === 'number' ? v.toFixed(2) : v },
  { header: 'Utilization %', key: 'utilizationPercent', width: 14, format: (v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
  { header: 'Alert Threshold %', key: 'alertThreshold', width: 16 },
  { header: 'AI Suggested ($)', key: 'aiSuggestedLimit', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : '' },
  { header: 'Active', key: 'isActive', width: 8, format: (v) => v ? 'Yes' : 'No' },
];

export const varianceColumns: SheetConfig['columns'] = [
  { header: 'Category', key: 'category', width: 20 },
  { header: 'Budget ($)', key: 'budget', width: 14 },
  { header: 'Actual ($)', key: 'actual', width: 14 },
  { header: 'Variance ($)', key: 'variance', width: 14 },
  { header: 'Status', key: 'status', width: 14 },
];

export const recommendationColumns: SheetConfig['columns'] = [
  { header: 'Title', key: 'title', width: 25 },
  { header: 'Description', key: 'description', width: 45 },
  { header: 'Priority', key: 'priority', width: 12 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Type', key: 'type', width: 16 },
  { header: 'Potential Savings ($)', key: 'potentialSavings', width: 20, format: (v) => typeof v === 'number' ? v.toFixed(2) : '' },
  { header: 'Impact %', key: 'impact', width: 12 },
  { header: 'Status', key: 'status', width: 12 },
];

export const forecastColumns: SheetConfig['columns'] = [
  { header: 'Date', key: 'date', width: 14, format: (v) => v ? new Date(v).toLocaleDateString() : '' },
  { header: 'Predicted ($)', key: 'predicted', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : '' },
  { header: 'Lower Bound ($)', key: 'lowerBound', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : '' },
  { header: 'Upper Bound ($)', key: 'upperBound', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : '' },
];

export const anomalyColumns: SheetConfig['columns'] = [
  { header: 'Date', key: 'date', width: 14, format: (v) => v ? new Date(v).toLocaleDateString() : '' },
  { header: 'Merchant', key: 'merchant', width: 22 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Amount ($)', key: 'amount', width: 14, format: (v) => typeof v === 'number' ? v.toFixed(2) : v },
  { header: 'Anomaly Score', key: 'anomalyScore', width: 14, format: (v) => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '' },
  { header: 'Reason', key: 'anomalyReason', width: 30 },
];

export const recurringColumns: SheetConfig['columns'] = [
  { header: 'Merchant', key: '_id', width: 22 },
  { header: 'Frequency', key: 'frequency', width: 14 },
  { header: 'Occurrences', key: 'count', width: 14 },
  { header: 'Avg Amount ($)', key: 'avgAmount', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : '' },
  { header: 'Total Spent ($)', key: 'totalSpent', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : '' },
];

export const categoryBreakdownColumns: SheetConfig['columns'] = [
  { header: 'Category', key: '_id', width: 20 },
  { header: 'Total ($)', key: 'total', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : '' },
  { header: 'Count', key: 'count', width: 10 },
  { header: 'Percentage %', key: 'percentage', width: 14, format: (v) => typeof v === 'number' ? `${v.toFixed(1)}%` : '' },
];

export const trendColumns: SheetConfig['columns'] = [
  { header: 'Period', key: '_id', width: 14 },
  { header: 'Total ($)', key: 'total', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : '' },
  { header: 'Count', key: 'count', width: 10 },
  { header: 'Average ($)', key: 'avg', width: 16, format: (v) => typeof v === 'number' ? v.toFixed(2) : '' },
];
