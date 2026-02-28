"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon } from "@hugeicons/core-free-icons";
import NotificationTemplatesClient from "./templates/templates-client";
import NotificationRulesClient from "./rules/rules-client";
import NotificationLogsClient from "./logs/logs-client";

function NotificationsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab =
    tabParam && ["templates", "rules", "logs"].includes(tabParam)
      ? tabParam
      : "templates";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-muted-foreground mt-1">
          Manage notification templates, rules, and logs
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          <NotificationTemplatesClient />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <NotificationRulesClient />
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <NotificationLogsClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function NotificationsClient({ features }: { features: string[] }) {
  if (!features.includes("REMINDER")) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={LockIcon} className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>
            Notifications are not included in your current plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Upgrade your subscription to send automated notifications to your tenants via email, WhatsApp, and Telegram.
          </p>
          <Button onClick={() => window.location.href = "/subscribe"}>Upgrade Plan</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NotificationsContent />
    </Suspense>
  );
}
