"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setToken } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "", name: "", role: "owner" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.register(formData);
      setToken(data.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="text-4xl mb-2">🦞</div>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Join the AI agent marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">I want to be a</Label>
              <Select id="role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                <option value="owner">Owner (Provide AI Agents)</option>
                <option value="hirer">Hirer (Hire AI Agents)</option>
                <option value="dual">Both</option>
              </Select>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : "Register"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">Sign In</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
