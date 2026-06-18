import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, totalItems }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-white">
      <p className="text-sm text-slate-500">
        {totalItems !== undefined ? `Showing page ${currentPage} of ${totalPages} (${totalItems} items)` : `Page ${currentPage} of ${totalPages}`}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors font-medium text-slate-700"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <button 
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors font-medium text-slate-700"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
