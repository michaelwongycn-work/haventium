"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon } from "@hugeicons/core-free-icons";
import { OverviewClient } from "./overview-client";
import AnalyticsClient from "../analytics/analytics-client";
import CalendarClient from "../calendar/calendar-client";

function UpgradeCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="max-w-md mx-auto mt-12">
      <CardHeader>
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={LockIcon} className="h-5 w-5 text-muted-foreground" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => window.location.href = "/subscribe"}>Upgrade Plan</Button>
      </CardContent>
    </Card>
  );
}

export function DashboardClient({ userName, features }: { userName: string; features: string[] }) {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const hasAnalytics = features.includes("ANALYTICS");
  const hasCalendar = features.includes("CALENDAR");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {userName}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics {!hasAnalytics && "🔒"}</TabsTrigger>
          <TabsTrigger value="calendar">Calendar {!hasCalendar && "🔒"}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewClient />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          {hasAnalytics ? (
            <AnalyticsClient />
          ) : (
            <UpgradeCard
              title="Analytics"
              description="Analytics is not included in your current plan. Upgrade to view revenue, occupancy, and payment trends."
            />
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          {hasCalendar ? (
            <CalendarClient />
          ) : (
            <UpgradeCard
              title="Calendar"
              description="Calendar is not included in your current plan. Upgrade to view lease timelines and payment schedules visually."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
