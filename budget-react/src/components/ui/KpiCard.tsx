import React from 'react';
import { cn } from '../../lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  caption?: string;
  className?: string;
  onClick?: () => void;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, caption, className, onClick }) => {
  return (
    <div 
      className={cn(
        "bg-white rounded-xl p-5 shadow-sm border border-gray-200",
        onClick && "cursor-pointer hover:shadow-md transition-shadow",
        className
      )}
      onClick={onClick}
    >
      <div className="text-sm text-gray-600 font-normal mb-2">{label}</div>
      <div className="text-3xl font-semibold text-gray-900">{value}</div>
      {caption && <div className="text-xs text-gray-500 mt-2">{caption}</div>}
    </div>
  );
};

export default KpiCard;