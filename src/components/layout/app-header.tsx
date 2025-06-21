
"use client";

import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const getPageTitle = (pathname: string): string => {
  if (pathname === '/') return 'Dashboard';
  if (pathname === '/profile') return 'Profile & Settings'; 
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return 'Dashboard';
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace('-', ' '))
    .join(' / ');
};

export default function AppHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');

  }, []);
  
  if (!mounted) {
    return (
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="hidden md:flex" />
          <h1 className="text-xl font-semibold"></h1> {/* Placeholder for title */}
        </div>
        {/* Settings icons (theme, currency) are now moved to Profile page */}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="hidden md:flex" /> {/* Hidden on mobile, trigger is in sidebar itself */}
        <h1 className="text-xl font-semibold">{pageTitle}</h1>
      </div>
      {/* Theme toggle and currency selector have been moved to the Profile page */}
      <div className="flex items-center gap-2">
        {/* Intentionally empty or for future header actions not related to global settings */}
      </div>
    </header>
  );
}
