import React, { useState, useEffect } from 'react';
import { Menu, LogOut, User, Bell, Sun, Moon } from 'lucide-react';

interface TopbarProps {
  onToggleSidebar: () => void;
  userName?: string;
  userRole?: string;
  shopName?: string;
  onLogout?: () => void;
}

export default function Topbar({
  onToggleSidebar,
  userName = 'John Owner',
  userRole = 'owner',
  shopName = 'GK Repair Shop Main',
  onLogout
}: TopbarProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-border bg-card/40 backdrop-blur-md px-6 z-30">
      {/* Mobile Toggle Button & Shop Name */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex flex-col">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Current Shop</span>
          <span className="text-sm font-semibold text-foreground leading-none mt-0.5">{shopName}</span>
        </div>
      </div>

      {/* Action items & Profile Dropdown */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle Switch */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-200"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-200">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
        </button>

        <div className="h-8 w-px bg-border" />

        {/* User Card */}
        <div className="flex items-center gap-3.5 pl-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground ring-1 ring-border shadow-inner">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="hidden md:flex flex-col">
            <span className="text-xs font-semibold text-foreground leading-tight">{userName}</span>
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider mt-0.5">{userRole}</span>
          </div>

          {/* Simple action to trigger logout for presentation */}
          <button
            onClick={onLogout}
            title="Log Out"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
