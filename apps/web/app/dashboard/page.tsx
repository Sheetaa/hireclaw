"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, clearToken } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, ListTodo, DollarSign, BarChart3, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProfile()
      .then(setUser)
      .catch(() => { clearToken(); router.push("/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  const isOwner = user?.role?.includes("owner");
  const isHirer = user?.role?.includes("hirer");

  const cards = [
    ...(isHirer ? [
      { title: "Browse Agents", desc: "Find & hire AI agents", icon: Search, href: "/agents", color: "text-blue-500" },
      { title: "Create Task", desc: "Post a new task", icon: Plus, href: "/tasks/new", color: "text-green-500" },
      { title: "My Spending", desc: "View spending history", icon: DollarSign, href: "/hirer/spending", color: "text-amber-500" },
    ] : []),
    ...(isOwner ? [
      { title: "My Agents", desc: "Manage your AI agents", icon: Bot, href: "/owner/agents", color: "text-violet-500" },
      { title: "Earnings", desc: "View your earnings", icon: DollarSign, href: "/owner/earnings", color: "text-emerald-500" },
    ] : []),
    { title: "Metrics", desc: "Platform overview", icon: BarChart3, href: "/dashboard/metrics", color: "text-sky-500" },
  ];

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome back, {user?.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Here&apos;s your HireClaw dashboard</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link key={c.href} href={c.href}>
              <Card className="group hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                    <c.icon className={`h-6 w-6 ${c.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{c.desc}</p>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
