import React from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout: React.FC = () => {
  const { theme: themeMode, sidebarOpen } = useSelector((state: RootState) => state.ui);
  
  const theme = createTheme({
    palette: {
      mode: themeMode,
      primary: {
        main: '#667eea',
      },
      secondary: {
        main: '#764ba2',
      },
      background: {
        default: themeMode === 'light' ? '#f5f5f5' : '#121212',
      },
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
    },
  });

  const drawerWidth = 240;

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <Header drawerWidth={drawerWidth} />
        <Sidebar drawerWidth={drawerWidth} />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            mt: 8,
            ml: sidebarOpen ? `${drawerWidth}px` : 0,
            transition: theme.transitions.create(['margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          }}
        >
          <Outlet />
        </Box>
        <ToastContainer
          position="bottom-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme={themeMode}
        />
      </Box>
    </ThemeProvider>
  );
};

export default MainLayout;