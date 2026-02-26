"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type FormatSettings = {
  dateFormat: string;
  currency: string;
};

const DATE_FORMATS = [
  {
    value: "dd/MM/yyyy",
    label: "DD/MM/YYYY (15/02/2026)",
    example: "15/02/2026",
  },
  {
    value: "MM/dd/yyyy",
    label: "MM/DD/YYYY (02/15/2026)",
    example: "02/15/2026",
  },
  {
    value: "yyyy-MM-dd",
    label: "YYYY-MM-DD (2026-02-15)",
    example: "2026-02-15",
  },
];

const CURRENCIES = [
  // Southeast Asia
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong" },
  { code: "MMK", symbol: "K", name: "Myanmar Kyat" },
  { code: "KHR", symbol: "៛", name: "Cambodian Riel" },
  { code: "LAK", symbol: "₭", name: "Lao Kip" },
  { code: "BND", symbol: "B$", name: "Brunei Dollar" },
  // Major global
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
];

export function FormatsClient() {
  const [settings, setSettings] = useState<FormatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/organization/formats");

      if (!response.ok) {
        throw new Error("Failed to fetch format settings");
      }

      const data = await response.json();
      setSettings(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);

      const response = await fetch("/api/organization/formats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Date Format</CardTitle>
          <CardDescription>
            Choose how dates are displayed throughout the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dateFormat">Date Format</Label>
            <Select
              value={settings.dateFormat}
              onValueChange={(value) =>
                setSettings({ ...settings, dateFormat: value })
              }
            >
              <SelectTrigger id="dateFormat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Example:{" "}
              {
                DATE_FORMATS.find((f) => f.value === settings.dateFormat)
                  ?.example
              }
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency Format</CardTitle>
          <CardDescription>
            Choose your preferred currency and symbol
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              value={settings.currency}
              onValueChange={(value) => {
                setSettings({ ...settings, currency: value });
              }}
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name} ({curr.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Example: {CURRENCIES.find((c) => c.code === settings.currency)?.symbol}1,234.56
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
