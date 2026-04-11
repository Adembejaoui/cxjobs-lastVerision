import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Plus, Trash2, Mail, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function CandidateAlertsPage() {
  const session = await auth();

  if (!session || session.user.role !== "CANDIDATE") {
    redirect("/login");
  }

  // Mock alerts data - in real app, fetch from database
  const alerts: any[] = [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Job Alerts</h1>
          <p className="text-slate-600">Manage your job alert notifications</p>
        </div>
        <Button className="bg-[#071738] hover:bg-[#0d224d] text-white">
          <Plus className="mr-2 h-4 w-4" />
          Create New Alert
        </Button>
      </div>

      {/* Alerts List */}
      {alerts.length > 0 ? (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className={`rounded-full p-3 ${alert.active ? "bg-[#47d79d]/10" : "bg-slate-100"}`}>
                      <Bell className={`h-6 w-6 ${alert.active ? "text-[#47d79d]" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{alert.title}</h3>
                      <p className="text-sm text-slate-500">{alert.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {alert.keywords.map((keyword: string, i: number) => (
                          <span key={i} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {alert.frequency === "daily" ? "Daily" : alert.frequency === "weekly" ? "Weekly" : "Instant"} notifications
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                      alert.active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"
                    }`}>
                      {alert.active ? "Active" : "Paused"}
                    </span>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-slate-100 p-4">
              <BellOff className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No job alerts yet</h3>
            <p className="mt-2 text-center text-sm text-slate-500">
              Create job alerts to get notified when new positions match your criteria
            </p>
            <Button className="mt-6 bg-[#071738] hover:bg-[#0d224d] text-white">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Alert
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-[#071738] to-[#0d224d]">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="rounded-full bg-white/10 p-3">
              <Mail className="h-6 w-6 text-[#47d79d]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">How Job Alerts Work</h3>
              <p className="mt-2 text-sm text-white/80">
                Job alerts send you email notifications when new positions match your saved search criteria. 
                You can customize the frequency and keywords for each alert.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
