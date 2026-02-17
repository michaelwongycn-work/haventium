"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
  KeyIcon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  SecurityIcon,
} from "@hugeicons/core-free-icons";
import { formatDistanceToNow } from "date-fns";

type ApiKeyService = "RESEND_EMAIL" | "WHATSAPP_META" | "TELEGRAM_BOT";

type ApiKey = {
  id: string;
  name: string;
  service: ApiKeyService;
  lastFourChars: string;
  maskedValue: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};

const SERVICE_LABELS: Record<ApiKeyService, string> = {
  RESEND_EMAIL: "Resend Email",
  WHATSAPP_META: "WhatsApp (Meta Cloud API)",
  TELEGRAM_BOT: "Telegram Bot",
};

const SERVICE_DESCRIPTIONS: Record<ApiKeyService, string> = {
  RESEND_EMAIL: "Email delivery via Resend API",
  WHATSAPP_META:
    "WhatsApp messaging via Meta Cloud API (requires JSON with accessToken and phoneNumberId)",
  TELEGRAM_BOT:
    "Telegram bot notifications using phone numbers (get your bot token from @BotFather in Telegram)",
};

export default function ApiKeysClient() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyDisplayDialogOpen, setKeyDisplayDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKeyData, setNewKeyData] = useState<{
    fullKey: string;
    maskedValue: string;
  } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    service: "" as ApiKeyService | "",
    value: "",
  });
  const [deletePassword, setDeletePassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  async function fetchApiKeys() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/organization/api-keys");
      if (!response.ok) {
        throw new Error("Failed to fetch API keys");
      }
      const data = await response.json();
      setApiKeys(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch API keys");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/organization/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create API key");
      }

      // Store the full key to show once
      setNewKeyData({
        fullKey: data.data.fullKey,
        maskedValue: data.data.maskedValue,
      });

      // Close create dialog and open key display dialog
      setCreateDialogOpen(false);
      setKeyDisplayDialogOpen(true);

      // Reset form
      setFormData({ name: "", service: "", value: "" });

      // Refresh list
      await fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedKey) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/organization/api-keys/${selectedKey.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: deletePassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete API key");
      }

      setDeleteDialogOpen(false);
      setDeletePassword("");
      setSelectedKey(null);
      await fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete API key");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestConnection(keyId: string) {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`/api/organization/api-keys/${keyId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Test failed");
      }

      setTestResult(data.data);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openCreateDialog() {
    setFormData({ name: "", service: "", value: "" });
    setError(null);
    setTestResult(null);
    setCreateDialogOpen(true);
  }

  function openDeleteDialog(key: ApiKey) {
    setSelectedKey(key);
    setDeletePassword("");
    setError(null);
    setDeleteDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Warning */}
      <Alert>
        <HugeiconsIcon icon={SecurityIcon} className="h-4 w-4" />
        <AlertDescription>
          API keys are encrypted and stored securely. You&apos;ll only see the
          full key once when created. Make sure to save it in a secure location.
        </AlertDescription>
      </Alert>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage your organization&apos;s API keys for email, WhatsApp,
                and Telegram notifications
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <HugeiconsIcon icon={PlusSignIcon} className="mr-2 h-4 w-4" />
              Add API Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <HugeiconsIcon
                icon={KeyIcon}
                className="mx-auto h-12 w-12 text-muted-foreground"
              />
              <h3 className="mt-4 text-lg font-semibold">No API keys</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Add your first API key to start sending notifications
              </p>
              <Button onClick={openCreateDialog} className="mt-4">
                <HugeiconsIcon icon={PlusSignIcon} className="mr-2 h-4 w-4" />
                Add API Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>{SERVICE_LABELS[key.service]}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {key.maskedValue}
                      </code>
                    </TableCell>
                    <TableCell>
                      {key.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.lastUsedAt
                        ? formatDistanceToNow(new Date(key.lastUsedAt), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(key.id)}
                          disabled={testing}
                        >
                          {testing ? "Testing..." : "Test"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(key)}
                        >
                          <HugeiconsIcon
                            icon={Delete02Icon}
                            className="h-4 w-4 text-destructive"
                          />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {testResult && (
            <Alert
              variant={testResult.success ? "default" : "destructive"}
              className="mt-4"
            >
              <HugeiconsIcon
                icon={
                  testResult.success ? CheckmarkCircle02Icon : AlertCircleIcon
                }
                className="h-4 w-4"
              />
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
            <DialogDescription>
              Add a new API key for your organization. Choose the service and
              provide the required credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Production Email"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service">Service</Label>
              <Select
                value={formData.service}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    service: value as ApiKeyService,
                    value: "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.service && (
                <p className="text-xs text-muted-foreground">
                  {SERVICE_DESCRIPTIONS[formData.service]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">
                {formData.service === "RESEND_EMAIL"
                  ? "API Key"
                  : formData.service === "WHATSAPP_META"
                    ? "Credentials (JSON)"
                    : formData.service === "TELEGRAM_BOT"
                      ? "Bot Token"
                      : "API Key / Credentials"}
              </Label>
              {formData.service === "WHATSAPP_META" ? (
                <Textarea
                  id="value"
                  placeholder='{"accessToken":"EAA...", "phoneNumberId":"123..."}'
                  value={formData.value}
                  onChange={(e) =>
                    setFormData({ ...formData, value: e.target.value })
                  }
                  rows={4}
                  className="font-mono text-xs"
                  autoComplete="off"
                />
              ) : (
                <Input
                  id="value"
                  type="password"
                  placeholder={
                    formData.service === "RESEND_EMAIL"
                      ? "re_..."
                      : formData.service === "TELEGRAM_BOT"
                        ? "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                        : ""
                  }
                  value={formData.value}
                  onChange={(e) =>
                    setFormData({ ...formData, value: e.target.value })
                  }
                  autoComplete="off"
                />
              )}
            </div>

            {formData.service === "WHATSAPP_META" && (
              <Alert>
                <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  For WhatsApp Meta Cloud API, provide a JSON object with{" "}
                  <code>accessToken</code> and <code>phoneNumberId</code> from
                  your Meta Business account.
                </AlertDescription>
              </Alert>
            )}

            {formData.service === "TELEGRAM_BOT" && (
              <Alert>
                <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  To create a Telegram bot: Open Telegram, search for{" "}
                  <code>@BotFather</code>, send <code>/newbot</code>, and follow
                  the instructions. You&apos;ll receive a bot token that looks
                  like <code>123456789:ABCdef...</code>. Tenants will use their
                  phone numbers for Telegram notifications.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !formData.name ||
                !formData.service ||
                !formData.value ||
                submitting
              }
            >
              {submitting ? "Creating..." : "Create API Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key Display Dialog (shown once after creation) */}
      <Dialog
        open={keyDisplayDialogOpen}
        onOpenChange={setKeyDisplayDialogOpen}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>API Key Created Successfully</DialogTitle>
            <DialogDescription>
              Save this API key now. You won&apos;t be able to see it again!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
              <AlertDescription>
                This is the only time you&apos;ll see the full key. Make sure to
                copy and store it securely.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Your API Key</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-xs break-all">
                  {newKeyData?.fullKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(newKeyData?.fullKey || "")}
                >
                  <HugeiconsIcon icon={Copy01Icon} className="h-4 w-4" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setKeyDisplayDialogOpen(false);
                setNewKeyData(null);
              }}
            >
              I&apos;ve Saved the Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the API key &ldquo;
              {selectedKey?.name}&rdquo;. Notifications using this key will
              fail. Enter your password to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="password">Current Password</Label>
            <Input
              id="password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!deletePassword || submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "Deleting..." : "Delete API Key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
