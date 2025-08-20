import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { Paper, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';

interface TrendLineChartProps {
  data: Array<{
    date: string;
    income?: number;
    expenses?: number;
    [key: string]: any;
  }>;
  title?: string;
  height?: number;
  type?: 'line' | 'area';
}

const TrendLineChart: React.FC<TrendLineChartProps> = ({ 
  data, 
  title = 'Spending Trend',
  height = 300,
  type = 'area'
}) => {
  const theme = useTheme();

  const formatCurrency = (value: number) => `€${value.toLocaleString()}`;
  
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM dd');
    } catch {
      return dateStr;
    }
  };

  const Chart = type === 'area' ? AreaChart : LineChart;
  const DataComponent = type === 'area' ? Area : Line;

  return (
    <Paper sx={{ p: 2 }}>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <Box sx={{ width: '100%', height }}>
        <ResponsiveContainer>
          <Chart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4caf50" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#4caf50" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f44336" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f44336" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              style={{ fontSize: 12 }}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              style={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={formatCurrency}
              labelFormatter={(label) => `Date: ${formatDate(label)}`}
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            />
            <Legend />
            {data[0]?.income !== undefined && (
              <DataComponent
                type="monotone"
                dataKey="income"
                stroke="#4caf50"
                fill="url(#colorIncome)"
                strokeWidth={2}
                name="Income"
              />
            )}
            {data[0]?.expenses !== undefined && (
              <DataComponent
                type="monotone"
                dataKey="expenses"
                stroke="#f44336"
                fill="url(#colorExpenses)"
                strokeWidth={2}
                name="Expenses"
              />
            )}
          </Chart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default TrendLineChart;