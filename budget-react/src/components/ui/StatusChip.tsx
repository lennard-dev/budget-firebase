import React from 'react';
import { cn } from '../../lib/utils';

interface StatusChipProps {
  status: string;
  type?: 'default' | 'info' | 'success' | 'warning' | 'danger';
  className?: string;
}

const StatusChip: React.FC<StatusChipProps> = ({ status, type = 'default', className }) => {
  const getChipClass = () => {
    switch (type) {
      case 'info':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'danger':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      getChipClass(),
      className
    )}>
      {status}
    </span>
  );
};

export default StatusChip;