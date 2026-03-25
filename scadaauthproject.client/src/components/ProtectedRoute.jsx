// src/components/ProtectedRoute.jsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useRoutePermissions } from './RoutePermissionsContext';

const ProtectedRoute = ({ children, allowedRoles, requireRouteAccess = true }) => {
    const { user, loading: authLoading } = useAuth();
    const { hasRoute, loading: routesLoading, allowedRoutes } = useRoutePermissions();
    const location = useLocation();

    if (authLoading || routesLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    // Страницы которые не проверяем через БД
    const skipRouteCheck = [
        '/',
        '/login',
        '/unauthorized',
        '/route-permissions',
        '/register',
        '/permissions'
    ].includes(location.pathname);

    // Если маршруты ещё не загрузились — не блокируем
    if (requireRouteAccess && !skipRouteCheck && allowedRoutes.length > 0 && !hasRoute(location.pathname)) {
        console.log('Не загрузились маршруты')
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
};

export default ProtectedRoute;