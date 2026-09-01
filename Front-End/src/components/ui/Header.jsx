import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './AppIcon';

const Header = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    { label: 'Dashboard', path: '/main-dashboard', icon: 'LayoutDashboard', tooltip: 'Manage your coastal analysis projects' },
    { label: 'Analysis', path: '/analysis-workspace', icon: 'Map', tooltip: 'Conduct interactive shoreline analysis' },
    { label: 'Results', path: '/results-visualization', icon: 'BarChart3', tooltip: 'Examine detailed results and statistics' }
  ];

  const isActiveTab = (path) => location?.pathname === path;

  return (
    <header className="fixed top-4 left-4 right-4 z-50 glass-panel rounded-2xl flex items-center justify-between h-16 px-6">
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg border border-blue-400/30">
          <Icon name="Waves" size={24} color="white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-300 leading-tight">
            Coastal Erosion Intelligence
          </h1>
          <span className="text-[10px] text-blue-200/70 font-mono tracking-widest uppercase">Scientific Platform</span>
        </div>
      </div>

      {/* Desktop Nav */}
      <nav className="hidden md:flex items-center space-x-2 bg-black/20 p-1 rounded-xl border border-white/5">
        {navigationItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`relative flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
            ${isActiveTab(item.path) ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
            title={item.tooltip}
          >
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        aria-label="Toggle navigation menu"
      >
        <Icon name={isMobileMenuOpen ? 'X' : 'Menu'} size={20} color="white" />
      </button>

      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-20 left-0 right-0 glass-panel rounded-2xl animate-slide-down border border-white/10 overflow-hidden">
          <nav className="px-4 py-3 space-y-1">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                ${isActiveTab(item.path) ? 'bg-blue-600/20 text-blue-300 border-l-4 border-blue-500' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
              >
                <Icon name={item.icon} size={18} />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  <span className="text-[10px] text-slate-400">{item.tooltip}</span>
                </div>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
