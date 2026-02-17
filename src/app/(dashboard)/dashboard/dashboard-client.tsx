"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewClient } from "./overview-client";
import AnalyticsClient from "../analytics/analytics-client";
import CalendarClient from "../calendar/calendar-client";

export function DashboardClient({ userName }: { userName: string }) {
  const [activeTab, setActiveTab] = useState<string>("overview");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {userName}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewClient />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <AnalyticsClient />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <CalendarClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}
