// src/components/TokenExpiryWarning.jsx
import { useState, useEffect } from 'react';
import { Alert, Snackbar } from '@mui/material';

const TokenExpiryWarning = () => {  // ← убрали export перед const
  const [showWarning, setShowWarning] = useState(false);
  const [expiryTime, setExpiryTime] = useState(null);

  useEffect(() => {
    const checkTokenExpiry = () => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) return;

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp) {
          const expiryDate = new Date(payload.exp * 1000);
          const timeLeft = expiryDate - new Date();
          
          // Показываем предупреждение за 5 минут до истечения
          if (timeLeft > 0 && timeLeft < 5 * 60 * 1000) {
            const minutesLeft = Math.ceil(timeLeft / 60000);
            setExpiryTime(minutesLeft);
            setShowWarning(true);
          }
        }
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    };

    checkTokenExpiry();
    const interval = setInterval(checkTokenExpiry, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleClose = () => {
    setShowWarning(false);
  };

  return (
    <Snackbar 
      open={showWarning} 
      autoHideDuration={10000} 
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert severity="warning" onClose={handleClose}>
        Ваша сессия истечёт через {expiryTime}{' '}
        {expiryTime === 1 ? 'минуту' : 
         expiryTime >= 2 && expiryTime <= 4 ? 'минуты' : 'минут'}. 
        Сохраните данные и выполните вход заново.
      </Alert>
    </Snackbar>
  );
};

export default TokenExpiryWarning;  // ← export default в конце