import React from 'react';
import { Search, HelpCircle, Bell, User, Menu } from 'lucide-react';

interface HeaderProps {
  toggleSidebar: () => void;
  isSidebarCollapsed: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40">
      <div className="h-full flex items-center justify-between px-4">
        {/* Left side - Menu and Brand */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors -ml-2"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <div className="text-gray-900 font-medium">
            Budget Manager
          </div>
        </div>

        <div className="w-8 h-8 bg-primary-700 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
          PL
        </div>

        {/* Right side - Push elements to the right */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Search - 320px wide */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search..."
              className="w-80 pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Help */}
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <HelpCircle className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
          </button>

          {/* Notifications */}
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
            <Bell className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User avatar */}
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
