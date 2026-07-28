"use client"

import { useEffect, useMemo, useState } from "react"
import { Controller, Resolver, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SearchIcon, ShieldAlertIcon, ShieldCheckIcon } from "lucide-react"
import { z } from "zod/v4"

import {
  fetchRoleListAll,
  type AdminRole,
  type CreateAdminUserPayload,
} from "@/lib/api/admin"
import { useAppLocale, useI18n } from "@/i18n/provider"
import { Status } from "@/lib/generated/enums"
import { getRoleDisplayName } from "@/lib/role-i18n"
import { cn } from "@/lib/utils"
import { ImageInput } from "@/components/image-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
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

type CreateUserDrawerProps = {
  open: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CreateAdminUserPayload) => Promise<void>
}

type CreateForm = {
  username: string
  nickname: string
  avatar: string
  mobile: string
  email: string
  remark: string
  roleIds: number[]
}

const emptyForm: CreateForm = {
  username: "",
  nickname: "",
  avatar: "",
  mobile: "",
  email: "",
  remark: "",
  roleIds: [],
}

function toNullableString(value: string) {
  const output = value.trim()
  return output ? output : null
}

function buildPayload(form: CreateForm): CreateAdminUserPayload {
  return {
    username: form.username.trim(),
    nickname: form.nickname.trim(),
    avatar: form.avatar.trim(),
    mobile: toNullableString(form.mobile),
    email: toNullableString(form.email),
    remark: form.remark.trim(),
    roleIds: form.roleIds,
  }
}

export function CreateUserDrawer({
  open,
  saving,
  onOpenChange,
  onSubmit,
}: CreateUserDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      {open ? (
        <CreateUserDrawerBody
          key="create-user"
          saving={saving}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </Drawer>
  )
}

type CreateUserDrawerBodyProps = {
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CreateAdminUserPayload) => Promise<void>
}

function CreateUserDrawerBody({
  saving,
  onOpenChange,
  onSubmit,
}: CreateUserDrawerBodyProps) {
  const t = useI18n()
  const { locale } = useAppLocale()
  const [rolesLoading, setRolesLoading] = useState(true)
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [roleKeyword, setRoleKeyword] = useState("")
  const createFormSchema = useMemo(
    () =>
      z.object({
        username: z.string().trim().min(1, t("user.usernameRequired")),
        nickname: z.string().trim(),
        avatar: z.string().trim(),
        mobile: z
          .string()
          .trim()
          .refine(
            (value) => value.length === 0 || /^[0-9+\-\s]{6,20}$/.test(value),
            t("user.mobileInvalid")
          ),
        email: z
          .string()
          .trim()
          .refine(
            (value) =>
              value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            t("user.emailInvalid")
          ),
        remark: z.string().trim(),
        roleIds: z.array(z.number().int().positive()),
      }),
    [t]
  )
  const createFormResolver = useMemo(
    () => zodResolver(createFormSchema as never) as Resolver<CreateForm>,
    [createFormSchema]
  )
  const form = useForm<CreateForm>({
    resolver: createFormResolver,
    defaultValues: emptyForm,
  })
  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = form

  useEffect(() => {
    async function loadRoles() {
      setRolesLoading(true)
      try {
        const list = await fetchRoleListAll()
        setRoles(list)
      } catch {
        setRoles([])
      } finally {
        setRolesLoading(false)
      }
    }
    void loadRoles()
  }, [])

  const filteredRoles = useMemo(() => {
    const q = roleKeyword.trim().toLowerCase()
    if (!q) {
      return roles
    }
    return roles.filter((role) =>
      `${role.name} ${getRoleDisplayName(role.code, role.name, locale)} ${role.code}`
        .toLowerCase()
        .includes(q)
    )
  }, [locale, roleKeyword, roles])

  async function onFormSubmit(values: CreateForm) {
    await onSubmit(buildPayload(values))
    reset(emptyForm)
    setRoleKeyword("")
  }

  return (
    <DrawerContent className="min-w-2xl overflow-hidden">
      <DrawerHeader className="shrink-0">
        <DrawerTitle>{t("user.createTitle")}</DrawerTitle>
        <DrawerDescription>
          {t("user.createDescription")}
        </DrawerDescription>
      </DrawerHeader>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={handleSubmit(onFormSubmit)}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <Field data-invalid={!!errors.username}>
            <FieldLabel htmlFor="create-username">{t("user.username")}</FieldLabel>
            <FieldContent>
              <Input
                id="create-username"
                placeholder={t("user.usernamePlaceholder")}
                autoComplete="off"
                aria-invalid={!!errors.username}
                {...register("username")}
              />
              <FieldError errors={[errors.username]} />
            </FieldContent>
          </Field>
          <Field data-invalid={!!errors.nickname}>
            <FieldLabel htmlFor="create-nickname">{t("user.nickname")}</FieldLabel>
            <FieldContent>
              <Input
                id="create-nickname"
                placeholder={t("user.nicknameCreatePlaceholder")}
                aria-invalid={!!errors.nickname}
                {...register("nickname")}
              />
              <FieldError errors={[errors.nickname]} />
            </FieldContent>
          </Field>
          <Field className="min-h-32" data-invalid={!!errors.avatar}>
            <FieldLabel>{t("user.avatar")}</FieldLabel>
            <FieldContent>
              <Controller
                control={control}
                name="avatar"
                render={({ field }) => (
                  <ImageInput
                    value={field.value}
                    onChange={field.onChange}
                    disabled={saving}
                    prefix="avatar"
                    placeholder={t("user.avatarCreatePlaceholder")}
                    className="size-16 rounded-full"
                  />
                )}
              />
              <FieldError errors={[errors.avatar]} />
            </FieldContent>
          </Field>
          <Field data-invalid={!!errors.mobile}>
            <FieldLabel htmlFor="create-mobile">{t("user.mobile")}</FieldLabel>
            <FieldContent>
              <Input
                id="create-mobile"
                placeholder={t("user.optional")}
                aria-invalid={!!errors.mobile}
                {...register("mobile")}
              />
              <FieldError errors={[errors.mobile]} />
            </FieldContent>
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="create-email">{t("user.email")}</FieldLabel>
            <FieldContent>
              <Input
                id="create-email"
                placeholder={t("user.optional")}
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              <FieldError errors={[errors.email]} />
            </FieldContent>
          </Field>
          <Field data-invalid={!!errors.remark}>
            <FieldLabel htmlFor="create-remark">{t("user.remark")}</FieldLabel>
            <FieldContent>
              <Input
                id="create-remark"
                placeholder={t("user.optional")}
                aria-invalid={!!errors.remark}
                {...register("remark")}
              />
              <FieldError errors={[errors.remark]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.roleIds}>
            <FieldLabel>{t("user.rolesOptional")}</FieldLabel>
            <FieldContent>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={roleKeyword}
                  onChange={(event) => setRoleKeyword(event.target.value)}
                  placeholder={t("user.searchRoles")}
                  className="pl-9"
                  disabled={rolesLoading}
                />
              </div>
              <Controller
                control={control}
                name="roleIds"
                render={({ field }) => {
                  const value = field.value || []
                  const selectedSet = new Set(value)
                  return (
                    <div className="mt-2 max-h-[240px] space-y-1 overflow-y-auto rounded-lg border p-2">
                      {rolesLoading ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          {t("user.loadingRoles")}
                        </div>
                      ) : filteredRoles.length > 0 ? (
                        filteredRoles.map((role) => {
                          const checked = selectedSet.has(role.id)
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
                                    value.filter(
                                      (id: number) => id !== role.id
                                    )
                                  )
                                }}
                              />
                              <span className="flex min-w-0 flex-1 items-center gap-2">
                                {role.status === Status.Ok ? (
                                  <ShieldCheckIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ShieldAlertIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate">
                                  {getRoleDisplayName(role.code, role.name, locale)}
                                </span>
                                {role.status !== Status.Ok ? (
                                  <Badge variant="outline" className="text-xs">
                                    {t("user.disabledBadge")}
                                  </Badge>
                                ) : null}
                              </span>
                            </label>
                          )
                        })
                      ) : (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          {t("user.emptyRoles")}
                        </div>
                      )}
                    </div>
                  )
                }}
              />
              <FieldError errors={[errors.roleIds]} />
            </FieldContent>
          </Field>
        </div>
        <DrawerFooter className="shrink-0 border-t bg-background">
          <Button type="submit" disabled={saving || rolesLoading}>
            {saving ? t("user.creating") : t("user.createUser")}
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
