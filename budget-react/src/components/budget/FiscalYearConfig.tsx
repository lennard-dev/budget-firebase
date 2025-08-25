import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, RefreshCw, Settings } from 'lucide-react';
import { api } from '../../services/api';
import { cn } from '../../lib/utils';

interface BudgetConfig {
  fiscal_year_start: string;
  planning_period: 'quarterly' | 'bi-annual' | 'annual' | 'custom';
  auto_renewal: boolean;
  current_year: number;
}

interface FiscalYearConfigProps {
  config?: BudgetConfig;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PLANNING_PERIODS = [
  { value: 'quarterly', label: 'Quarterly (3 months)' },
  { value: 'bi-annual', label: 'Bi-annual (6 months)' },
  { value: 'annual', label: 'Annual (12 months)' },
  { value: 'custom', label: 'Custom' }
];

export default function FiscalYearConfig({ config }: FiscalYearConfigProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editConfig, setEditConfig] = useState<BudgetConfig>({
    fiscal_year_start: config?.fiscal_year_start || 'January',
    planning_period: config?.planning_period || 'annual',
    auto_renewal: config?.auto_renewal || false,
    current_year: config?.current_year || new Date().getFullYear()
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: Partial<BudgetConfig>) => {
      const response = await api.put('/budget-allocation-config', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-allocation-config'] });
      setIsEditing(false);
    }
  });

  const handleSave = () => {
    updateConfigMutation.mutate(editConfig);
  };

  const handleCancel = () => {
    setEditConfig({
      fiscal_year_start: config?.fiscal_year_start || 'January',
      planning_period: config?.planning_period || 'annual',
      auto_renewal: config?.auto_renewal || false,
      current_year: config?.current_year || new Date().getFullYear()
    });
    setIsEditing(false);
  };

  const getConfigSummary = () => {
    const period = PLANNING_PERIODS.find(p => p.value === (config?.planning_period || 'annual'))?.label || 'Annual';
    const renewal = config?.auto_renewal ? 'with automatic renewal' : 'without automatic renewal';
    return `${period} starting from ${config?.fiscal_year_start || 'January'}, ${renewal}`;
  };

  if (!isEditing) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              Budget Planning Period
            </h3>
            <p className="mt-1 text-sm text-gray-600">{getConfigSummary()}</p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Configure
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-gray-500" />
        Configure Budget Planning Period
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Planning Period
          </label>
          <select
            value={editConfig.planning_period}
            onChange={(e) => setEditConfig(prev => ({ 
              ...prev, 
              planning_period: e.target.value as BudgetConfig['planning_period']
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {PLANNING_PERIODS.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fiscal Year Start
          </label>
          <select
            value={editConfig.fiscal_year_start}
            onChange={(e) => setEditConfig(prev => ({ ...prev, fiscal_year_start: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {MONTHS.map(month => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editConfig.auto_renewal}
              onChange={(e) => setEditConfig(prev => ({ ...prev, auto_renewal: e.target.checked }))}
              className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
            />
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <RefreshCw className="h-4 w-4" />
              Auto-renewal
            </span>
          </label>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <p className="text-sm text-gray-600">
          <strong>Current Configuration:</strong> {getConfigSummary()}
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={handleCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={updateConfigMutation.isPending}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
            "bg-gray-900 text-white hover:bg-gray-800"
          )}
        >
          {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}