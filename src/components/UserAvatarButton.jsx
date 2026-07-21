import React, { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/AuthContext';
import UserSettingsDrawer from '@/components/UserSettingsDrawer';
import { cn } from '@/lib/utils';

export default function UserAvatarButton({ size = 'default', className }) {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Helper to extract first and last name initials
  const getInitials = () => {
    if (!user) return 'AJ'; // Default fallback
    
    // Attempt to get name from common user object properties
    const fullName = user.name || user.full_name || user.display_name || user.email || 'User';
    
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const sizeClasses = {
    sm: 'h-8 w-8',
    default: 'h-9 w-9',
    lg: 'h-11 w-11',
  };

  const dotSizeClasses = {
    sm: 'h-2 w-2 right-0 bottom-0 translate-x-[15%] translate-y-[15%]',
    default: 'h-2.5 w-2.5 right-0 bottom-0 translate-x-[10%] translate-y-[10%]',
    lg: 'h-3 w-3 right-0.5 bottom-0.5 translate-x-0 translate-y-0',
  };

  return (
    <>
      <div className="relative inline-flex items-center justify-center">
        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "relative flex items-center justify-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background transition-all duration-200 hover:scale-105 active:scale-95 hover:ring-2 hover:ring-slate-200 dark:hover:ring-slate-700",
            className
          )}
          aria-label="Open user settings"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
        >
          <Avatar className={cn("border border-border/40 shadow-sm", sizeClasses[size] || sizeClasses.default)}>
            <AvatarImage 
              src={user?.avatar_url} 
              alt={user?.name || "User avatar"} 
              className="object-cover" 
            />
            <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-slate-100 dark:from-slate-500 dark:to-slate-700 font-medium tracking-wide">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </button>
        
        {/* Online Status Indicator */}
        <span
          className={cn(
            "absolute rounded-full bg-emerald-500 border-2 border-background shadow-sm pointer-events-none z-10",
            dotSizeClasses[size] || dotSizeClasses.default
          )}
          aria-hidden="true"
        />
      </div>
      
      <UserSettingsDrawer 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen} 
      />
    </>
  );
}
