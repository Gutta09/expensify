import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';

interface ExportDropdownProps {
  onExportExcel: () => void;
  onExportPdf: () => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}

export default function ExportDropdown({
  onExportExcel,
  onExportPdf,
  disabled = false,
  label = 'Export',
  size = 'md',
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const sizeClasses = size === 'sm' ? 'text-sm' : '';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className={`btn-secondary flex items-center gap-2 disabled:opacity-50 ${sizeClasses}`}
      >
        <Download className="w-4 h-4" />
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            onClick={() => { onExportExcel(); setOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export as Excel
          </button>
          <div className="border-t border-neutral-100 dark:border-neutral-700" />
          <button
            onClick={() => { onExportPdf(); setOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
          >
            <FileText className="w-4 h-4 text-red-500" />
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}
