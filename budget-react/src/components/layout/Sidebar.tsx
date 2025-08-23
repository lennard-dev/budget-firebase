import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  BarChart3,
  Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const menuItems: MenuItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transactions', icon: Receipt },
  { path: '/budget', label: 'Budget', icon: PieChart },
  { path: '/reports', label: 'Reports', icon: BarChart3 }
];

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed }) => {
  return (
    <aside className={cn(
      "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300 z-30",
      isCollapsed ? "w-16" : "w-60"
    )}>
      {/* Navigation */}
      <nav className="flex flex-col h-full pt-6">
        <div className="flex-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 h-12 relative transition-all duration-200 text-gray-700",
                "hover:bg-blue-50",
                isActive ? [
                  "bg-blue-100 text-[#1E3A8A] font-semibold",
                  "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-[#1E3A8A]"
                ] : ""
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
              {!isCollapsed && <span className="text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Settings at bottom */}
        <div className="border-t border-gray-200 py-3">
          <NavLink
            to="/settings"
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-6 h-12 relative transition-all duration-200 text-gray-700",
              "hover:bg-blue-50",
              isActive ? [
                "bg-blue-100 text-[#1E3A8A] font-semibold",
                "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-[#1E3A8A]"
              ] : ""
            )}
          >
            <Settings className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
            {!isCollapsed && <span className="text-sm">Settings</span>}
          </NavLink>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;