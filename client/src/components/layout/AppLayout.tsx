import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { NavigationKey, SystemHealth } from '../../types';

interface AppLayoutProps {
  children: React.ReactNode;
  currentNav: NavigationKey;
  onNavigate: (key: NavigationKey) => void;
  systemHealth?: SystemHealth;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentNav,
  onNavigate,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="flex-1 flex relative">
        {/* Collapsible Dark Sidebar */}
        <Sidebar
          currentNav={currentNav}
          onNavigate={onNavigate}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
        />

        {/* Main Content Area */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
            isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
          }`}
        >
          {/* Top Navbar */}
          <Navbar
            currentNav={currentNav}
            onOpenMobile={() => setIsMobileOpen(true)}
          />

          {/* Main View Container */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
