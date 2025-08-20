import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Skeleton,
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

interface SummaryCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: string;
  trend?: {
    value: number;
    label: string;
  };
  loading?: boolean;
  format?: 'currency' | 'number' | 'percent';
  subtitle?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  icon,
  color = '#667eea',
  trend,
  loading = false,
  format = 'currency',
  subtitle,
}) => {
  const formatValue = () => {
    if (typeof value === 'string') return value;
    
    switch (format) {
      case 'currency':
        return `€${Math.abs(value).toLocaleString()}`;
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'number':
      default:
        return value.toLocaleString();
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    return trend.value >= 0 ? (
      <TrendingUp sx={{ fontSize: 16 }} />
    ) : (
      <TrendingDown sx={{ fontSize: 16 }} />
    );
  };

  const getTrendColor = () => {
    if (!trend) return 'text.secondary';
    return trend.value >= 0 ? 'success.main' : 'error.main';
  };

  return (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`,
        borderTop: `3px solid ${color}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
        },
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            
            {loading ? (
              <Skeleton variant="text" width={120} height={40} />
            ) : (
              <>
                <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                  {formatValue()}
                </Typography>
                
                {subtitle && (
                  <Typography variant="caption" color="textSecondary" display="block">
                    {subtitle}
                  </Typography>
                )}
                
                {trend && (
                  <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                    <Box display="flex" alignItems="center" color={getTrendColor()}>
                      {getTrendIcon()}
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {Math.abs(trend.value)}%
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      {trend.label}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
          
          {icon && (
            <Box sx={{ color, opacity: 0.3, '& svg': { fontSize: 40 } }}>
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default SummaryCard;