
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Receipt,
  Target,
  PiggyBank,
  BarChartBig,
  Landmark,
  Box,
  Github,
  LogIn,
  LogOut,
  UserPlus,
  Loader2,
  Settings,
  Briefcase,
} from 'lucide-react';

const mainNavItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/budgets', label: 'Budgets', icon: Target },
  { href: '/savings', label: 'Savings Goals', icon: PiggyBank },
  { href: '/bank-accounts', label: 'Bank Accounts', icon: Landmark },
  { href: '/reports', label: 'Reports', icon: BarChartBig },
];

export default function AppSidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isGuest, signOutUser } = useAuth();

  const handleLogout = async () => {
    await signOutUser();
    router.push('/login'); // Redirect to login after logout
  };

  return (
    <>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <Box className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            My Finance Pal
          </h1>
        </Link>
      </SidebarHeader>
      <Separator className="bg-sidebar-border" />
      <SidebarContent className="p-2">
        <SidebarMenu>
          {mainNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={{ children: item.label, side: 'right', className: 'bg-popover text-popover-foreground' }}
                  className={cn(
                    "justify-start",
                    pathname === item.href && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <a>
                    <item.icon className="w-5 h-5" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <Separator className="bg-sidebar-border" />
      <SidebarContent className="p-2 mt-auto">
         <SidebarMenu>
            {loading ? (
                <SidebarMenuItem>
                <SidebarMenuButton
                    disabled
                    className="justify-start"
                    tooltip={{ children: "Loading...", side: 'right', className: 'bg-popover text-popover-foreground' }}
                >
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="group-data-[collapsible=icon]:hidden">Loading...</span>
                </SidebarMenuButton>
                </SidebarMenuItem>
            ) : user ? (
                <>
                <SidebarMenuItem>
                    <Link href="/profile" passHref legacyBehavior>
                    <SidebarMenuButton
                        asChild
                        isActive={pathname === "/profile"}
                        tooltip={{ children: "Profile & Settings", side: 'right', className: 'bg-popover text-popover-foreground' }}
                        className={cn(
                        "justify-start",
                        pathname === "/profile" && "bg-sidebar-accent text-sidebar-accent-foreground"
                        )}
                    >
                        <a>
                        <Settings className="w-5 h-5" />
                        <span className="group-data-[collapsible=icon]:hidden">Profile</span>
                        </a>
                    </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton
                    onClick={handleLogout}
                    className="justify-start"
                    tooltip={{ children: "Log Out", side: 'right', className: 'bg-popover text-popover-foreground' }}
                    >
                    <LogOut className="w-5 h-5" />
                    <span className="group-data-[collapsible=icon]:hidden">Log Out</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                {user.email && (
                    <SidebarMenuItem>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/70 truncate group-data-[collapsible=icon]:hidden"
                            title={user.email}>
                            {user.email}
                        </div>
                    </SidebarMenuItem>
                )}
                </>
            ) : (
                 <>
                  {isGuest && (
                    <div className="px-3 py-2 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                      <p className="font-semibold">Guest Mode</p>
                      <p>Data is stored locally. Log in to sync to the cloud.</p>
                    </div>
                  )}
                  <SidebarMenuItem>
                    <Link href="/login" passHref legacyBehavior>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === "/login"}
                        tooltip={{ children: "Log In", side: 'right', className: 'bg-popover text-popover-foreground' }}
                        className={cn("justify-start", pathname === "/login" && "bg-sidebar-accent text-sidebar-accent-foreground")}
                      >
                        <a><LogIn className="w-5 h-5" /><span className="group-data-[collapsible=icon]:hidden">Log In</span></a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link href="/signup" passHref legacyBehavior>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === "/signup"}
                        tooltip={{ children: "Sign Up", side: 'right', className: 'bg-popover text-popover-foreground' }}
                        className={cn("justify-start", pathname === "/signup" && "bg-sidebar-accent text-sidebar-accent-foreground")}
                      >
                        <a><UserPlus className="w-5 h-5" /><span className="group-data-[collapsible=icon]:hidden">Sign Up</span></a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                </>
            )}
        </SidebarMenu>
      </SidebarContent>
      <Separator className="bg-sidebar-border" />
      <SidebarFooter className="p-4 mt-auto group-data-[collapsible=icon]:p-2">
          <Button variant="ghost" className="w-full justify-start group-data-[collapsible=icon]:justify-center" asChild>
            <Link href="https://github.com/firebase/studio-prototyper" target="_blank">
             <Github className="w-5 h-5" />
             <span className="group-data-[collapsible=icon]:hidden ml-2">View on GitHub</span>
            </Link>
          </Button>
          <Button variant="ghost" className="w-full justify-start group-data-[collapsible=icon]:justify-center" asChild>
            <Link href="https://kls.is-a.dev" target="_blank">
              <Briefcase className="w-5 h-5" />
              <span className="group-data-[collapsible=icon]:hidden ml-2">klsxdev</span>
            </Link>
          </Button>
      </SidebarFooter>
    </>
  );
}
