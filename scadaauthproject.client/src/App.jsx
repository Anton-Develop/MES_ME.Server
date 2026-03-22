// src/App.jsx

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { RoutePermissionsProvider } from './components/RoutePermissionsContext';
import theme from './theme';

import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Register from './components/Register';

// Компоненты управления
import RolesManager from './components/RolesManager';
import RolePermissionsManager from './components/RolePermissionsManager';
import RoutePermissionsManager from './components/RoutePermissionsManager';
import UsersList from './components/UsersList';

// Страницы
import AnnealingSchedulePage from './pages/AnnealingSchedulePage';
import CassetteManagementPage from './pages/CassetteManagementPage';
import ImportPage from './pages/ImportPage';
import InputDataView from './pages/InputDataView';
import AnnealingBatchPlanPage from './pages/AnnealingBatchPlanPage';
import SheetStatusUpdater from './pages/SheetStatusUpdater';
import AnnealingReportPage from './pages/AnnealingReportPage';
import AnnealingPlanPage from './pages/AnnealingPlanPage';

const Unauthorized = () => (
    <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>Доступ запрещён</h2>
        <p>У вас нет прав для просмотра этой страницы.</p>
    </div>
);

const App = () => (
    <BrowserRouter>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
                <RoutePermissionsProvider>
                    <Routes>
                        {/* Публичные маршруты */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/unauthorized" element={<Unauthorized />} />

                        {/* Все защищённые маршруты вложены в MainLayout */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <MainLayout />
                                </ProtectedRoute>
                            }
                        >
                            {/* Дашборд — рендерится внутри MainLayout по роли */}
                            <Route index element={null} />

                            {/* Регистрация пользователя — только superadmin и developer */}
                            <Route
                                path="register"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={['superadmin', 'developer']}
                                        requireRouteAccess={false}
                                    >
                                        <Register />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Управление пользователями */}
                            <Route
                                path="users"
                                element={
                                    <ProtectedRoute>
                                        <UsersList />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Управление ролями */}
                            <Route
                                path="roles"
                                element={
                                    <ProtectedRoute>
                                        <RolesManager />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Управление правами ролей */}
                            <Route
                                path="permissions"
                                element={
                                    <ProtectedRoute>
                                        <RolePermissionsManager />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Управление маршрутами — только superadmin и developer,
                  не проверяем hasRoute т.к. это служебная страница */}
                            <Route
                                path="route-permissions"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={['superadmin', 'developer']}
                                        requireRouteAccess={false}
                                    >
                                        <RoutePermissionsManager />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Входные данные */}
                            <Route
                                path="input-data"
                                element={
                                    <ProtectedRoute>
                                        <InputDataView />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Импорт данных из Excel */}
                            <Route
                                path="import"
                                element={
                                    <ProtectedRoute>
                                        <ImportPage />
                                    </ProtectedRoute>
                                }
                            />

                            {/* План закалки (batch) */}
                            <Route
                                path="annealing-batch-plan"
                                element={
                                    <ProtectedRoute>
                                        <AnnealingBatchPlanPage />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Расписание закалки */}
                            <Route
                                path="annealing-schedule"
                                element={
                                    <ProtectedRoute>
                                        <AnnealingSchedulePage />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Отчёт по закалке */}
                            <Route
                                path="annealing-report"
                                element={
                                    <ProtectedRoute>
                                        <AnnealingReportPage />
                                    </ProtectedRoute>
                                }
                            />

                            {/* План отпуска (AnnealingPlan по кассетам) */}
                            <Route
                                path="AnnealingPlan-cassete"
                                element={
                                    <ProtectedRoute>
                                        <AnnealingPlanPage />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Управление кассетами */}
                            <Route
                                path="cassette-management"
                                element={
                                    <ProtectedRoute>
                                        <CassetteManagementPage />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Изменение статусов листов */}
                            <Route
                                path="sheet-status-updater"
                                element={
                                    <ProtectedRoute>
                                        <SheetStatusUpdater />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Фолбэк — любой неизвестный путь */}
                            <Route path="*" element={<Navigate to="/unauthorized" replace />} />
                        </Route>
                    </Routes>
                </RoutePermissionsProvider>
            </AuthProvider>
        </ThemeProvider>
    </BrowserRouter>
);

export default App;