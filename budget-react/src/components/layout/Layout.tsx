import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { cn } from '../../lib/utils';

const Layout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header toggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />
      <Sidebar isCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />
      
      {/* Main content area - full width with consistent gutters */}
      <div className={cn(
        "fixed top-16 bottom-0 right-0 transition-all duration-300 overflow-auto",
        isSidebarCollapsed ? "left-16" : "left-60"
      )}>
        <main className="min-h-full w-full px-6 pt-3 pb-8">
          <div className="max-w-[2200px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
