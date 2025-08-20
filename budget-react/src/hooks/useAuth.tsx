import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthChange, getCurrentUserToken } from '../services/firebase';
import { setUser, setLoading } from '../store/slices/authSlice';
import type { RootState } from '../store';

export const useAuth = () => {
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    dispatch(setLoading(true));
    
    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        const token = await getCurrentUserToken();
        dispatch(setUser({ user, token }));
      } else {
        dispatch(setUser({ user: null, token: null }));
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  return auth;
};