import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Info, AlertTriangle, Plus, X, User } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ExecutiveSummaryProps {
  data: {
    totalBudget: number;
    totalSpent: number;
    totalVariance: number;
  };
  summary: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  actions?: NeededAction[];
  onActionsChange?: (actions: NeededAction[]) => void;
}

interface NeededAction {
  id: string;
  text: string;
  assignee: string;
  priority: 'info' | 'warning';
}

export default function ExecutiveSummary({ 
  data, 
  summary, 
  onChange, 
  disabled,
  actions = [],
  onActionsChange 
}: ExecutiveSummaryProps) {
  const [localActions, setLocalActions] = useState<NeededAction[]>(actions);
  const [newAction, setNewAction] = useState({ text: '', assignee: '', priority: 'info' as 'info' | 'warning' });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const utilizationPercent = data.totalBudget > 0 
    ? (data.totalSpent / data.totalBudget) * 100 
    : 0;

  // Determine card colors based on values
  const getSpentColor = () => {
    const percentOfBudget = (data.totalSpent / data.totalBudget) * 100;
    if (percentOfBudget < 85) return 'bg-green-50 border-green-200';
    if (percentOfBudget <= 100) return 'bg-green-50 border-green-200';
    return 'bg-red-50 border-red-200';
  };

  const getVarianceColor = () => {
    const percentVariance = Math.abs(data.totalVariance / data.totalBudget) * 100;
    if (data.totalVariance > 0) return 'bg-red-50 border-red-200'; // Over budget
    if (percentVariance > 15) return 'bg-yellow-50 border-yellow-200'; // Significantly under
    return 'bg-green-50 border-green-200'; // Within acceptable range
  };

  const getUtilizationColor = () => {
    if (utilizationPercent < 85) return 'bg-yellow-50 border-yellow-200';
    if (utilizationPercent <= 100) return 'bg-green-50 border-green-200';
    return 'bg-red-50 border-red-200';
  };

  const getSpentTextColor = () => {
    const percentOfBudget = (data.totalSpent / data.totalBudget) * 100;
    if (percentOfBudget < 85) return 'text-green-700';
    if (percentOfBudget <= 100) return 'text-green-700';
    return 'text-red-700';
  };

  const getVarianceTextColor = () => {
    const percentVariance = Math.abs(data.totalVariance / data.totalBudget) * 100;
    if (data.totalVariance > 0) return 'text-red-700';
    if (percentVariance > 15) return 'text-yellow-700';
    return 'text-green-700';
  };

  const getUtilizationTextColor = () => {
    if (utilizationPercent < 85) return 'text-yellow-700';
    if (utilizationPercent <= 100) return 'text-green-700';
    return 'text-red-700';
  };

  const handleAddAction = () => {
    if (newAction.text && newAction.assignee) {
      const action: NeededAction = {
        id: Date.now().toString(),
        text: newAction.text,
        assignee: newAction.assignee,
        priority: newAction.priority
      };
      const updatedActions = [...localActions, action];
      setLocalActions(updatedActions);
      if (onActionsChange) {
        onActionsChange(updatedActions);
      }
      setNewAction({ text: '', assignee: '', priority: 'info' });
    }
  };

  const handleRemoveAction = (id: string) => {
    const updatedActions = localActions.filter(a => a.id !== id);
    setLocalActions(updatedActions);
    if (onActionsChange) {
      onActionsChange(updatedActions);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Executive Summary</h3>
      
      {/* Metrics Grid with Color Coding */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Budget - Neutral Blue */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">Total Budget</span>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-900">
            {formatCurrency(data.totalBudget)}
          </div>
        </div>

        {/* Total Spent - Dynamic Color */}
        <div className={cn("rounded-lg p-4 border", getSpentColor())}>
          <div className="flex items-center justify-between mb-2">
            <span className={cn("text-sm font-medium", getSpentTextColor())}>Total Spent</span>
            {data.totalSpent > data.totalBudget ? (
              <TrendingUp className="h-4 w-4 text-red-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-600" />
            )}
          </div>
          <div className={cn("text-xl font-bold", getSpentTextColor())}>
            {formatCurrency(data.totalSpent)}
          </div>
        </div>

        {/* Net Variance - Dynamic Color */}
        <div className={cn("rounded-lg p-4 border", getVarianceColor())}>
          <div className="flex items-center justify-between mb-2">
            <span className={cn("text-sm font-medium", getVarianceTextColor())}>Net Variance</span>
            {data.totalVariance > 0 ? (
              <TrendingUp className="h-4 w-4 text-red-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-600" />
            )}
          </div>
          <div className={cn("text-xl font-bold", getVarianceTextColor())}>
            {formatCurrency(Math.abs(data.totalVariance))}
            <span className="text-sm font-normal ml-1">
              {data.totalVariance > 0 ? 'over' : 'under'}
            </span>
          </div>
        </div>

        {/* Budget Utilization - Dynamic Color */}
        <div className={cn("rounded-lg p-4 border", getUtilizationColor())}>
          <div className="flex items-center justify-between mb-2">
            <span className={cn("text-sm font-medium", getUtilizationTextColor())}>Budget Utilization</span>
            <Percent className="h-4 w-4 text-blue-600" />
          </div>
          <div className={cn("text-xl font-bold", getUtilizationTextColor())}>
            {utilizationPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Two Column Layout: Summary Narrative (50%) and Needed Actions (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary Narrative - Left Column */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Executive Summary Narrative
          </label>
          <textarea
            value={summary}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Provide a high-level summary of the month's financial performance, key achievements, challenges, and strategic implications..."
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
          />
        </div>

        {/* Modernized Key Actions Required - Right Column */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Key Actions Required
          </label>
          <div className="border border-gray-200 rounded-lg bg-white h-48 flex flex-col">
            {/* Actions List - Modern Compact Design */}
            <div className="flex-1 overflow-y-auto p-2">
              {localActions.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  No actions added yet
                </div>
              ) : (
                <div className="space-y-1">
                  {localActions.map(action => (
                    <div 
                      key={action.id} 
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      {/* Priority Icon */}
                      <div className="flex-shrink-0">
                        {action.priority === 'warning' ? (
                          <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <Info className="h-3 w-3 text-blue-600" />
                          </div>
                        )}
                      </div>
                      
                      {/* Action Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{action.text}</p>
                      </div>
                      
                      {/* Assignee */}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <User className="h-3 w-3" />
                        <span className="max-w-[80px] truncate">{action.assignee}</span>
                      </div>
                      
                      {/* Remove Button */}
                      {!disabled && (
                        <button
                          onClick={() => handleRemoveAction(action.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Action - Single Line Input */}
            {!disabled && (
              <div className="border-t p-2">
                <div className="flex items-center gap-2">
                  {/* Priority Selector */}
                  <select
                    value={newAction.priority}
                    onChange={(e) => setNewAction({...newAction, priority: e.target.value as 'info' | 'warning'})}
                    className="flex-shrink-0 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="info">ℹ️</option>
                    <option value="warning">⚠️</option>
                  </select>
                  
                  {/* Action Input */}
                  <input
                    type="text"
                    placeholder="Action..."
                    value={newAction.text}
                    onChange={(e) => setNewAction({...newAction, text: e.target.value})}
                    className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {/* Assignee Input */}
                  <input
                    type="text"
                    placeholder="Assignee..."
                    value={newAction.assignee}
                    onChange={(e) => setNewAction({...newAction, assignee: e.target.value})}
                    className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {/* Add Button */}
                  <button
                    onClick={handleAddAction}
                    disabled={!newAction.text || !newAction.assignee}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}