interface UpcomingExpensesProps {
  expenses: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function UpcomingExpenses({ expenses, onChange, disabled }: UpcomingExpensesProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Expenses</h3>
      <textarea
        value={expenses}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Expected costs and planned expenditures for next month..."
        className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  );
}