import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../logo.png';
import { 
  Wrench, 
  Users, 
  LayoutDashboard, 
  Settings, 
  UserSquare2, 
  X,
  Smartphone,
  TrendingUp,
  ClipboardList,
  Contact
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface NavItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
  superAdminOnly?: boolean;
  end?: boolean;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
  { name: 'Repair Jobs', to: '/repairs', icon: Wrench },
  { name: 'Customers', to: '/customers', icon: Users },
  { name: 'Reports', to: '/reports', icon: TrendingUp, ownerOnly: true },
  { name: 'Repairing Price List', to: '/settings/price-list', icon: ClipboardList, ownerOnly: true },
  { name: 'Owner ID Card', to: '/id-card', icon: Contact, ownerOnly: true },
  { name: 'Settings', to: '/settings', icon: Settings, end: true },
  { name: 'Super Admin', to: '/superadmin', icon: UserSquare2, superAdminOnly: true },
];

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const { role, user } = useAuth();
  const superAdminEmails = [
    'niamaran218@gmail.com',
    'admin@gkrepair.com',
    'test@gkrepair.com'
  ];
  const isSuperAdmin = !!(user && ((user.role as string) === 'superadmin' || (user.email && superAdminEmails.includes(user.email.toLowerCase().trim()))));
  const filteredNavigation = navigation.filter(item => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.ownerOnly) return role === 'owner' || isSuperAdmin;
    return true;
  });
  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card/60 backdrop-blur-xl transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header (Brand) */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <div className="flex items-center justify-center flex-1 max-w-[220px] h-12 overflow-hidden bg-white rounded-lg p-1">
            <img src={logo} alt="Association Logo" className="h-full w-full object-contain" />
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          {filteredNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              end={item.end}
              onClick={() => setIsOpen(false)} // Close sidebar on mobile navigation
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                  />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-border bg-secondary/10">
          <div className="rounded-lg bg-card/40 border border-border/40 p-3.5 text-center">
            <p className="text-[11px] font-medium text-muted-foreground">Association Repair System v1.0</p>
            <p className="text-[9px] text-muted-foreground/60 mt-0.5">Free Tier Cloud Hosting</p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t border-border bg-card/85 backdrop-blur-lg lg:hidden justify-around items-center px-1 pb-safe shadow-lg">
        {filteredNavigation
          .filter((item) => ['/', '/repairs', '/customers', '/settings'].includes(item.to))
          .map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition-all ${
                  isActive ? 'text-primary scale-105' : 'text-muted-foreground hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5 mb-0.5" />
              <span className="truncate max-w-[65px]">{item.name}</span>
            </NavLink>
          ))}
      </div>
    </>
  );
}
