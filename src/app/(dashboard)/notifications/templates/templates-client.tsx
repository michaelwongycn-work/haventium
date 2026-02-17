"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
  Mail01Icon,
  Notification03Icon,
} from "@hugeicons/core-free-icons"

type NotificationTrigger =
  | "PAYMENT_REMINDER"
  | "PAYMENT_LATE"
  | "PAYMENT_CONFIRMED"
  | "LEASE_EXPIRING"
  | "LEASE_EXPIRED"
  | "MANUAL"

type NotificationChannel = "EMAIL" | "WHATSAPP" | "TELEGRAM"

type NotificationTemplate = {
  id: string
  name: string
  trigger: NotificationTrigger
  channel: NotificationChannel
  subject: string | null
  body: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const TRIGGER_LABELS: Record<NotificationTrigger, string> = {
  PAYMENT_REMINDER: "Payment Reminder",
  PAYMENT_LATE: "Payment Late",
  PAYMENT_CONFIRMED: "Payment Confirmed",
  LEASE_EXPIRING: "Lease Expiring",
  LEASE_EXPIRED: "Lease Expired",
  MANUAL: "Manual",
}

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
}

const TEMPLATE_VARIABLES = [
  { name: "{{tenantName}}", description: "Tenant's full name" },
  { name: "{{leaseStartDate}}", description: "Lease start date" },
  { name: "{{leaseEndDate}}", description: "Lease end date" },
  { name: "{{rentAmount}}", description: "Lease rent amount" },
  { name: "{{propertyName}}", description: "Property name" },
  { name: "{{unitName}}", description: "Unit name" },
]

export default function NotificationTemplatesClient() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<NotificationTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    trigger: "PAYMENT_REMINDER" as NotificationTrigger,
    channel: "EMAIL" as NotificationChannel,
    subject: "",
    body: "",
    isActive: true,
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/notifications/templates")
      if (!response.ok) throw new Error("Failed to fetch templates")
      const data = await response.json()
      setTemplates(data)
    } catch (err) {
      console.error("Error fetching templates:", err)
      setError("Failed to load notification templates")
    } finally {
      setIsLoading(false)
    }
  }

  const openCreateDialog = () => {
    setEditingTemplate(null)
    setFormData({
      name: "",
      trigger: "PAYMENT_REMINDER",
      channel: "EMAIL",
      subject: "",
      body: "",
      isActive: true,
    })
    setError(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (template: NotificationTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      trigger: template.trigger,
      channel: template.channel,
      subject: template.subject || "",
      body: template.body,
      isActive: template.isActive,
    })
    setError(null)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)

      // Validate required fields
      if (!formData.name.trim()) {
        setError("Template name is required")
        return
      }

      if (!formData.body.trim()) {
        setError("Template body is required")
        return
      }

      if (formData.channel === "EMAIL" && !formData.subject.trim()) {
        setError("Subject is required for email notifications")
        return
      }

      const url = editingTemplate
        ? `/api/notifications/templates/${editingTemplate.id}`
        : "/api/notifications/templates"

      const response = await fetch(url, {
        method: editingTemplate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save template")
      }

      await fetchTemplates()
      setIsDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteDialog = (template: NotificationTemplate) => {
    setDeletingTemplate(template)
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingTemplate) return

    try {
      const response = await fetch(
        `/api/notifications/templates/${deletingTemplate.id}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete template")
      }

      await fetchTemplates()
      setIsDeleteDialogOpen(false)
      setDeletingTemplate(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template")
    }
  }

  const insertVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      body: prev.body + variable,
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification Templates</h1>
          <p className="text-muted-foreground">
            Manage email and WhatsApp notification templates
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <HugeiconsIcon icon={PlusSignIcon} className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {error && !isDialogOpen && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            Create reusable templates for automated notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HugeiconsIcon
                icon={Notification03Icon}
                className="mb-4 h-12 w-12 text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                No notification templates yet. Create your first template to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{TRIGGER_LABELS[template.trigger]}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <HugeiconsIcon
                          icon={Mail01Icon}
                          className="mr-1 h-3 w-3"
                        />
                        {CHANNEL_LABELS[template.channel]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {template.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(template)}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(template)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the notification template details"
                : "Create a new notification template"}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Payment Reminder Email"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="trigger">Trigger</Label>
                <Select
                  value={formData.trigger}
                  onValueChange={(value: NotificationTrigger) =>
                    setFormData({ ...formData, trigger: value })
                  }
                >
                  <SelectTrigger id="trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="channel">Channel</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(value: NotificationChannel) =>
                    setFormData({ ...formData, channel: value })
                  }
                >
                  <SelectTrigger id="channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.channel === "EMAIL" && (
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  placeholder="e.g., Payment Reminder - {{propertyName}}"
                />
              </div>
            )}

            <div>
              <Label htmlFor="body">Message Body</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
                placeholder="Enter your message here. Use variables like {{tenantName}} for dynamic content."
                rows={8}
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Available Variables</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <Button
                    key={v.name}
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => insertVariable(v.name)}
                    title={v.description}
                  >
                    {v.name}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Click to insert variables into your message
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
