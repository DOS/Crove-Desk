"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ExternalLinkIcon, GripVerticalIcon, PlusIcon, RefreshCwIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { DashboardPage, DashboardTableShell, DashboardTableStateRow, DashboardToolbar } from "@/components/dashboard-page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useI18n } from "@/i18n/provider"
import {
  fetchSupportConfigAdmin,
  saveSupportConfigAdmin,
  type SupportNavigationMenuItem,
} from "@/lib/api/admin"
import { isApiRequestError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

type ConfigFieldError = {
  path: string
  code: string
  message: string
}

type NavigationMenuRowProps = {
  item: SupportNavigationMenuItem
  disabled: boolean
  canDelete: boolean
  onChange: (id: string, values: Partial<SupportNavigationMenuItem>) => void
  onDelete: (id: string) => void
}

const newMenuItem = (): SupportNavigationMenuItem => ({
  id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  url: "/support",
  openInNewWindow: false,
  visible: true,
  sortNo: 0,
})

function normalizeRows(rows: SupportNavigationMenuItem[]) {
  return rows.map((item, index) => ({ ...item, sortNo: (index + 1) * 10 }))
}

function serializeRows(rows: SupportNavigationMenuItem[]) {
  return JSON.stringify(
    rows.map(({ id, title, url, openInNewWindow, visible }) => ({
      id,
      title: title.trim(),
      url: url.trim(),
      openInNewWindow,
      visible,
    }))
  )
}

export function SupportConfigPanel() {
  const t = useI18n()
  const [items, setItems] = useState<SupportNavigationMenuItem[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState("")
  const [fieldErrors, setFieldErrors] = useState<ConfigFieldError[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const dirty = useMemo(() => serializeRows(items) !== savedSnapshot, [items, savedSnapshot])
  const canDelete = items.length > 1

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      const config = await fetchSupportConfigAdmin()
      const nextItems = normalizeRows(config.navigationMenu)
      setItems(nextItems)
      setSavedSnapshot(serializeRows(nextItems))
      setFieldErrors([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("supportConfig.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (!dirty) {
      return
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [dirty])

  function handleAdd() {
    setItems((current) => normalizeRows([...current, newMenuItem()]))
  }

  function handleChange(id: string, values: Partial<SupportNavigationMenuItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...values } : item)))
  }

  function handleDelete(id: string) {
    const item = items.find((candidate) => candidate.id === id)
    if (!item) {
      return
    }
    if (!window.confirm(t("supportConfig.confirmDelete", { title: item.title || t("supportConfig.untitled") }))) {
      return
    }
    setItems((current) => normalizeRows(current.filter((candidate) => candidate.id !== id)))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }
    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id)
      const newIndex = current.findIndex((item) => item.id === over.id)
      if (oldIndex < 0 || newIndex < 0) {
        return current
      }
      return normalizeRows(arrayMove(current, oldIndex, newIndex))
    })
  }

  async function handleSave() {
    try {
      setSaving(true)
      const config = await saveSupportConfigAdmin({ navigationMenu: items })
      const saved = normalizeRows(config.navigationMenu)
      setItems(saved)
      setSavedSnapshot(serializeRows(saved))
      setFieldErrors([])
      toast.success(t("supportConfig.saved"))
    } catch (error) {
      if (isApiRequestError(error)) {
        setFieldErrors(extractConfigFieldErrors(error.data))
      }
      toast.error(error instanceof Error ? error.message : t("supportConfig.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardPage>
      <DashboardToolbar
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => void loadConfig()} disabled={loading || saving}>
              <RefreshCwIcon className={cn((loading || saving) && "animate-spin")} />
              {t("supportConfig.refresh")}
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={loading || saving || !dirty}>
              <SaveIcon />
              {saving ? t("supportConfig.saving") : t("supportConfig.save")}
            </Button>
          </>
        }
      >
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{t("supportConfig.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("supportConfig.description")}</p>
        </div>
      </DashboardToolbar>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium">{t("supportConfig.navigationTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("supportConfig.navigationDescription")}</p>
          </div>
          <Button type="button" variant="outline" onClick={handleAdd} disabled={loading || saving}>
            <PlusIcon />
            {t("supportConfig.addNavigation")}
          </Button>
        </div>

        {fieldErrors.length > 0 ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <div className="font-medium">{t("supportConfig.validationFailed")}</div>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {fieldErrors.map((error) => (
                <li key={`${error.path}-${error.code}`}>{error.path ? `${error.path}: ${error.message}` : error.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <DashboardTableShell>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t("supportConfig.sort")}</TableHead>
                  <TableHead className="min-w-44">{t("supportConfig.menuTitle")}</TableHead>
                  <TableHead className="min-w-64">{t("supportConfig.menuURL")}</TableHead>
                  <TableHead className="w-40">{t("supportConfig.target")}</TableHead>
                  <TableHead className="w-28">{t("supportConfig.visible")}</TableHead>
                  <TableHead className="w-20 text-right">{t("supportConfig.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <DashboardTableStateRow colSpan={6} loading loadingText={t("supportConfig.loading")} />
                ) : items.length === 0 ? (
                  <DashboardTableStateRow colSpan={6} emptyText={t("supportConfig.emptyNavigation")} />
                ) : (
                  <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                    {items.map((item) => (
                      <NavigationMenuRow
                        key={item.id}
                        item={item}
                        disabled={saving}
                        canDelete={canDelete}
                        onChange={handleChange}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </DashboardTableShell>
      </section>
    </DashboardPage>
  )
}

function extractConfigFieldErrors(data: unknown): ConfigFieldError[] {
  if (!data || typeof data !== "object" || !("errors" in data)) {
    return []
  }
  const errors = (data as { errors?: unknown }).errors
  if (!Array.isArray(errors)) {
    return []
  }
  return errors.filter((item): item is ConfigFieldError => {
    return Boolean(
      item &&
        typeof item === "object" &&
        "path" in item &&
        "code" in item &&
        "message" in item &&
        typeof (item as ConfigFieldError).path === "string" &&
        typeof (item as ConfigFieldError).code === "string" &&
        typeof (item as ConfigFieldError).message === "string"
    )
  })
}

function NavigationMenuRow({ item, disabled, canDelete, onChange, onDelete }: NavigationMenuRowProps) {
  const t = useI18n()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <TableRow ref={setNodeRef} style={style} className={cn(isDragging && "relative z-10 bg-muted/60 shadow-sm")}>
      <TableCell className="w-12">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 cursor-grab rounded-md active:cursor-grabbing"
          disabled={disabled}
          aria-label={t("supportConfig.dragNavigation", { title: item.title || t("supportConfig.untitled") })}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon />
        </Button>
      </TableCell>
      <TableCell className="min-w-44 whitespace-normal">
        <Label className="sr-only" htmlFor={`support-nav-title-${item.id}`}>{t("supportConfig.menuTitle")}</Label>
        <Input
          id={`support-nav-title-${item.id}`}
          value={item.title}
          onChange={(event) => onChange(item.id, { title: event.target.value })}
          placeholder={t("supportConfig.titlePlaceholder")}
          disabled={disabled}
          maxLength={64}
        />
      </TableCell>
      <TableCell className="min-w-64 whitespace-normal">
        <Label className="sr-only" htmlFor={`support-nav-url-${item.id}`}>{t("supportConfig.menuURL")}</Label>
        <div className="flex min-w-0 items-center gap-2">
          <Input
            id={`support-nav-url-${item.id}`}
            value={item.url}
            onChange={(event) => onChange(item.id, { url: event.target.value })}
            placeholder="/support/docs"
            disabled={disabled}
          />
          {item.url ? (
            <a
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              href={item.url}
              target="_blank"
              rel="noreferrer"
              aria-label={t("supportConfig.openURL")}
              title={t("supportConfig.openURL")}
            >
              <ExternalLinkIcon className="size-4" />
            </a>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="w-40">
        <Select value={item.openInNewWindow ? "_blank" : "_self"} onValueChange={(value) => onChange(item.id, { openInNewWindow: value === "_blank" })} disabled={disabled}>
          <SelectTrigger className="w-36 rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_self">{t("supportConfig.targetSelf")}</SelectItem>
            <SelectItem value="_blank">{t("supportConfig.targetBlank")}</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-28">
        <Switch
          checked={item.visible}
          onCheckedChange={(checked) => onChange(item.id, { visible: checked })}
          disabled={disabled}
          aria-label={t("supportConfig.toggleNavigation", { title: item.title || t("supportConfig.untitled") })}
        />
      </TableCell>
      <TableCell className="w-20 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={disabled || !canDelete}
          onClick={() => onDelete(item.id)}
          aria-label={t("supportConfig.deleteNavigation", { title: item.title || t("supportConfig.untitled") })}
        >
          <Trash2Icon />
        </Button>
      </TableCell>
    </TableRow>
  )
}
