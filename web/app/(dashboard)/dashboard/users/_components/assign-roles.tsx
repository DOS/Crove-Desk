"use client"

import { useEffect, useMemo, useState } from "react"
import { Controller, Resolver, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SearchIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldIcon } from "lucide-react"
import { z } from "zod/v4"

import type { AdminRole, AdminUser } from "@/lib/api/admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Status } from "@/lib/generated/enums"
import { useAppLocale, useI18n } from "@/i18n/provider"
import { getRoleDisplayName } from "@/lib/role-i18n"
import { cn } from "@/lib/utils"

type AssignRolesDrawerProps = {
  open: boolean
  saving: boolean
  loading: boolean
  item: AdminUser | null
  roles: AdminRole[]
  selectedRoleIds: number[]
  onOpenChange: (open: boolean) => void
  onSubmit: (roleIds: number[]) => Promise<void>
}

const assignRolesSchema = z.object({
  roleIds: z.array(z.number().int().positive()),
})

type AssignRolesForm = z.infer<typeof assignRolesSchema>

const assignRolesResolver = zodResolver(assignRolesSchema as never) as Resolver<
  z.input<typeof assignRolesSchema>,
  undefined,
  z.output<typeof assignRolesSchema>
>

function buildForm(selectedRoleIds: number[]): AssignRolesForm {
  return {
    roleIds: selectedRoleIds,
  }
}

export function AssignRolesDrawer({
  open,
  saving,
  loading,
  item,
  roles,
  selectedRoleIds,
  onOpenChange,
  onSubmit,
}: AssignRolesDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      {open ? (
        <AssignRolesDrawerBody
          key={item ? `assign-roles-${item.id}` : "assign-roles"}
          saving={saving}
          loading={loading}
          item={item}
          roles={roles}
          selectedRoleIds={selectedRoleIds}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </Drawer>
  )
}

type AssignRolesDrawerBodyProps = {
  saving: boolean
  loading: boolean
  item: AdminUser | null
  roles: AdminRole[]
  selectedRoleIds: number[]
  onOpenChange: (open: boolean) => void
  onSubmit: (roleIds: number[]) => Promise<void>
}

function AssignRolesDrawerBody({
  saving,
  loading,
  item,
  roles,
  selectedRoleIds,
  onOpenChange,
  onSubmit,
}: AssignRolesDrawerBodyProps) {
  const t = useI18n()
  const { locale } = useAppLocale()
  const [keyword, setKeyword] = useState("")
  const form = useForm<
    z.input<typeof assignRolesSchema>,
    undefined,
    z.output<typeof assignRolesSchema>
  >({
    resolver: assignRolesResolver,
    defaultValues: buildForm(selectedRoleIds),
  })
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = form

  useEffect(() => {
    reset(buildForm(selectedRoleIds))
  }, [reset, selectedRoleIds])

  const roleMap = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles]
  )

  async function onFormSubmit(values: AssignRolesForm) {
    await onSubmit(values.roleIds)
  }

  return (
    <DrawerContent className="flex min-w-2xl flex-col overflow-hidden">
      <DrawerHeader>
        <DrawerTitle>{t("user.assignRoles")}</DrawerTitle>
      </DrawerHeader>
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onSubmit={handleSubmit(onFormSubmit)}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Controller
            control={control}
            name="roleIds"
            render={({ field }) => {
              const value = field.value || []
              const selectedRoleSet = new Set(value)
              const initiallySelectedSet = new Set(selectedRoleIds)
              const selectedRoles = roles.filter((role) => selectedRoleSet.has(role.id))
              const removedRoles = selectedRoleIds
                .map((roleId) => roleMap.get(roleId))
                .filter((role): role is AdminRole => !!role && !selectedRoleSet.has(role.id))
              const addedRoles = value
                .map((roleId) => roleMap.get(roleId))
                .filter((role): role is AdminRole => !!role && !initiallySelectedSet.has(role.id))
              const filteredRoles = roles.filter((role) => {
                const output = keyword.trim().toLowerCase()
                if (!output) {
                  return true
                }
                return `${role.name} ${getRoleDisplayName(role.code, role.name, locale)} ${role.code}`
                  .toLowerCase()
                  .includes(output)
              })

              return (
                <div className="space-y-4 px-4 pb-4">
                  <Field>
                    <FieldLabel>{t("user.assignedRoles")}</FieldLabel>
                    <FieldContent>
                      <div className="rounded-lg border p-3">
                        {selectedRoles.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedRoles.map((role) => (
                              <Badge
                                key={role.id}
                                variant={role.status === Status.Ok ? "secondary" : "outline"}
                                className="gap-1"
                              >
                                {role.status === Status.Ok ? (
                                  <ShieldCheckIcon className="size-3" />
                                ) : (
                                  <ShieldAlertIcon className="size-3" />
                                )}
                                {getRoleDisplayName(role.code, role.name, locale)}
                                {role.status !== Status.Ok ? ` (${t("user.disabled")})` : ""}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {t("user.unassignedRoles")}
                          </div>
                        )}
                      </div>
                    </FieldContent>
                  </Field>

                  <Field data-invalid={!!errors.roleIds}>
                    <FieldLabel>{t("user.roleList")}</FieldLabel>
                    <FieldContent>
                      <div className="relative">
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={keyword}
                          onChange={(event) => setKeyword(event.target.value)}
                          placeholder={t("user.searchRoleNameOrCode")}
                          className="pl-9"
                          disabled={loading}
                        />
                      </div>
                      <div className="mt-2 max-h-[360px] space-y-1 overflow-y-auto rounded-lg border p-2">
                        {loading ? (
                          <div className="py-8 text-center text-sm text-muted-foreground">
                            {t("user.loadingRoleList")}
                          </div>
                        ) : filteredRoles.length > 0 ? (
                          filteredRoles.map((role) => {
                            const checked = selectedRoleSet.has(role.id)
                            const disabled = role.status !== Status.Ok && !checked

                            return (
                              <label
                                key={role.id}
                                className={cn(
                                  "flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors",
                                  disabled
                                    ? "cursor-not-allowed border-dashed bg-muted/20 opacity-70"
                                    : "cursor-pointer hover:bg-muted/50",
                                  checked && "border-primary/40 bg-primary/5"
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={disabled}
                                  onCheckedChange={(nextChecked) => {
                                    if (nextChecked) {
                                      field.onChange([...value, role.id])
                                      return
                                    }
                                    field.onChange(
                                      value.filter((currentId) => currentId !== role.id)
                                    )
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="truncate font-medium">
                                      {getRoleDisplayName(role.code, role.name, locale)}
                                    </span>
                                    <span className="truncate text-muted-foreground">
                                      {role.code}
                                    </span>
                                  </div>
                                </div>
                                {role.isSystem ? (
                                  <Badge variant="outline" className="shrink-0">
                                    {t("user.system")}
                                  </Badge>
                                ) : null}
                                <Badge
                                  variant={role.status === Status.Ok ? "secondary" : "outline"}
                                  className="shrink-0"
                                >
                                  {role.status === Status.Ok ? t("user.enabled") : t("user.disabled")}
                                </Badge>
                              </label>
                            )
                          })
                        ) : (
                          <div className="py-8 text-center text-sm text-muted-foreground">
                            {t("user.noMatchedRoles")}
                          </div>
                        )}
                      </div>
                      <FieldError errors={[errors.roleIds]} />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel>{t("user.changes")}</FieldLabel>
                    <FieldContent>
                      <div className="space-y-3 rounded-lg border p-3">
                        <div>
                          <div className="mb-2 text-sm font-medium">{t("user.addedRoles")}</div>
                          {addedRoles.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {addedRoles.map((role) => (
                                <Badge key={role.id} variant="secondary" className="gap-1">
                                  <ShieldIcon className="size-3" />
                                  {getRoleDisplayName(role.code, role.name, locale)}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">{t("user.noneAdded")}</div>
                          )}
                        </div>
                        <div>
                          <div className="mb-2 text-sm font-medium">{t("user.removedRoles")}</div>
                          {removedRoles.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {removedRoles.map((role) => (
                                <Badge key={role.id} variant="outline" className="gap-1">
                                  <ShieldIcon className="size-3" />
                                  {getRoleDisplayName(role.code, role.name, locale)}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">{t("user.noneRemoved")}</div>
                          )}
                        </div>
                      </div>
                    </FieldContent>
                  </Field>
                </div>
              )
            }}
          />
        </div>
        <DrawerFooter className="border-t">
          <Button type="submit" disabled={saving || loading || !item}>
            {saving ? t("user.saving") : t("user.confirmAssign")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("user.cancel")}
          </Button>
        </DrawerFooter>
      </form>
    </DrawerContent>
  )
}
