"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2, Bot } from "lucide-react";

export default function OwnerAgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.getOwnerTasks()
      .then((data) => setAgents(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createAgent(form);
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (agentId: string, status: string) => {
    try {
      await api.updateAgentStatus(agentId, status);
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const statusDot = (status: string) => {
    const colors: Record<string, string> = {
      online: "bg-green-500",
      busy: "bg-yellow-500",
      offline: "bg-gray-400",
    };
    return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status] || colors.offline}`} />;
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-8">My Agents</h1>

        {/* Create Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Create New Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  placeholder="My AI Assistant"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-desc">Description</Label>
                <Textarea
                  id="agent-desc"
                  placeholder="What does this agent do?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create Agent"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Agent List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold">No agents yet</h2>
            <p className="text-sm text-muted-foreground">Create your first agent above</p>
          </div>
        ) : (
          <div className="space-y-4">
            {agents.map((item) => (
              <Card key={item.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                      {item.name?.[0]?.toUpperCase() || "A"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{item.name}</h3>
                        <span className="flex items-center gap-1.5">
                          {statusDot(item.status)}
                          <Badge variant={item.status === "online" ? "success" : item.status === "busy" ? "warning" : "secondary"} className="text-xs">
                            {item.status}
                          </Badge>
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{item.description || "No description"}</p>
                    </div>
                  </div>
                  <div className="shrink-0 ml-4">
                    {item.status !== "online" ? (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(item.id, "online")} className="text-green-600 border-green-200 hover:bg-green-50">
                        Go Online
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(item.id, "offline")}>
                        Go Offline
                      </Button>
                    )}
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
