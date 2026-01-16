
import React from 'react';
import Logo from './Logo';

interface HeaderProps {
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="bg-black/80 backdrop-blur-md text-white border-b border-[#2f3336] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <Logo className="h-9 w-9 text-blue-400" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-black tracking-tighter leading-none">
                DRONE<span className="text-blue-500">GUARD</span>
              </h1>
              <p className="text-[9px] text-zinc-500 font-bold tracking-[0.2em] uppercase">Security & Inspection</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <nav className="flex space-x-6">
              <a href="#" className="text-xs font-black uppercase tracking-widest text-white transition-opacity hover:opacity-70">Monitor</a>
              <a href="#" className="text-xs font-black uppercase tracking-widest text-zinc-500 transition-opacity hover:text-white">Relatórios</a>
            </nav>
            <button 
              onClick={onOpenSettings}
              className="p-2 rounded-full bg-zinc-900 border border-[#2f3336] text-zinc-400 hover:text-white transition-all hover:scale-110 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
