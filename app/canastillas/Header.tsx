
import React from 'react';
import { Package } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-50">
      <div className="container mx-auto flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg text-white">
          <Package size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">CrateFlow</h1>
          <p className="text-xs text-slate-500 font-medium">Gestión de Canastillas</p>
        </div>
      </div>
    </header>
  );
};
