
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">DroneGuard AI</h1>
              <p className="text-xs text-slate-400 font-medium">Power Line Inspection Systems</p>
            </div>
          </div>
          <nav className="hidden md:flex space-x-8">
            <a href="#" className="text-sm font-medium hover:text-blue-400 transition-colors">Dashboard</a>
            <a href="#" className="text-sm font-medium hover:text-blue-400 transition-colors">Relatórios</a>
            <a href="#" className="text-sm font-medium hover:text-blue-400 transition-colors">Configurações</a>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
