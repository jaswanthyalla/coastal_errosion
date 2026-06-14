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
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
            <Icon name="Waves" size={24} color="white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-foreground leading-tight">Coastal Erosion Analysis</h1>
            <span className="text-xs text-muted-foreground font-mono">Scientific Analysis Platform</span>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-1">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-smooth hover:bg-muted/50
              ${isActiveTab(item.path) ? 'text-primary bg-primary/5 border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title={item.tooltip}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Mobile Menu */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-md hover:bg-muted/50 transition-smooth"
          aria-label="Toggle navigation menu"
        >
          <Icon name={isMobileMenuOpen ? 'X' : 'Menu'} size={20} />
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-card border-b border-border shadow-prominent animate-slide-down">
          <nav className="px-6 py-4 space-y-2">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-md text-sm font-medium transition-smooth hover:bg-muted/50
                ${isActiveTab(item.path) ? 'text-primary bg-primary/5 border-l-4 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon name={item.icon} size={18} />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.tooltip}</span>
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
