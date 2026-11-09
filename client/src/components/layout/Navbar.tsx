import React from 'react';
import { Menu, Search } from 'lucide-react';
import { NavigationKey } from '../../types';

interface NavbarProps {
  currentNav: NavigationKey;
  onOpenMobile: () => void;
}

const PAGE_TITLES: Record<NavigationKey, string> = {
  dashboard: 'Dashboard Overview',
  invoices: 'Invoices & Billing',
  reminders: 'Automated Reminders (WhatsApp & Email)',
  customers: 'Customer Directory',
  products: 'Products & Services',
  payments: 'Payment Records',
  reports: 'Sales & Tax Reports',
  settings: 'Business Settings',
};

export const Navbar: React.FC<NavbarProps> = ({
  currentNav,
  onOpenMobile,
}) => {
  const currentTitle = PAGE_TITLES[currentNav] || 'Dashboard Overview';

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left side: Hamburger (mobile) + Clean Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobile}
          type="button"
          className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Open mobile navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight">
          {currentTitle}
        </h1>
      </div>

      {/* Right side: Clean Search Input */}
      <div className="flex items-center gap-3">
        <div className="relative w-64 sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search records, invoices... (Ctrl + K)"
            aria-label="Search records and invoices"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>
      </div>
    </header>
  );
};
