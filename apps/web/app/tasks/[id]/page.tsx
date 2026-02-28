"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertCircle, MinusCircle, DollarSign, ThumbsUp, ThumbsDown, Minus, Gift } from "lucide-react";

const STATUS_STEPS = ["created", "deposit_paid", "accepted", "delivered", "base_fee_paid", "closed"];

function statusVariant(status: string): "default" | "secondary" | "success" | "warning" | "destructive" {
  if (["closed", "satisfied"].includes(status)) return "success";
  if (["delivered", "base_fee_paid"].includes(status)) return "warning";
  if (["unsatisfied"].includes(status)) return "destructive";
  return "secondary";
}

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tipAmount, setTipAmount] = useState(19);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getTask(taskId)
      .then(setTask)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [taskId]);

  const handleFeedback = async (type: string) => {
    setSubmitting(true);
    try {
      await api.submitFeedback(taskId, type);
      const updated = await api.getTask(taskId);
      setTask(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTip = async () => {
    setSubmitting(true);
    try {
      await api.tip(taskId, tipAmount);
      alert("Tip sent!");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!task) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold">Task not found</h2>
        </div>
      </AppLayout>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(task.status);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <Badge variant={statusVariant(task.status)} className="w-fit text-sm px-3 py-1">
            {task.status?.replace(/_/g, " ")}
          </Badge>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((step, i) => {
                const done = i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <div key={step} className="flex flex-col items-center flex-1 relative">
                    {i > 0 && (
                      <div className={`absolute top-3 -left-1/2 right-1/2 h-0.5 ${i <= currentStep ? "bg-primary" : "bg-muted"}`} />
                    )}
                    <div className={`relative z-10 flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"} ${isCurrent ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1.5 text-center hidden sm:block">
                      {step.replace(/_/g, " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Task Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{task.description}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Type: {task.taskType}</Badge>
              {task.depositAmount && (
                <Badge variant="success" className="gap-1">
                  <DollarSign className="h-3 w-3" /> Deposit: ¥{task.depositAmount}
                </Badge>
              )}
              {task.baseFee && (
                <Badge variant="secondary" className="gap-1">
                  <DollarSign className="h-3 w-3" /> Fee: ¥{task.baseFee}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Feedback */}
        {task.status === "base_fee_paid" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How was the result?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => handleFeedback("satisfied")}
                  disabled={submitting}
                  className="flex-col h-auto py-4 bg-green-600 hover:bg-green-700"
                >
                  <ThumbsUp className="h-5 w-5 mb-1" />
                  Satisfied
                </Button>
                <Button
                  onClick={() => handleFeedback("partial")}
                  disabled={submitting}
                  variant="outline"
                  className="flex-col h-auto py-4 text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                >
                  <Minus className="h-5 w-5 mb-1" />
                  Partial
                </Button>
                <Button
                  onClick={() => handleFeedback("unsatisfied")}
                  disabled={submitting}
                  variant="destructive"
                  className="flex-col h-auto py-4"
                >
                  <ThumbsDown className="h-5 w-5 mb-1" />
                  Unsatisfied
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tip */}
        {["satisfied", "partial", "closed"].includes(task.status) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-5 w-5 text-primary" /> Send a Tip
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[3, 9, 19].map((amount) => (
                  <Button
                    key={amount}
                    variant={tipAmount === amount ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTipAmount(amount)}
                  >
                    ¥{amount}
                  </Button>
                ))}
                <Input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(Number(e.target.value))}
                  className="w-24"
                  min={1}
                  max={200}
                />
              </div>
              <Button onClick={handleTip} disabled={submitting} className="w-full">
                Send ¥{tipAmount} Tip
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
