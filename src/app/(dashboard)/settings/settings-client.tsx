"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PasswordInput } from "@/components/ui/password-input";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";

// ========================================
// Types
// ========================================

type Access = {
  id: string;
  resource: string;
  action: string;
};

type RoleAccess = {
  id: string;
  accessId: string;
  access: Access;
};

type Role = {
  id: string;
  name: string;
  isSystem: boolean;
  roleAccesses: RoleAccess[];
  _count: {
    userRoles: number;
  };
};

type UserRole = {
  id: string;
  role: {
    id: string;
    name: string;
  };
};

type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  userRoles: UserRole[];
};

// ========================================
// Helpers
// ========================================

function groupAccessesByResource(accesses: Access[]) {
  const groups: Record<string, Access[]> = {};
  for (const access of accesses) {
    if (!groups[access.resource]) {
      groups[access.resource] = [];
    }
    groups[access.resource].push(access);
  }
  return groups;
}

// ========================================
// Page Component
// ========================================

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState<"roles" | "users">("roles");
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [accesses, setAccesses] = useState<Access[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Role dialog state
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [selectedAccessIds, setSelectedAccessIds] = useState<string[]>([]);

  // Role delete dialog state
  const [isDeleteRoleDialogOpen, setIsDeleteRoleDialogOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  // User dialog state
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRoleId, setUserRoleId] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  // User delete dialog state
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteCurrentPassword, setDeleteCurrentPassword] = useState("");

  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [rolesRes, usersRes, accessesRes] = await Promise.all([
        fetch("/api/roles"),
        fetch("/api/users"),
        fetch("/api/accesses"),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.items || rolesData);
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.items || usersData);
      }
      if (accessesRes.ok) {
        const accessesData = await accessesRes.json();
        setAccesses(accessesData.items || accessesData);
      }
    } catch {
      // silently fail, data will be empty
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================
  // Role Handlers
  // ========================================

  const handleOpenRoleDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setSelectedAccessIds(role.roleAccesses.map((ra) => ra.accessId));
    } else {
      setEditingRole(null);
      setRoleName("");
      setSelectedAccessIds([]);
    }
    setError(null);
    setIsRoleDialogOpen(true);
  };

  const handleCloseRoleDialog = () => {
    setIsRoleDialogOpen(false);
    setEditingRole(null);
    setRoleName("");
    setSelectedAccessIds([]);
    setError(null);
  };

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      setError("Role name is required");
      return;
    }

    if (selectedAccessIds.length === 0) {
      setError("At least one permission is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : "/api/roles";
      const method = editingRole ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleName,
          accessIds: selectedAccessIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save role");
      }

      await fetchAll();
      handleCloseRoleDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDeleteRoleDialog = (role: Role) => {
    setDeletingRole(role);
    setDeleteError(null);
    setIsDeleteRoleDialogOpen(true);
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) return;

    setIsSaving(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/roles/${deletingRole.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setDeleteError(data.error || "Failed to delete role");
        setIsSaving(false);
        return;
      }

      await fetchAll();
      setIsDeleteRoleDialogOpen(false);
      setDeletingRole(null);
    } catch {
      setDeleteError("Failed to delete role");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAccess = (accessId: string) => {
    setSelectedAccessIds((prev) =>
      prev.includes(accessId)
        ? prev.filter((id) => id !== accessId)
        : [...prev, accessId],
    );
  };

  const toggleResourceGroup = (resourceAccesses: Access[]) => {
    const allSelected = resourceAccesses.every((a) =>
      selectedAccessIds.includes(a.id),
    );
    if (allSelected) {
      setSelectedAccessIds((prev) =>
        prev.filter((id) => !resourceAccesses.some((a) => a.id === id)),
      );
    } else {
      setSelectedAccessIds((prev) => {
        const newIds = new Set(prev);
        for (const a of resourceAccesses) newIds.add(a.id);
        return Array.from(newIds);
      });
    }
  };

  // ========================================
  // User Handlers
  // ========================================

  const handleOpenUserDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setUserName(user.name);
      setUserEmail(user.email);
      setUserPassword("");
      setUserRoleId(user.userRoles[0]?.role.id || "");
    } else {
      setEditingUser(null);
      setUserName("");
      setUserEmail("");
      setUserPassword("");
      setUserRoleId("");
    }
    setCurrentPassword("");
    setError(null);
    setIsUserDialogOpen(true);
  };

  const handleCloseUserDialog = () => {
    setIsUserDialogOpen(false);
    setEditingUser(null);
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserRoleId("");
    setCurrentPassword("");
    setError(null);
  };

  const handleSaveUser = async () => {
    if (!userName.trim()) {
      setError("Name is required");
      return;
    }

    if (!userEmail.trim()) {
      setError("Email is required");
      return;
    }

    if (!editingUser && !userPassword) {
      setError("Password is required");
      return;
    }

    if (!userRoleId) {
      setError("Role is required");
      return;
    }

    if (!currentPassword) {
      setError("Your password is required to confirm this action");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PATCH" : "POST";

      const body: Record<string, string> = {
        name: userName,
        email: userEmail,
        roleId: userRoleId,
        currentPassword,
      };

      if (!editingUser) {
        body.password = userPassword;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save user");
      }

      await fetchAll();
      handleCloseUserDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDeleteUserDialog = (user: User) => {
    setDeletingUser(user);
    setDeleteError(null);
    setDeleteCurrentPassword("");
    setIsDeleteUserDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    if (!deleteCurrentPassword) {
      setDeleteError("Your password is required to confirm this action");
      return;
    }

    setIsSaving(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/users/${deletingUser.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: deleteCurrentPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        setDeleteError(data.error || "Failed to delete user");
        setIsSaving(false);
        return;
      }

      await fetchAll();
      setIsDeleteUserDialogOpen(false);
      setDeletingUser(null);
      setDeleteCurrentPassword("");
    } catch {
      setDeleteError("Failed to delete user");
    } finally {
      setIsSaving(false);
    }
  };

  // ========================================
  // Render
  // ========================================

  const accessGroups = groupAccessesByResource(accesses);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage roles and team members
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setActiveTab("roles")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "roles"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Roles
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Users
        </button>
        <Link
          href="/settings/api-keys"
          className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
        >
          API Keys
        </Link>
      </div>

      {/* ======================================== */}
      {/* ROLES TAB */}
      {/* ======================================== */}
      {activeTab === "roles" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Roles</CardTitle>
                <CardDescription>
                  Manage roles and their permissions
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenRoleDialog()}>
                <HugeiconsIcon
                  icon={PlusSignIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Add Role
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-[120px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[60px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[40px]" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : roles.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium mb-2">No roles yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first role to assign permissions
                </p>
                <Button onClick={() => handleOpenRoleDialog()}>
                  <HugeiconsIcon
                    icon={PlusSignIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Add Role
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {role.roleAccesses.length}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {role._count.userRoles}
                      </TableCell>
                      <TableCell className="text-right">
                        {!role.isSystem && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenRoleDialog(role)}
                            >
                              <HugeiconsIcon
                                icon={PencilEdit02Icon}
                                strokeWidth={2}
                                className="h-4 w-4"
                              />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDeleteRoleDialog(role)}
                            >
                              <HugeiconsIcon
                                icon={Delete02Icon}
                                strokeWidth={2}
                                className="h-4 w-4"
                              />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ======================================== */}
      {/* USERS TAB */}
      {/* ======================================== */}
      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Manage users in your organization
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenUserDialog()}>
                <HugeiconsIcon
                  icon={PlusSignIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Invite User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-[120px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[180px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[80px]" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium mb-2">No team members</h3>
                <p className="text-muted-foreground mb-6">
                  Invite your first team member
                </p>
                <Button onClick={() => handleOpenUserDialog()}>
                  <HugeiconsIcon
                    icon={PlusSignIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Invite User
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.userRoles.map((ur) => ur.role.name).join(", ") ||
                          "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenUserDialog(user)}
                          >
                            <HugeiconsIcon
                              icon={PencilEdit02Icon}
                              strokeWidth={2}
                              className="h-4 w-4"
                            />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDeleteUserDialog(user)}
                          >
                            <HugeiconsIcon
                              icon={Delete02Icon}
                              strokeWidth={2}
                              className="h-4 w-4"
                            />
                            <span className="sr-only">Delete</span>
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
      )}

      {/* ======================================== */}
      {/* Role Create/Edit Dialog */}
      {/* ======================================== */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Edit Role" : "Create Role"}
            </DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Update the role name and permissions"
                : "Set a name and choose permissions for the new role"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Manager"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-3">
              <Label>Permissions</Label>
              {Object.entries(accessGroups).map(
                ([resource, resourceAccesses]) => (
                  <div key={resource} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`group-${resource}`}
                        checked={resourceAccesses.every((a) =>
                          selectedAccessIds.includes(a.id),
                        )}
                        onCheckedChange={() =>
                          toggleResourceGroup(resourceAccesses)
                        }
                        disabled={isSaving}
                      />
                      <Label
                        htmlFor={`group-${resource}`}
                        className="text-sm font-medium capitalize cursor-pointer"
                      >
                        {resource}
                      </Label>
                    </div>
                    <div className="ml-6 flex flex-wrap gap-x-4 gap-y-2">
                      {resourceAccesses.map((access) => (
                        <div
                          key={access.id}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            id={`access-${access.id}`}
                            checked={selectedAccessIds.includes(access.id)}
                            onCheckedChange={() => toggleAccess(access.id)}
                            disabled={isSaving}
                          />
                          <Label
                            htmlFor={`access-${access.id}`}
                            className="text-sm font-normal capitalize cursor-pointer"
                          >
                            {access.action}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={handleCloseRoleDialog}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingRole
                  ? "Update Role"
                  : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================== */}
      {/* Role Delete Dialog */}
      {/* ======================================== */}
      <AlertDialog
        open={isDeleteRoleDialogOpen}
        onOpenChange={setIsDeleteRoleDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role &quot;
              {deletingRole?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? "Deleting..." : "Delete Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ======================================== */}
      {/* User Create/Edit Dialog */}
      {/* ======================================== */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Invite User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update the user details"
                : "Add a new team member to your organization"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="John Doe"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="john@example.com"
                disabled={isSaving}
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="user-password">Initial Password</Label>
                <PasswordInput
                  id="user-password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  disabled={isSaving}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={userRoleId}
                onValueChange={setUserRoleId}
                disabled={isSaving}
              >
                <SelectTrigger>
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
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="current-password">Your Password</Label>
              <PasswordInput
                id="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your password to confirm"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Required to confirm this action
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={handleCloseUserDialog}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingUser
                  ? "Update User"
                  : "Invite User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================== */}
      {/* User Delete Dialog */}
      {/* ======================================== */}
      <AlertDialog
        open={isDeleteUserDialogOpen}
        onOpenChange={setIsDeleteUserDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{deletingUser?.name}&quot;
              from your organization? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {deleteError}
            </div>
          )}
          <div className="space-y-2 px-1">
            <Label htmlFor="delete-current-password">Your Password</Label>
            <PasswordInput
              id="delete-current-password"
              value={deleteCurrentPassword}
              onChange={(e) => setDeleteCurrentPassword(e.target.value)}
              placeholder="Enter your password to confirm"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Required to confirm this action
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
