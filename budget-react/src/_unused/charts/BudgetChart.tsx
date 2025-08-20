import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Paper, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface BudgetChartProps {
  data: Array<{
    category: string;
    budget: number;
    actual: number;
  }>;
  title?: string;
  height?: number;
}

const BudgetChart: React.FC<BudgetChartProps> = ({ 
  data, 
  title = 'Budget vs Actual', 
  height = 300 
}) => {
  const theme = useTheme();

  const formatCurrency = (value: number) => `€${value.toLocaleString()}`;

  return (
    <Paper sx={{ p: 2 }}>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <Box sx={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="category" 
              style={{ fontSize: 12 }}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              style={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={formatCurrency}
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            />
            <Legend />
            <Bar 
              dataKey="budget" 
              fill={theme.palette.primary.main}
              name="Budget"
            />
            <Bar 
              dataKey="actual" 
              fill={theme.palette.secondary.main}
              name="Actual"
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default BudgetChart;