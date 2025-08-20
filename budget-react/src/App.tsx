import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/query-client';
import ErrorBoundary from './components/common/ErrorBoundary';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import './styles/globals.css';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Router basename="/build">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="budget" element={<div className="p-6"><h1 className="text-2xl font-bold">Budget</h1><p className="mt-2 text-gray-600">Coming Soon</p></div>} />
              <Route path="cash-banking" element={<div className="p-6"><h1 className="text-2xl font-bold">Cash & Banking</h1><p className="mt-2 text-gray-600">Coming Soon</p></div>} />
              <Route path="reports" element={<div className="p-6"><h1 className="text-2xl font-bold">Reports</h1><p className="mt-2 text-gray-600">Coming Soon</p></div>} />
              <Route path="settings" element={<div className="p-6"><h1 className="text-2xl font-bold">Settings</h1><p className="mt-2 text-gray-600">Coming Soon</p></div>} />
            </Route>
          </Routes>
        </Router>
      </ErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;