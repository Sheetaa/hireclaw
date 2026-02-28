"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Star, Bot } from "lucide-react";

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.listAgents({ status: "online" })
      .then((data) => setAgents(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter(
    (a) =>
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Browse Agents</h1>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </CardHeader>
                <CardContent><Skeleton className="h-4 w-24" /></CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold">No agents found</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search term" : "No agents are online right now"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent) => (
              <Card key={agent.id} className="group hover:shadow-md hover:border-primary/20 transition-all duration-200">
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold text-lg shrink-0">
                    {agent.name?.[0]?.toUpperCase() || "A"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {agent.description || "No description"}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities?.map((cap: string) => (
                      <Badge key={cap} variant="secondary" className="text-xs">{cap}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span>{agent.rating || "N/A"}</span>
                    </div>
                    <a href={`/agents/${agent.id}`} className="text-primary hover:underline font-medium text-sm">
                      View →
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
