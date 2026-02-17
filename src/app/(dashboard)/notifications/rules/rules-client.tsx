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
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
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

type NotificationRecipient = "TENANT" | "USER" | "ROLE"

type NotificationRule = {
  id: string
  name: string
  trigger: NotificationTrigger
  daysOffset: number
  channels: NotificationChannel[]
  recipientType: NotificationRecipient
  recipientUserId: string | null
  recipientRoleId: string | null
  recipientUser?: {
    id: string
    name: string
    email: string
  } | null
  recipientRole?: {
    id: string
    name: string
  } | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type User = {
  id: string
  name: string
  email: string
}

type Role = {
  id: string
  name: string
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

const RECIPIENT_TYPE_LABELS: Record<NotificationRecipient, string> = {
  TENANT: "Tenant",
  USER: "User",
  ROLE: "Role",
}

export default function NotificationRulesClient() {
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<NotificationRule | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    trigger: "PAYMENT_REMINDER" as NotificationTrigger,
    daysOffset: 0,
    channels: ["EMAIL"] as NotificationChannel[],
    recipientType: "TENANT" as NotificationRecipient,
    recipientUserId: "",
    recipientRoleId: "",
    isActive: true,
  })

  useEffect(() => {
    fetchRules()
    fetchUsers()
    fetchRoles()
  }, [])

  const fetchRules = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/notifications/rules")
      if (!response.ok) throw new Error("Failed to fetch rules")
      const data = await response.json()
      setRules(data)
    } catch (err) {
      console.error("Error fetching rules:", err)
      setError("Failed to load notification rules")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      if (!response.ok) throw new Error("Failed to fetch users")
      const data = await response.json()
      setUsers(data)
    } catch (err) {
      console.error("Error fetching users:", err)
    }
  }

  const fetchRoles = async () => {
    try {
      const response = await fetch("/api/roles")
      if (!response.ok) throw new Error("Failed to fetch roles")
      const data = await response.json()
      setRoles(data)
    } catch (err) {
      console.error("Error fetching roles:", err)
    }
  }

  const openCreateDialog = () => {
    setEditingRule(null)
    setFormData({
      name: "",
      trigger: "PAYMENT_REMINDER",
      daysOffset: 0,
      channels: ["EMAIL"],
      recipientType: "TENANT",
      recipientUserId: "",
      recipientRoleId: "",
      isActive: true,
    })
    setError(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (rule: NotificationRule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      trigger: rule.trigger,
      daysOffset: rule.daysOffset,
      channels: rule.channels,
      recipientType: rule.recipientType,
      recipientUserId: rule.recipientUserId || "",
      recipientRoleId: rule.recipientRoleId || "",
      isActive: rule.isActive,
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
        setError("Rule name is required")
        return
      }

      if (formData.channels.length === 0) {
        setError("At least one channel is required")
        return
      }

      if (formData.recipientType === "USER" && !formData.recipientUserId) {
        setError("Please select a user")
        return
      }

      if (formData.recipientType === "ROLE" && !formData.recipientRoleId) {
        setError("Please select a role")
        return
      }

      const payload = {
        ...formData,
        recipientUserId: formData.recipientType === "USER" ? formData.recipientUserId : null,
        recipientRoleId: formData.recipientType === "ROLE" ? formData.recipientRoleId : null,
      }

      const url = editingRule
        ? `/api/notifications/rules/${editingRule.id}`
        : "/api/notifications/rules"

      const response = await fetch(url, {
        method: editingRule ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save rule")
      }

      await fetchRules()
      setIsDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rule")
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteDialog = (rule: NotificationRule) => {
    setDeletingRule(rule)
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingRule) return

    try {
      const response = await fetch(`/api/notifications/rules/${deletingRule.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete rule")
      }

      await fetchRules()
      setIsDeleteDialogOpen(false)
      setDeletingRule(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule")
    }
  }

  const toggleChannel = (channel: NotificationChannel) => {
    setFormData((prev) => {
      const channels = prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel]
      return { ...prev, channels }
    })
  }

  const getRecipientDisplay = (rule: NotificationRule) => {
    if (rule.recipientType === "TENANT") {
      return "All Tenants"
    }
    if (rule.recipientType === "USER" && rule.recipientUser) {
      return rule.recipientUser.name
    }
    if (rule.recipientType === "ROLE" && rule.recipientRole) {
      return rule.recipientRole.name
    }
    return "Unknown"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification Rules</h1>
          <p className="text-muted-foreground">
            Configure automated notification triggers
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <HugeiconsIcon icon={PlusSignIcon} className="mr-2 h-4 w-4" />
          Create Rule
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
          <CardTitle>Rules</CardTitle>
          <CardDescription>
            Define when and how notifications are sent automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HugeiconsIcon
                icon={Notification03Icon}
                className="mb-4 h-12 w-12 text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                No notification rules yet. Create your first rule to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Days Offset</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>{TRIGGER_LABELS[rule.trigger]}</TableCell>
                    <TableCell>
                      {rule.daysOffset > 0
                        ? `+${rule.daysOffset} days`
                        : rule.daysOffset < 0
                        ? `${rule.daysOffset} days`
                        : "Same day"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {rule.channels.map((channel) => (
                          <Badge key={channel} variant="outline">
                            {CHANNEL_LABELS[channel]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {RECIPIENT_TYPE_LABELS[rule.recipientType]}
                        </div>
                        <div className="text-muted-foreground">
                          {getRecipientDisplay(rule)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {rule.isActive ? (
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
                          onClick={() => openEditDialog(rule)}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(rule)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Rule" : "Create Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update the notification rule details"
                : "Create a new automated notification rule"}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Payment Reminder 7 Days Before"
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
                <Label htmlFor="daysOffset">Days Offset</Label>
                <Input
                  id="daysOffset"
                  type="number"
                  value={formData.daysOffset}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      daysOffset: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Negative for before, positive for after
                </p>
              </div>
            </div>

            <div>
              <Label>Channels</Label>
              <div className="mt-2 space-y-2">
                {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`channel-${value}`}
                      checked={formData.channels.includes(
                        value as NotificationChannel
                      )}
                      onCheckedChange={() =>
                        toggleChannel(value as NotificationChannel)
                      }
                    />
                    <Label
                      htmlFor={`channel-${value}`}
                      className="font-normal cursor-pointer"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="recipientType">Recipient Type</Label>
              <Select
                value={formData.recipientType}
                onValueChange={(value: NotificationRecipient) =>
                  setFormData({ ...formData, recipientType: value })
                }
              >
                <SelectTrigger id="recipientType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RECIPIENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.recipientType === "USER" && (
              <div>
                <Label htmlFor="recipientUserId">Select User</Label>
                <Select
                  value={formData.recipientUserId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, recipientUserId: value })
                  }
                >
                  <SelectTrigger id="recipientUserId">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.recipientType === "ROLE" && (
              <div>
                <Label htmlFor="recipientRoleId">Select Role</Label>
                <Select
                  value={formData.recipientRoleId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, recipientRoleId: value })
                  }
                >
                  <SelectTrigger id="recipientRoleId">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              {isSaving ? "Saving..." : editingRule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingRule?.name}&quot;? This
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
