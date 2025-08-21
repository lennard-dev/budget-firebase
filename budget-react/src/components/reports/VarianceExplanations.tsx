import { CheckCircle } from 'lucide-react';

interface Variance {
  category: string;
  variance: number;
  variancePercent: number;
}

interface VarianceExplanationsProps {
  variances: Variance[];
  explanations: Record<string, string>;
  onChange: (explanations: Record<string, string>) => void;
  disabled?: boolean;
}

export default function VarianceExplanations({ 
  variances, 
  explanations, 
  onChange, 
  disabled 
}: VarianceExplanationsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleExplanationChange = (category: string, value: string) => {
    onChange({
      ...explanations,
      [category]: value
    });
  };

  if (variances.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Variance Explanations</h3>
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-gray-600">No variances require explanation</p>
          <p className="text-sm text-gray-500 mt-1">
            All categories are within acceptable variance limits
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Variance Explanations</h3>
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          {variances.length} Required
        </span>
      </div>
      
      <div className="space-y-4">
        {variances.map((variance) => (
          <div key={variance.category}>
            <label className="block mb-2">
              <span className="text-sm font-medium text-gray-700">
                {variance.category}
              </span>
              <span className="ml-2 text-sm text-red-600">
                ({formatCurrency(variance.variance)} over)
              </span>
            </label>
            <textarea
              value={explanations[variance.category] || ''}
              onChange={(e) => handleExplanationChange(variance.category, e.target.value)}
              disabled={disabled}
              placeholder={`Explain why ${variance.category} exceeded budget by ${variance.variancePercent.toFixed(1)}%...`}
              className="w-full h-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              required
            />
            {!explanations[variance.category] && !disabled && (
              <p className="mt-1 text-xs text-red-600">
                Explanation required before finalizing
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}