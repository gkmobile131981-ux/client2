import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, OwnerRoute, SuperAdminRoute } from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Repairs from './pages/Repairs';
import RepairDetail from './pages/RepairDetail';
import NewRepair from './pages/NewRepair';
import DeliverRepair from './pages/DeliverRepair';
import CustomerList from './pages/CustomerList';
import CustomerProfile from './pages/CustomerProfile';
import Reports from './pages/Reports';
import StaffSettings from './pages/StaffSettings';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public authentication gateways */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected application views */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                
                {/* Customer Routes */}
                <Route path="/customers" element={<CustomerList />} />
                <Route path="/customers/:id" element={<CustomerProfile />} />
                
                {/* Repair Routes */}
                <Route path="/repairs" element={<Repairs />} />
                <Route path="/repairs/new" element={<NewRepair />} />
                <Route path="/customers/:id/new-repair" element={<NewRepair />} />
                <Route path="/repairs/:id" element={<RepairDetail />} />
                <Route path="/repairs/:id/deliver" element={<DeliverRepair />} />
                
                <Route path="/settings" element={<SettingsPage />} />
                
                {/* Owner exclusive controls */}
                <Route element={<OwnerRoute />}>
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings/staff" element={<SettingsPage defaultTab="staff" />} />
                  <Route path="/settings/price-list" element={<SettingsPage defaultTab="price-list" />} />
                </Route>

                {/* Super Admin exclusive controls */}
                <Route element={<SuperAdminRoute />}>
                  <Route path="/superadmin" element={<SuperAdminDashboard />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster 
          position="top-right" 
          toastOptions={{
            className: 'bg-card border border-border text-foreground rounded-lg',
            duration: 3000
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
