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
  Copy01Icon,
  SecurityIcon,
  Settings01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type ApiKeyService =
  | "MAILERSEND_EMAIL"
  | "WHATSAPP_META"
  | "TELEGRAM_BOT"
  | "XENDIT";

type ApiKey = {
  id: string;
  service: ApiKeyService;
  lastFourChars: string;
  maskedValue: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};

const SERVICE_LABELS: Record<ApiKeyService, string> = {
  MAILERSEND_EMAIL: "MailerSend Email",
  WHATSAPP_META: "WhatsApp (Meta Cloud API)",
  TELEGRAM_BOT: "Telegram Bot",
  XENDIT: "Xendit Payment Gateway",
};

const SERVICE_DESCRIPTIONS: Record<ApiKeyService, string> = {
  MAILERSEND_EMAIL: "Email delivery via MailerSend API",
  WHATSAPP_META:
    "WhatsApp messaging via Meta Cloud API (requires JSON with accessToken and phoneNumberId)",
  TELEGRAM_BOT:
    "Telegram bot notifications using phone numbers (get your bot token from @BotFather in Telegram)",
  XENDIT:
    "Accept rent payments via Xendit. Provide your Xendit secret key and webhook token.",
};

export default function ApiKeysClient({ webhookUrl }: { webhookUrl: string }) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [keyDisplayDialogOpen, setKeyDisplayDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);

  const [newKeyData, setNewKeyData] = useState<{
    fullKey: string;
    maskedValue: string;
    service?: ApiKeyService;
  } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    service: "" as ApiKeyService | "",
    value: "",
    webhookToken: "",
  });
  const [deletePassword, setDeletePassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
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
      const value =
        formData.service === "XENDIT"
          ? JSON.stringify({
              secretKey: formData.value,
              webhookToken: formData.webhookToken,
            })
          : formData.value;

      const response = await fetch("/api/organization/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: formData.service,
          value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create API key");
      }

      setCreateDialogOpen(false);

      // Test connection immediately after creation — success/fail shown via toast
      const testPassed = await handleTestConnection(data.id, formData.service as ApiKeyService);
      if (!testPassed) {
        toast.warning("API key saved, but connection test failed. Check your credentials.");
      }

      // For Xendit, show the webhook URL setup dialog
      if (formData.service === "XENDIT") {
        setNewKeyData({
          fullKey: data.fullKey,
          maskedValue: data.maskedValue,
          service: formData.service as ApiKeyService,
        });
        setKeyDisplayDialogOpen(true);
      }

      // Reset form
      setFormData({ service: "", value: "", webhookToken: "" });

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
      const response = await fetch(
        `/api/organization/api-keys/${selectedKey.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword: deletePassword }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to delete API key");
        return;
      }

      setDeleteDialogOpen(false);
      setDeletePassword("");
      setSelectedKey(null);
      toast.success("API key deleted");
      await fetchApiKeys();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete API key",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestConnection(keyId: string, service: ApiKeyService): Promise<boolean> {
    setTesting(true);

    try {
      const response = await fetch(`/api/organization/api-keys/${keyId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Test failed");
        return false;
      } else {
        toast.success(data.data?.message || "Connection successful");
        await fetchApiKeys();
        return true;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
      return false;
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
    setFormData({ service: "", value: "", webhookToken: "" });
    setError(null);
    setCreateDialogOpen(true);
  }

  function openManageDialog(key: ApiKey) {
    setSelectedKey(key);
    setManageDialogOpen(true);
  }

  function openDeleteDialog(key: ApiKey) {
    setSelectedKey(key);
    setDeletePassword("");
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
                  <TableHead>Service</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
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
                      {formatDistanceToNow(new Date(key.createdAt), {
                        addSuffix: true,
                      })}
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
                          variant="ghost"
                          size="sm"
                          onClick={() => openManageDialog(key)}
                        >
                          <HugeiconsIcon icon={Settings01Icon} className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(key)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              <Label htmlFor="service">Service</Label>
              <Select
                value={formData.service}
                onValueChange={(value) =>
                  setFormData({
                    service: value as ApiKeyService,
                    value: "",
                    webhookToken: "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_LABELS).map(([value, label]) => {
                    const taken = apiKeys.some((k) => k.service === value);
                    return (
                      <SelectItem key={value} value={value} disabled={taken}>
                        {label}{taken ? " (already added)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {formData.service && (
                <p className="text-xs text-muted-foreground">
                  {SERVICE_DESCRIPTIONS[formData.service]}
                </p>
              )}
            </div>

            {formData.service === "XENDIT" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="value">Secret Key</Label>
                  <Input
                    id="value"
                    type="password"
                    placeholder="xnd_..."
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhookToken">Webhook Token</Label>
                  <Input
                    id="webhookToken"
                    type="password"
                    placeholder="Your Xendit callback token"
                    value={formData.webhookToken}
                    onChange={(e) =>
                      setFormData({ ...formData, webhookToken: e.target.value })
                    }
                    autoComplete="off"
                  />
                </div>
                <Alert>
                  <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
                  <AlertDescription className="text-xs space-y-2">
                    <p>
                      Find your <strong>Secret Key</strong> in Xendit Dashboard
                      → Settings → API Keys. Find your{" "}
                      <strong>Webhook Token</strong> in Xendit Dashboard →
                      Settings → Webhooks → Callback Token.
                    </p>
                    <p>
                      Register this webhook URL in Xendit Dashboard → Settings →
                      Webhooks → Invoice paid:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted px-2 py-1 rounded break-all">
                        {webhookUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(webhookUrl)}
                      >
                        <HugeiconsIcon icon={Copy01Icon} className="h-4 w-4" />
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="value">
                    {formData.service === "MAILERSEND_EMAIL"
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
                        formData.service === "MAILERSEND_EMAIL"
                          ? "mlsn...."
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
                      <code>accessToken</code> and <code>phoneNumberId</code>{" "}
                      from your Meta Business account.
                    </AlertDescription>
                  </Alert>
                )}

                {formData.service === "TELEGRAM_BOT" && (
                  <Alert>
                    <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      To create a Telegram bot: Open Telegram, search for{" "}
                      <code>@BotFather</code>, send <code>/newbot</code>, and
                      follow the instructions. You&apos;ll receive a bot token
                      that looks like <code>123456789:ABCdef...</code>. Tenants
                      will use their phone numbers for Telegram notifications.
                    </AlertDescription>
                  </Alert>
                )}
              </>
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
                !formData.service ||
                !formData.value ||
                (formData.service === "XENDIT" && !formData.webhookToken) ||
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
              Your API key has been saved. Complete the setup below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {newKeyData?.service === "XENDIT" && (
              <div className="space-y-2">
                <Label>Xendit Webhook URL</Label>
                <p className="text-xs text-muted-foreground">
                  Register this URL in your Xendit Dashboard → Settings →
                  Webhooks → Invoice paid.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-xs break-all">
                    {webhookUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl)}
                  >
                    <HugeiconsIcon icon={Copy01Icon} className="h-4 w-4" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setKeyDisplayDialogOpen(false);
                setNewKeyData(null);
                fetchApiKeys();
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {selectedKey ? SERVICE_LABELS[selectedKey.service] : "Manage Key"}
            </DialogTitle>
            <DialogDescription>
              {selectedKey && (
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {selectedKey.maskedValue}
                </code>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedKey?.service === "XENDIT" && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Webhook Setup</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Open your Xendit Dashboard</li>
                  <li>Go to Settings → Webhooks</li>
                  <li>
                    Under <strong>Invoice paid</strong>, register this URL:
                  </li>
                </ol>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-2 py-1.5 rounded text-xs break-all">
                    {webhookUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl)}
                  >
                    <HugeiconsIcon icon={Copy01Icon} className="h-4 w-4" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <ol
                  className="text-sm text-muted-foreground space-y-1 list-decimal list-inside"
                  start={4}
                >
                  <li>
                    Copy the <strong>Callback Token</strong> from Xendit →
                    Settings → Webhooks and make sure it matches what you
                    entered.
                  </li>
                </ol>
              </div>
            )}

            {selectedKey?.service === "MAILERSEND_EMAIL" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Setup Guide</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Log in to MailerSend and go to your domain settings.</li>
                  <li>Verify your sending domain (add DNS records).</li>
                  <li>Generate an API token under API Tokens.</li>
                </ol>
              </div>
            )}

            {selectedKey?.service === "TELEGRAM_BOT" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Setup Guide</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>
                    Open Telegram and search for <code>@BotFather</code>.
                  </li>
                  <li>
                    Send <code>/newbot</code> and follow the prompts.
                  </li>
                  <li>Copy the bot token you receive.</li>
                  <li>
                    Tenants must start a chat with your bot before they can
                    receive notifications.
                  </li>
                </ol>
              </div>
            )}

            {selectedKey?.service === "WHATSAPP_META" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Setup Guide</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Go to Meta for Developers and create a WhatsApp app.</li>
                  <li>Add a phone number and get it verified.</li>
                  <li>
                    Copy the <code>accessToken</code> and{" "}
                    <code>phoneNumberId</code> from the app dashboard.
                  </li>
                </ol>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setManageDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={async () => {
                if (!selectedKey) return;
                await handleTestConnection(selectedKey.id, selectedKey.service);
              }}
              disabled={testing}
            >
              {testing ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="mr-2 h-4 w-4 animate-spin"
                  />
                  Testing...
                </>
              ) : (
                <>
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    className="mr-2 h-4 w-4"
                  />
                  Test Connection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              This will permanently delete the{" "}
              {selectedKey ? SERVICE_LABELS[selectedKey.service] : "API"} key.
              Enter your password to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="password"
              placeholder="Your password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDelete()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!deletePassword || submitting}
            >
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
