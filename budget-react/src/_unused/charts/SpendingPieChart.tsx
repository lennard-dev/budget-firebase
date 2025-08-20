import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from 'recharts';
import { Paper, Typography, Box } from '@mui/material';

interface SpendingPieChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  title?: string;
  height?: number;
}

const COLORS = [
  '#667eea',
  '#764ba2',
  '#f093fb',
  '#4facfe',
  '#00f2fe',
  '#43e97b',
  '#38f9d7',
  '#fa709a',
  '#fee140',
  '#30cfd0'
];

const SpendingPieChart: React.FC<SpendingPieChartProps> = ({ 
  data, 
  title = 'Spending by Category',
  height = 300 
}) => {

  const formatCurrency = (value: number) => `€${value.toLocaleString()}`;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            p: 1,
            borderRadius: 1,
          }}
        >
          <Typography variant="body2">{payload[0].name}</Typography>
          <Typography variant="body2" color="primary">
            {formatCurrency(payload[0].value)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {((payload[0].value / data.reduce((a, b) => a + b.value, 0)) * 100).toFixed(1)}%
          </Typography>
        </Box>
      );
    }
    return null;
  };

  const renderLabel = (entry: any) => {
    const total = data.reduce((a, b) => a + b.value, 0);
    const percent = ((entry.value / total) * 100).toFixed(0);
    return Number(percent) > 5 ? `${percent}%` : '';
  };

  return (
    <Paper sx={{ p: 2 }}>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <Box sx={{ width: '100%', height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value) => (
                <span style={{ fontSize: 12 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default SpendingPieChart;