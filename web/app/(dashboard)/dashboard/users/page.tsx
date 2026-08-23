"use client"

import { type KeyboardEvent, useCallback, useMemo, useState } from "react"
import {
  KeyRoundIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  UserRoundIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  DashboardPage,
  DashboardTableShell,
  DashboardTableStateRow,
  DashboardToolbar,
} from "@/components/dashboard-page"
import {
  useDashboardPagedList,
  type DashboardListFilter,
} from "@/components/dashboard/list"
import { ListPagination } from "@/components/list-pagination"
import {
  assignUserRoles,
  createUser,
  fetchRoleListAll,
  fetchUserDetail,
  fetchUsers,
  resetUserPassword,
  updateUser,
  updateUserStatus,
  type AdminRole,
  type AdminUser,
  type CreateAdminUserPayload,
  type ResetPasswordResult,
  type UpdateAdminUserPayload,
} from "@/lib/api/admin"
import { Status } from "@/lib/generated/enums"
import { useAppLocale, useI18n } from "@/i18n/provider"
import { getRoleDisplayName } from "@/lib/role-i18n"
import { formatDateTime } from "@/lib/utils"
import { AssignRolesDrawer } from "./_components/assign-roles"
import { CreateUserDrawer } from "./_components/create"
import { EditDrawer } from "./_components/edit"
import { InitialPasswordDialog } from "./_components/initial-password-dialog"
import { ResetPasswordDialogs } from "./_components/reset-password"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function DashboardUsersPage() {
  const t = useI18n()
  const { locale } = useAppLocale()
  const [creatingOpen, setCreatingOpen] = useState(false)
  const [savingCreate, setSavingCreate] = useState(false)
  const [initialPassword, setInitialPassword] = useState<{
    username: string
    password: string
  } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingRoles, setSavingRoles] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null)
  const [assigningRolesUser, setAssigningRolesUser] = useState<AdminUser | null>(null)
  const [assignRoleOptions, setAssignRoleOptions] = useState<AdminRole[]>([])
  const [assignRoleIds, setAssignRoleIds] = useState<number[]>([])
  const [assignRolesLoading, setAssignRolesLoading] = useState(false)
  const [resetPasswordResult, setResetPasswordResult] =
    useState<ResetPasswordResult | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const filters = useMemo<DashboardListFilter[]>(
    () => [
      {
        name: "username",
        label: t("user.filterUsername"),
        defaultValue: "",
        trim: true,
      },
    ],
    [t],
  )
  const fetchList = useCallback(
    (query: Record<string, string | number | boolean | string[] | number[] | undefined>) =>
      fetchUsers({
        username: typeof query.username === "string" ? query.username : undefined,
        page: Number(query.page),
        limit: Number(query.limit),
      }),
    [],
  )
  const list = useDashboardPagedList<AdminUser>({
    filters,
    fetchList,
    loadFailed: t("user.loadFailed"),
  })

  function applyFilters() {
    list.applyFilters()
  }

  function handleFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return
    }

    event.preventDefault()
    applyFilters()
  }

  function openEditDrawer(user: AdminUser) {
    setEditingUser(user)
  }

  async function openAssignRolesDrawer(user: AdminUser) {
    setActionLoadingId(user.id)
    setAssigningRolesUser(user)
    setAssignRolesLoading(true)
    try {
      const [roles, userDetail] = await Promise.all([
        fetchRoleListAll(),
        fetchUserDetail(user.id),
      ])
      setAssignRoleOptions(roles)
      setAssignRoleIds((userDetail.roles || []).map((role) => role.id))
    } catch (error) {
      setAssigningRolesUser(null)
      toast.error(error instanceof Error ? error.message : t("user.loadRoleAssignFailed"))
    } finally {
      setAssignRolesLoading(false)
      setActionLoadingId(null)
    }
  }

  function handlePageChange(nextPage: number) {
    list.handlePageChange(nextPage)
  }

  function handleLimitChange(nextLimit: number) {
    list.handleLimitChange(nextLimit)
  }

  function handleEditDrawerOpenChange(open: boolean) {
    if (savingEdit) {
      return
    }
    if (!open) {
      setEditingUser(null)
    }
  }

  function handleCreateDrawerOpenChange(open: boolean) {
    if (savingCreate) {
      return
    }
    if (!open) {
      setCreatingOpen(false)
    }
  }

  async function handleCreateUser(payload: CreateAdminUserPayload) {
    if (savingCreate) {
      return
    }

    setSavingCreate(true)
    try {
      const result = await createUser(payload)
      toast.success(t("user.created", { username: result.user.username }))
      setCreatingOpen(false)
      setInitialPassword({
        username: result.user.username,
        password: result.password,
      })
      await list.loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("user.createFailed"))
    } finally {
      setSavingCreate(false)
    }
  }

  function handleAssignRolesOpenChange(open: boolean) {
    if (savingRoles) {
      return
    }
    if (!open) {
      setAssigningRolesUser(null)
      setAssignRoleOptions([])
      setAssignRoleIds([])
    }
  }

  async function handleSaveUser(payload: UpdateAdminUserPayload) {
    if (savingEdit) {
      return
    }

    setSavingEdit(true)
    try {
      await updateUser(payload)
      toast.success(t("user.updated", { username: editingUser?.username || t("user.fallbackUser") }))
      setEditingUser(null)
      await list.loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("user.updateFailed"))
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleAssignRoles(roleIds: number[]) {
    if (!assigningRolesUser || savingRoles) {
      return
    }

    setSavingRoles(true)
    try {
      await assignUserRoles(assigningRolesUser.id, roleIds)
      toast.success(t("user.rolesUpdated", { username: assigningRolesUser.username }))
      setAssigningRolesUser(null)
      setAssignRoleOptions([])
      setAssignRoleIds([])
      await list.loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("user.saveRolesFailed"))
    } finally {
      setSavingRoles(false)
    }
  }

  function openResetDrawer(user: AdminUser) {
    setResetPasswordResult(null)
    setResettingUser(user)
  }

  function handleResetDrawerOpenChange(open: boolean) {
    if (savingPassword) {
      return
    }
    if (!open) {
      setResetPasswordResult(null)
      setResettingUser(null)
    }
  }

  async function handleResetPassword() {
    if (!resettingUser || savingPassword) {
      return
    }

    setSavingPassword(true)
    try {
      const result = await resetUserPassword(resettingUser.id)
      setResetPasswordResult(result)
      toast.success(t("user.passwordReset", { username: resettingUser.username }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("user.resetPasswordFailed"))
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleToggleStatus(user: AdminUser) {
    setActionLoadingId(user.id)
    try {
      const nextStatus = user.status === Status.Ok ? Status.Disabled : Status.Ok
      await updateUserStatus(user.id, nextStatus)
      toast.success(
        t("user.statusUpdated", {
          username: user.username,
          status: nextStatus === Status.Ok ? t("user.enabled") : t("user.disabled"),
        })
      )
      await list.loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("user.statusUpdateFailed"))
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <>
      <DashboardPage>
        <DashboardToolbar
          actions={
            <Button onClick={() => setCreatingOpen(true)} disabled={list.loading}>
              <PlusIcon />
              {t("user.addUser")}
            </Button>
          }
        >
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={String(list.draftFilters.username ?? "")}
              onChange={(event) =>
                list.setDraftFilter("username", event.target.value)
              }
              onKeyDown={handleFilterKeyDown}
              placeholder={t("user.filterUsername")}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={applyFilters} disabled={list.loading}>
            {t("user.query")}
          </Button>
        </DashboardToolbar>
        <DashboardTableShell
          pagination={
            <ListPagination
              page={list.result.page.page}
              total={list.result.page.total}
              limit={list.result.page.limit}
              loading={list.loading}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          }
        >
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>{t("user.columnUser")}</TableHead>
                  <TableHead>{t("user.columnRoles")}</TableHead>
                  <TableHead>{t("user.columnStatus")}</TableHead>
                  <TableHead>{t("user.columnContact")}</TableHead>
                  <TableHead>{t("user.columnLastLogin")}</TableHead>
                  <TableHead className="w-[92px] text-right">{t("user.columnActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.result.results.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {item.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <UserRoundIcon className="size-4" />
                        </div>
                        <div>
                          <div className="font-medium">{item.nickname || item.username}</div>
                          <div className="text-xs text-muted-foreground">{item.username}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {(item.roles || []).length > 0 ? (
                          item.roles?.map((role) => (
                            <Badge key={role.id} variant="outline">
                              <ShieldIcon className="size-3" />
                              {getRoleDisplayName(role.code, role.name, locale)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">{t("user.unassigned")}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === Status.Ok ? "secondary" : "outline"}>
                        {item.status === Status.Ok ? t("user.enabled") : t("user.disabled")}
                      </Badge>
                      {item.isSystem ? (
                        <Badge variant="outline" className="ml-2">
                          {t("user.system")}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.mobile || "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.email || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDateTime(item.lastLoginAt)}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.lastLoginIp || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <ButtonGroup className="ml-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDrawer(item)}
                          disabled={actionLoadingId === item.id}
                        >
                          {t("user.edit")}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="outline" size="icon-sm" />}
                            aria-label={t("user.moreActions", { username: item.username })}
                          >
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 min-w-40">
                            <DropdownMenuItem
                              onClick={() => void openAssignRolesDrawer(item)}
                              disabled={actionLoadingId === item.id}
                            >
                              <ShieldIcon />
                              {actionLoadingId === item.id
                                ? t("user.processing")
                                : t("user.assignRoles")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openResetDrawer(item)}
                              disabled={actionLoadingId === item.id}
                            >
                              <KeyRoundIcon />
                              {t("user.resetPassword")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(item)}
                              disabled={actionLoadingId === item.id}
                            >
                              <ShieldIcon />
                              {actionLoadingId === item.id
                                ? t("user.processing")
                                : item.status === Status.Ok
                                  ? t("user.disabled")
                                  : t("user.enabled")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ButtonGroup>
                    </TableCell>
                  </TableRow>
                ))}
                {list.loading || list.result.results.length === 0 ? (
                  <DashboardTableStateRow
                    colSpan={7}
                    loading={list.loading}
                    loadingText={t("user.loadingRows")}
                    emptyText={t("user.emptyRows")}
                  />
                ) : null}
              </TableBody>
            </Table>
        </DashboardTableShell>
      </DashboardPage>
      <CreateUserDrawer
        open={creatingOpen}
        saving={savingCreate}
        onOpenChange={handleCreateDrawerOpenChange}
        onSubmit={handleCreateUser}
      />
      <InitialPasswordDialog
        open={!!initialPassword}
        username={initialPassword?.username ?? ""}
        password={initialPassword?.password ?? ""}
        onOpenChange={(open) => {
          if (!open) {
            setInitialPassword(null)
          }
        }}
      />
      <EditDrawer
        open={!!editingUser}
        saving={savingEdit}
        itemId={editingUser?.id ?? null}
        onOpenChange={handleEditDrawerOpenChange}
        onSubmit={handleSaveUser}
      />
      <ResetPasswordDialogs
        open={!!resettingUser}
        saving={savingPassword}
        item={resettingUser}
        password={resetPasswordResult?.password || ""}
        onOpenChange={handleResetDrawerOpenChange}
        onConfirm={handleResetPassword}
      />
      <AssignRolesDrawer
        open={!!assigningRolesUser}
        saving={savingRoles}
        loading={assignRolesLoading}
        item={assigningRolesUser}
        roles={assignRoleOptions}
        selectedRoleIds={assignRoleIds}
        onOpenChange={handleAssignRolesOpenChange}
        onSubmit={handleAssignRoles}
      />
    </>
  )
}
