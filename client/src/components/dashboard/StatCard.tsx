import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  customIcon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  customIcon,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between min-h-[92px]">
      <div>
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
          {title}
        </p>
        <div className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
          {value}
        </div>
      </div>
      <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/70 shadow-xs flex-shrink-0">
        {customIcon ? (
          customIcon
        ) : Icon ? (
          <Icon className="w-4 h-4 text-purple-600" />
        ) : null}
      </div>
    </div>
  );
};
