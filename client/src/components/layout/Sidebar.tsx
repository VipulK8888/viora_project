import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Users,
  Package,
  CreditCard,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  BellRing,
} from 'lucide-react';
import { NavigationKey } from '../../types';

interface SidebarProps {
  currentNav: NavigationKey;
  onNavigate: (key: NavigationKey) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  key: NavigationKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'reminders', label: 'Automated Reminders', icon: BellRing },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'products', label: 'Products & Services', icon: Package },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'reports', label: 'Sales Reports', icon: BarChart3 },
  { key: 'settings', label: 'Business Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentNav,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close mobile navigation overlay"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity cursor-default border-0 p-0 w-full h-full text-left"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0B0C0E] border-r border-white/[0.08] transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Logo Badge (Clean squircle cat emblem - no outer white border) */}
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105">
              <img
                src="/brand-logo.png"
                alt="billv emblem"
                width="40"
                height="40"
                loading="eager"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Brand Title: billv */}
            {!isCollapsed && (
              <div className="flex items-center overflow-hidden">
                <img
                  src="/billv-name.jpg"
                  alt="billv"
                  width="130"
                  height="32"
                  loading="eager"
                  className="h-8 w-auto max-w-[130px] object-contain brightness-105"
                />
              </div>
            )}
          </div>

          {/* Collapse toggle (desktop only) */}
          <button
            onClick={onToggleCollapse}
            type="button"
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {!isCollapsed && (
            <div className="px-3 pb-2 pt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Main Menu
            </div>
          )}

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentNav === item.key;

            return (
              <button
                key={item.key}
                type="button"
                aria-label={item.label}
                onClick={() => {
                  onNavigate(item.key);
                  onCloseMobile();
                }}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-lg text-xs font-medium transition-all group relative ${
                  isCollapsed
                    ? 'justify-center px-2 py-3'
                    : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-amber-400/[0.08] text-amber-400 font-semibold border border-amber-400/20'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-colors ${
                      isActive
                        ? 'text-amber-400'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {/* Left active accent bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-amber-400 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
