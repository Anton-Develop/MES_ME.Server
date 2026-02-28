import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import UsersList from './components/UsersList';
import RolesManager from './components/RolesManager';
import RolePermissionsManager from './components/RolePermissionsManager';
import ImportPage from './pages/ImportPage';
import InputDataView from './pages/InputDataView';
import CassetteManagementPage from './pages/CassetteManagementPage'; 

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
});

const AppContent = () => {
  return (
    <Router>
      <>
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={
            <ProtectedRoute allowedRoles={['master', 'operator', 'developer', 'superadmin']}>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute allowedRoles={['superadmin', 'developer']}>
              <UsersList />
            </ProtectedRoute>
          } />
		  <Route path="/cassette-management" element={ // Новый маршрут
            <ProtectedRoute allowedRoles={['master', 'operator', 'developer', 'superadmin']}>
              <CassetteManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/roles" element={
            <ProtectedRoute allowedRoles={['superadmin', 'developer']}>
              <RolesManager />
            </ProtectedRoute>
          } />
		    <Route path="/import" element={
            <ProtectedRoute allowedRoles={['superadmin', 'developer']}>
              <ImportPage />
            </ProtectedRoute>
          } />
		  <Route path="/input-data-view" element={ // Новый маршрут
            <ProtectedRoute allowedRoles={['superadmin', 'developer']}>
              <InputDataView />
            </ProtectedRoute>
          } />
		  <Route path="/role-permissions" element={
			<ProtectedRoute allowedRoles={['superadmin', 'developer']}>
				<RolePermissionsManager />
			</ProtectedRoute>
			} />
          <Route path="/unauthorized" element={<div style={{ padding: '20px', textAlign: 'center' }}>Доступ запрещён</div>} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </>
    </Router>
  );
};

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;