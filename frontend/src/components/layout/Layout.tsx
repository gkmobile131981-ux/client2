import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../context/AuthContext';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, role, shop, logout } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        <Topbar 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          userName={user?.name}
          userRole={role || undefined}
          shopName={shop?.name || undefined}
          onLogout={logout}
        />
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-36 sm:px-6 sm:pt-8 lg:pb-8">
          <div className="mx-auto max-w-7xl">
            <ErrorBoundary>
              {children || <Outlet />}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
