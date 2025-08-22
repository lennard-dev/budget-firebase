import { memo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, LabelList } from 'recharts';

interface YearToDateChartProps {
  data: Array<{
    month: number;
    budget: number;
    actual: number;
  }>;
  comment?: string;
  onCommentChange?: (value: string) => void;
  disabled?: boolean;
}

const YearToDateChart = memo(function YearToDateChart({ data, comment, onCommentChange, disabled }: YearToDateChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000) {
      return `€${(value / 1000).toFixed(1)}k`;
    }
    return `€${value}`;
  };

  const getMonthName = (month: number) => {
    const date = new Date(2024, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  const chartData = data.map(d => {
    const variance = d.actual - d.budget;
    return {
      name: getMonthName(d.month),
      Budget: d.budget,
      Actual: d.actual,
      variance: variance,
      varianceLabel: variance > 0 ? `+${formatCompactCurrency(variance)}` : formatCompactCurrency(variance),
      isOverBudget: variance > 0
    };
  });

  // Custom label component for variance badges positioned above the data point
  const renderCustomLabel = (props: any) => {
    const { x, y, index } = props;
    const item = chartData[index];
    if (!item || item.variance === undefined) return null;
    
    const isOver = item.isOverBudget;
    const labelY = y - 20; // Position above the data point
    
    return (
      <g>
        <rect
          x={x - 25}
          y={labelY - 9}
          width={50}
          height={16}
          rx={8}
          fill={isOver ? '#fee2e2' : '#dcfce7'}
          stroke={isOver ? '#fca5a5' : '#86efac'}
          strokeWidth={1}
        />
        <text
          x={x}
          y={labelY + 2}
          fill={isOver ? '#991b1b' : '#166534'}
          fontSize={9}
          fontWeight="600"
          textAnchor="middle"
        >
          {item.varianceLabel}
        </text>
      </g>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Year-to-Date Budget vs Actual</h3>
      
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart
          data={chartData}
          margin={{ top: 40, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ 
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem'
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '1rem' }}
          />
          <Line 
            type="monotone" 
            dataKey="Budget" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="Actual" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
          >
            <LabelList content={renderCustomLabel} position="top" />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Comment field */}
      {onCommentChange && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comments
          </label>
          <textarea
            value={comment || ''}
            onChange={(e) => onCommentChange(e.target.value)}
            disabled={disabled}
            placeholder="Optionally, add any notes or observations about the budget vs actual trends..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-y min-h-[48px]"
            rows={2}
          />
        </div>
      )}
    </div>
  );
});

export default YearToDateChart;