// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import theme from './theme';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Register from './components/Register';

// Импорт страниц
import AnnealingSchedulePage from './pages/AnnealingSchedulePage';
import CassetteManagementPage from './pages/CassetteManagementPage';
import UsersList from './components/UsersList';
import RolesManager from './components/RolesManager';
import RolePermissionsManager from './components/RolePermissionsManager';
import ImportPage from './pages/ImportPage';
import InputDataView from './pages/InputDataView';
import AnnealingBatchPlanPage from './pages/AnnealingBatchPlanPage';
import SheetStatusUpdater from './pages/SheetStatusUpdater';
import AnnealingReportPage from './pages/AnnealingReportPage';
import AnnealingPlanPage from './pages/AnnealingPlanPage';
// Импорт общего макета
import MainLayout from './components/MainLayout'; // <-- Новый компонент макета



const AppContent = () => {
  const { user, loading } = useAuth(); // Проверим, можно ли вызвать useAuth здесь

  if (loading) {
    return <div>App Loading...</div>; // Показываем, если идет загрузка в App
  }
  return (
    
    <>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<Login />} />
              {/* <Route path="/register" element={<Register />} /> */}
        {/* Все защищенные маршруты оборачиваются в MainLayout */}
        
          <Route path="/" element={
            // Главная страница теперь тоже использует MainLayout
            // Внутри MainLayout будет определено, что рендерить: дашборд или ничего (если не /)
            <MainLayout>
              {/* Пустой компонент или дашборд будет отрендерен внутри MainLayout */}
              {/* <DashboardRedirector /> */}
            </MainLayout>
          } />
          <Route path="/users" element={<MainLayout><UsersList /></MainLayout>} />
          <Route path="/roles" element={<MainLayout><RolesManager /></MainLayout>} />
          <Route path="/register" element={<MainLayout><Register /></MainLayout>} />
          <Route path="/permissions" element={<MainLayout><RolePermissionsManager /></MainLayout>} />
          <Route path="/import" element={<MainLayout><ImportPage /></MainLayout>} />
          <Route path="/input-data" element={<MainLayout><InputDataView /></MainLayout>} />
          <Route path="/cassette-management" element={<MainLayout><CassetteManagementPage /></MainLayout>} />
          <Route path="/annealing-schedule" element={<MainLayout><AnnealingSchedulePage /></MainLayout>} />
          <Route path="/annealing-batch-plan" element={<MainLayout><AnnealingBatchPlanPage /></MainLayout>} />
          <Route path="/sheet-status-updater" element={<MainLayout><SheetStatusUpdater /></MainLayout>} />
          <Route path="/reports/annealing" element={<AnnealingReportPage />} />
          <Route path="/AnnealingPlan-cassete" element={<MainLayout><AnnealingPlanPage /></MainLayout>} />
          {/* Добавьте другие защищенные маршруты аналогично */}
      
        {/* Редирект на главную для любых других неопределенных маршрутов после логина */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;