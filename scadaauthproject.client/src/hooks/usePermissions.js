import { useAuth } from '../context/AuthContext';

export const usePermissions = () => {
  const { user, hasPermission, permissions } = useAuth();
  return {
    permissions,
    hasPermission,
    isSuperAdmin: user?.role === 'superadmin', // временно, пока не переведёте всё на права
    isDeveloper: user?.role === 'developer',
  };
};