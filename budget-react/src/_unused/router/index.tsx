import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import MainLayout from '../components/layout/MainLayout';
import LoginPage from '../pages/Login';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

// Lazy load pages
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Expenses = lazy(() => import('../pages/Expenses'));
const CashBanking = lazy(() => import('../pages/CashBanking'));
const Budget = lazy(() => import('../pages/Budget'));
const Reports = lazy(() => import('../pages/Reports'));
const Settings = lazy(() => import('../pages/Settings'));
const AdminTools = lazy(() => import('../pages/AdminTools'));
const NotFound = lazy(() => import('../pages/NotFound'));

// Loading component
const Loading = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}
  >
    <CircularProgress />
  </Box>
);

// Protected Route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoading } = useSelector((state: RootState) => state.auth);
  
  if (isLoading) {
    return <Loading />;
  }
  
  // For now, allow access without authentication (matching legacy app)
  // Once auth is fully implemented, uncomment the line below:
  // if (!isAuthenticated) {
  //   return <Navigate to="/login" replace />;
  // }
  
  return <>{children}</>;
};

// Create router
const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Loading />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: 'expenses',
        element: (
          <Suspense fallback={<Loading />}>
            <Expenses />
          </Suspense>
        ),
      },
      {
        path: 'cash-banking',
        element: (
          <Suspense fallback={<Loading />}>
            <CashBanking />
          </Suspense>
        ),
      },
      {
        path: 'budget',
        element: (
          <Suspense fallback={<Loading />}>
            <Budget />
          </Suspense>
        ),
      },
      {
        path: 'reports',
        element: (
          <Suspense fallback={<Loading />}>
            <Reports />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<Loading />}>
            <Settings />
          </Suspense>
        ),
      },
      {
        path: 'admin',
        element: (
          <Suspense fallback={<Loading />}>
            <AdminTools />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: (
          <Suspense fallback={<Loading />}>
            <NotFound />
          </Suspense>
        ),
      },
    ],
  },
], {
  basename: import.meta.env.BASE_URL,
});

// Router component
const AppRouter = () => {
  return <RouterProvider router={router} />;
};

export default AppRouter;