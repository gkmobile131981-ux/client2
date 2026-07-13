import React, { useState, useEffect } from 'react';
import { Menu, LogOut, User, Bell, Sun, Moon, X, Smartphone, Home, Shield, Mail } from 'lucide-react';
import { Button } from '../ui/Button';

interface TopbarProps {
  onToggleSidebar: () => void;
  userName?: string;
  userRole?: string;
  shopName?: string;
  onLogout?: () => void;
  user?: any;
  shop?: any;
}

export default function Topbar({
  onToggleSidebar,
  userName = 'John Owner',
  userRole = 'owner',
  shopName = 'GK Repair Shop Main',
  onLogout,
  user,
  shop
}: TopbarProps) {
  const [liveDate, setLiveDate] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setLiveDate(dateStr.toUpperCase());
      setLiveTime(timeStr);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-border bg-card/95 px-6 z-30">
      {/* Mobile Toggle Button & Shop Name */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex items-center gap-4.5">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Current Shop</span>
            <span className="text-sm font-semibold text-white leading-none mt-0.5">{shopName}</span>
          </div>
          {liveTime && (
            <div className="flex flex-col items-center justify-center bg-neutral-950 border border-border/80 px-4.5 py-2 rounded-xl h-13 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] min-w-[155px] select-none">
              <span className="text-[17px] font-black tracking-widest text-white font-mono leading-none">
                {liveTime}
              </span>
              <div className="w-full h-[1px] bg-neutral-800/90 my-1" />
              <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-widest leading-none">
                {liveDate}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action items & Profile Dropdown */}
      <div className="flex items-center gap-4">


        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-200">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
        </button>

        <div className="h-8 w-px bg-border" />

        {/* User Card */}
        <div className="flex items-center gap-3.5 pl-2">
          <div 
            onClick={() => setProfileModalOpen(true)}
            className="flex items-center gap-3 cursor-pointer group select-none hover:opacity-85"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground ring-1 ring-border shadow-inner group-hover:ring-primary/50 overflow-hidden transition-all duration-200">
              {user?.photo_url ? (
                <img 
                  src={user.photo_url} 
                  alt="Profile" 
                  className="h-full w-full object-cover" 
                />
              ) : (
                <User className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              )}
            </div>

            <div className="hidden md:flex flex-col">
              <span className="text-xs font-semibold text-foreground leading-tight group-hover:text-primary transition-colors duration-200">{userName}</span>
              <span className="text-[10px] text-primary font-bold uppercase tracking-wider mt-0.5">{userRole}</span>
            </div>
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

      {/* Profile Details Modal Pop-up */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div 
            className="w-full max-w-md bg-slate-950/95 border border-primary/20 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/40 px-6 py-4 bg-secondary/10">
              <div className="flex items-center gap-2">
                <Shield className="h-4.5 w-4.5 text-primary" />
                <span className="text-sm font-extrabold uppercase tracking-wider text-white">Owner Identity Card</span>
              </div>
              <button 
                onClick={() => setProfileModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Profile Avatar Banner */}
              <div className="flex flex-col items-center justify-center text-center space-y-3 pb-2 border-b border-border/20">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary text-primary shadow-lg overflow-hidden">
                  {user?.photo_url ? (
                    <img 
                      src={user.photo_url} 
                      alt="Profile Banner" 
                      className="h-full w-full object-cover" 
                    />
                  ) : (
                    <User className="h-10 w-10" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-none">{user?.name || userName}</h3>
                  <span className="inline-block px-2.5 py-0.5 mt-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-primary/20 text-primary border border-primary/30">
                    {user?.role || userRole}
                  </span>
                </div>
              </div>

              {/* Profile Fields Info Grid */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between py-2 border-b border-border/10 text-xs">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </span>
                  <span className="text-white font-medium">{user?.email || 'N/A'}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border/10 text-xs">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5" /> Phone
                  </span>
                  <span className="text-white font-medium">{user?.personal_phone || 'N/A'}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border/10 text-xs">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Home className="h-3.5 w-3.5" /> Shop
                  </span>
                  <span className="text-white font-medium">{shop?.name || shopName}</span>
                </div>

                {user?.aadhar_number && (
                  <div className="flex items-center justify-between py-2 border-b border-border/10 text-xs">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" /> Aadhaar No.
                    </span>
                    <span className="text-white font-semibold font-mono">{user.aadhar_number}</span>
                  </div>
                )}

                {user?.dob && (
                  <div className="flex items-center justify-between py-2 border-b border-border/10 text-xs">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider">Date of Birth</span>
                    <span className="text-white font-medium">{user.dob}</span>
                  </div>
                )}

                {user?.blood_group && (
                  <div className="flex items-center justify-between py-2 border-b border-border/10 text-xs">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider">Blood Group</span>
                    <span className="text-white font-bold text-red-400">{user.blood_group}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border/40 px-6 py-4 bg-secondary/10">
              <Button 
                variant="outline" 
                onClick={() => setProfileModalOpen(false)}
                className="text-xs font-bold uppercase tracking-wider"
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  setProfileModalOpen(false);
                  if (onLogout) onLogout();
                }}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider"
              >
                Log Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
