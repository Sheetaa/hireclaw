"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Bot, ListTodo, User, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { clearToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/tasks/new", label: "Tasks", icon: ListTodo },
  { href: "/owner/agents", label: "Profile", icon: User },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop header */}
      <header className="hidden md:flex sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between mx-auto px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-2xl">🦞</span> HireClaw
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname === item.href ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
          <div className="flex flex-col items-center gap-1 px-3 py-2">
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </div>
  );
}
