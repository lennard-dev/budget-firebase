import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { cn } from '../../lib/utils';

interface MonthTabsProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

interface PlanningPeriodType {
  id: string;
  name: string;
  interval: 'quarterly' | 'bi-annual' | 'annual';
  startMonth: string;
  endMonth: string;
  status: 'planning' | 'draft' | 'active' | 'closed';
  months?: Array<{
    value: string;
    label: string;
    shortLabel: string;
    yearLabel: string;
  }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function MonthTabs({ 
  selectedMonth, 
  onMonthChange
}: MonthTabsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PlanningPeriodType | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Fetch planning periods from database
  const { data: planningPeriods, isLoading } = useQuery({
    queryKey: ['planning-periods'],
    queryFn: async () => {
      const response = await api.get('/planning-periods');
      const periods = response.data?.data || [];
      
      // Process periods to add month arrays
      return periods.map((period: any) => {
        const months = [];
        const startDate = new Date(period.startMonth + '-01');
        const endDate = new Date(period.endMonth + '-01');
        
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const monthValue = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          const monthIndex = currentDate.getMonth();
          const year = currentDate.getFullYear();
          
          months.push({
            value: monthValue,
            label: MONTH_NAMES[monthIndex],
            shortLabel: MONTH_SHORT[monthIndex],
            yearLabel: `${MONTH_SHORT[monthIndex]} ${year}`
          });
          
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        return {
          ...period,
          months
        };
      });
    }
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Find and set the current period based on selected month
  useEffect(() => {
    if (planningPeriods && planningPeriods.length > 0) {
      const period = planningPeriods.find((p: PlanningPeriodType) => 
        p.months?.some(m => m.value === selectedMonth)
      );
      
      if (period) {
        setSelectedPeriod(period);
      } else {
        // If selected month is not in any period, select the first active or most recent period
        const activePeriod = planningPeriods.find((p: PlanningPeriodType) => p.status === 'active');
        const currentPeriod = activePeriod || planningPeriods[0];
        
        if (currentPeriod) {
          setSelectedPeriod(currentPeriod);
          // Select first month of the period
          if (currentPeriod.months && currentPeriod.months.length > 0) {
            onMonthChange(currentPeriod.months[0].value);
          }
        }
      }
    }
  }, [planningPeriods, selectedMonth, onMonthChange]);

  const handlePrevPeriod = () => {
    if (!selectedPeriod || !planningPeriods) return;
    
    const currentIndex = planningPeriods.findIndex((p: PlanningPeriodType) => p.id === selectedPeriod.id);
    if (currentIndex > 0) {
      const prevPeriod = planningPeriods[currentIndex - 1];
      setSelectedPeriod(prevPeriod);
      
      // Try to maintain the same month position if possible
      const currentMonthIndex = selectedPeriod.months?.findIndex(m => m.value === selectedMonth) || 0;
      const targetMonth = prevPeriod.months?.[Math.min(currentMonthIndex, (prevPeriod.months?.length || 1) - 1)];
      if (targetMonth) {
        onMonthChange(targetMonth.value);
      }
    }
  };

  const handleNextPeriod = () => {
    if (!selectedPeriod || !planningPeriods) return;
    
    const currentIndex = planningPeriods.findIndex((p: PlanningPeriodType) => p.id === selectedPeriod.id);
    if (currentIndex < planningPeriods.length - 1) {
      const nextPeriod = planningPeriods[currentIndex + 1];
      setSelectedPeriod(nextPeriod);
      
      // Try to maintain the same month position if possible
      const currentMonthIndex = selectedPeriod.months?.findIndex(m => m.value === selectedMonth) || 0;
      const targetMonth = nextPeriod.months?.[Math.min(currentMonthIndex, (nextPeriod.months?.length || 1) - 1)];
      if (targetMonth) {
        onMonthChange(targetMonth.value);
      }
    }
  };

  const handlePeriodSelect = (period: PlanningPeriodType) => {
    setSelectedPeriod(period);
    setShowDropdown(false);
    
    // Check if current selected month is in this period
    const monthInPeriod = period.months?.find(m => m.value === selectedMonth);
    if (!monthInPeriod && period.months && period.months.length > 0) {
      // Select first month of the new period
      onMonthChange(period.months[0].value);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center text-gray-500">
        Loading planning periods...
      </div>
    );
  }
  
  if (!planningPeriods || planningPeriods.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center text-gray-500">
        No planning periods configured. Please create planning periods in Settings.
      </div>
    );
  }
  
  if (!selectedPeriod) return null;

  const isFirstPeriod = planningPeriods[0]?.id === selectedPeriod.id;
  const isLastPeriod = planningPeriods[planningPeriods.length - 1]?.id === selectedPeriod.id;
  const hasYearInName = selectedPeriod.name.match(/\d{4}/);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 p-2">
        {/* Planning Period Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="hidden sm:inline">Planning Period:</span>
            <span className="font-semibold">{selectedPeriod.name}</span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              showDropdown && "rotate-180"
            )} />
          </button>
          
          {showDropdown && (
            <div className="absolute z-10 mt-1 min-w-[150px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {planningPeriods.map((period: PlanningPeriodType) => (
                <button
                  key={period.id}
                  onClick={() => handlePeriodSelect(period)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors",
                    period.id === selectedPeriod.id && "bg-gray-100 font-medium"
                  )}
                >
                  {period.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Previous Period Arrow */}
        <button
          onClick={handlePrevPeriod}
          disabled={isFirstPeriod}
          className={cn(
            "p-2 rounded-lg transition-colors",
            isFirstPeriod
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Month Buttons */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1 px-2 min-w-fit justify-center">
            {selectedPeriod.months?.map((month) => {
              const isSelected = month.value === selectedMonth;
              const [year, monthNum] = month.value.split('-');
              const isCurrentMonth = new Date().getMonth() + 1 === parseInt(monthNum) && 
                                   new Date().getFullYear() === parseInt(year);
              
              return (
                <button
                  key={month.value}
                  onClick={() => onMonthChange(month.value)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap min-w-[60px]",
                    isSelected
                      ? "bg-gray-900 text-white"
                      : isCurrentMonth
                      ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                  title={month.label}
                >
                  <span className="block sm:hidden">{month.shortLabel}</span>
                  <span className="hidden sm:block">
                    {hasYearInName ? month.label : month.yearLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Next Period Arrow */}
        <button
          onClick={handleNextPeriod}
          disabled={isLastPeriod}
          className={cn(
            "p-2 rounded-lg transition-colors",
            isLastPeriod
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}