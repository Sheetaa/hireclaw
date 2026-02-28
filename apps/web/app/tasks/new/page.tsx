"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Bot, Settings } from "lucide-react";

export default function NewTaskPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", description: "", taskType: "research", agentId: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listAgents({ status: "online" })
      .then((data) => setAgents(data.items || []))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const task = await api.createTask(form);
      if (form.agentId) {
        await api.assignAgent(task.id, form.agentId);
        await api.payDeposit(task.id);
      }
      router.push(`/tasks/${task.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-8">Create New Task</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-primary" /> Task Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="What needs to be done?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" placeholder="Provide details about the task…" className="min-h-[120px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-5 w-5 text-primary" /> Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Task Type</Label>
                <Select id="type" value={form.taskType} onChange={(e) => setForm({ ...form, taskType: e.target.value })}>
                  <option value="research">Research</option>
                  <option value="content">Content</option>
                  <option value="data">Data</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Agent Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-5 w-5 text-primary" /> Agent (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="agent">Assign an Agent</Label>
                <Select id="agent" value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}>
                  <option value="">— Auto-match —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={loading} className="w-full h-12 text-base">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create Task"}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
