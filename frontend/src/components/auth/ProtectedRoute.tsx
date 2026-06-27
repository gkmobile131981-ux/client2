import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Smartphone } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-purple-600 shadow-md shadow-primary/20 animate-bounce">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase animate-pulse">
            GK System Booting...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const OwnerRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-purple-600 shadow-md shadow-primary/20 animate-bounce">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase animate-pulse">
            Checking Permissions...
          </span>
        </div>
      </div>
    );
  }

  if (!user || role !== 'owner') {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const SuperAdminRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-purple-600 shadow-md shadow-primary/20 animate-bounce">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase animate-pulse">
            Checking Permissions...
          </span>
        </div>
      </div>
    );
  }

  const superAdminEmails = [
    'gkmobile131981@gmail.com',
    'admin@gkrepair.com',
    'test@gkrepair.com'
  ];

  const isSuperAdmin = !!(user && ((user.role as string) === 'superadmin' || (user.email && superAdminEmails.includes(user.email.toLowerCase().trim()))));

  if (!user || !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
