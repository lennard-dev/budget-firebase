import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
} from '@mui/material';
import { Google } from '@mui/icons-material';
import { signInWithGoogle } from '../services/firebase';
import { toast } from 'react-toastify';

const Login: React.FC = () => {
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      toast.success('Signed in successfully!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          m: 2,
        }}
      >
        <Typography variant="h4" gutterBottom align="center">
          Budget Management
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" paragraph>
          Sign in to manage your finances
        </Typography>
        
        <Button
          fullWidth
          variant="contained"
          startIcon={<Google />}
          onClick={handleGoogleSignIn}
          sx={{
            mt: 3,
            mb: 2,
            py: 1.5,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a72d8 0%, #6a4193 100%)',
            },
          }}
        >
          Sign in with Google
        </Button>
        
        <Divider sx={{ my: 3 }}>OR</Divider>
        
        <Button
          fullWidth
          variant="outlined"
          onClick={() => navigate('/')}
          sx={{ py: 1 }}
        >
          Continue without signing in
        </Button>
        
        <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 3, display: 'block' }}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Typography>
      </Paper>
    </Box>
  );
};

export default Login;