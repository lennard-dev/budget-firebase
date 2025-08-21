import { Wallet, Building2, TrendingDown, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FinancialPositionProps {
  cashBalance: number;
  bankBalance: number;
  burnRate: number;
  monthsRemaining: number;
}

export default function FinancialPosition({ 
  cashBalance, 
  bankBalance, 
  burnRate, 
  monthsRemaining 
}: FinancialPositionProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Position</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">Bank Balance</span>
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {formatCurrency(bankBalance)}
          </div>
          <p className="text-xs text-blue-700 mt-1">Current account balance</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-900">Cash on Hand</span>
            <Wallet className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-900">
            {formatCurrency(cashBalance)}
          </div>
          <p className="text-xs text-green-700 mt-1">Available petty cash</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-900">Monthly Burn Rate</span>
            <TrendingDown className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900">
            {formatCurrency(burnRate)}
          </div>
          <p className="text-xs text-amber-700 mt-1">Average monthly expenses</p>
        </div>

        <div className={cn(
          "rounded-lg p-4",
          monthsRemaining < 1 
            ? "bg-gradient-to-br from-red-50 to-red-100" 
            : monthsRemaining < 3 
            ? "bg-gradient-to-br from-amber-50 to-amber-100"
            : "bg-gradient-to-br from-green-50 to-green-100"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className={cn(
              "text-sm font-medium",
              monthsRemaining < 1 ? "text-red-900" : 
              monthsRemaining < 3 ? "text-amber-900" : "text-green-900"
            )}>
              Months Remaining
            </span>
            <Calendar className={cn(
              "h-5 w-5",
              monthsRemaining < 1 ? "text-red-600" : 
              monthsRemaining < 3 ? "text-amber-600" : "text-green-600"
            )} />
          </div>
          <div className={cn(
            "text-2xl font-bold",
            monthsRemaining < 1 ? "text-red-900" : 
            monthsRemaining < 3 ? "text-amber-900" : "text-green-900"
          )}>
            {monthsRemaining.toFixed(1)}
          </div>
          <p className={cn(
            "text-xs mt-1",
            monthsRemaining < 1 ? "text-red-700" : 
            monthsRemaining < 3 ? "text-amber-700" : "text-green-700"
          )}>
            {monthsRemaining < 1 ? "Critical - immediate funding needed" :
             monthsRemaining < 3 ? "Low runway - seek funding" :
             "Healthy runway"}
          </p>
        </div>
      </div>
      
      {monthsRemaining < 3 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Financial Advisory:</strong> With {monthsRemaining.toFixed(1)} months of runway remaining, 
            it's recommended to initiate fundraising activities or implement cost reduction measures to extend operational capacity.
          </p>
        </div>
      )}
    </div>
  );
}