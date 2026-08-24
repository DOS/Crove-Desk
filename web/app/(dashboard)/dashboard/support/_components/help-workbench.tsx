"use client"

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  FilePlus2Icon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  RocketIcon,
  SaveIcon,
  SearchIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { toast } from "sonner"

import { useApiErrorHandler } from "@/components/api-error-provider"
import { useConfirm } from "@/components/confirm-provider"
import { ContentEditor } from "@/components/content-editor"
import { OptionCombobox } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/i18n/provider"
import { normalizeSupportSlug } from "@/lib/support-slug"
import {
  changeDocPageStatusAdmin,
  deleteDocPageAdmin,
  fetchDocPageAdmin,
  fetchDocPagesAllAdmin,
  saveDocPageAdmin,
  updateDocPageSettingsAdmin,
  updateDocPageSortAdmin,
  uploadAsset,
  type AdminDocPage,
} from "@/lib/api/admin"
import { cn } from "@/lib/utils"

type PageDraft = Pick<AdminDocPage, "parentId" | "title" | "slug" | "summary" | "content" | "contentType" | "tags">
type PageSettingsDraft = Pick<PageDraft, "parentId" | "slug" | "summary">
type CreateState = { open: boolean; parentId: number }

const blankCreate: CreateState = { open: false, parentId: 0 }

function toDraft(page: AdminDocPage): PageDraft {
  return {
    parentId: page.parentId ?? 0,
    title: page.title,
    slug: page.slug,
    summary: page.summary ?? "",
    content: page.content ?? "",
    contentType: page.contentType || "markdown",
    tags: page.tags ?? [],
  }
}

function descendantIds(pages: AdminDocPage[], id: number) {
  const result = new Set<number>()
  const visit = (parentId: number) => pages.filter((page) => page.parentId === parentId).forEach((page) => {
    result.add(page.id)
    visit(page.id)
  })
  visit(id)
  return result
}

function childPages(pages: AdminDocPage[], parentId: number) {
  return pages
    .filter((page) => page.parentId === parentId)
    .sort((left, right) => left.sortNo - right.sortNo || left.id - right.id)
}

function reorderSiblings(pages: AdminDocPage[], parentId: number, activeId: number, overId: number) {
  const siblings = childPages(pages, parentId)
  const oldIndex = siblings.findIndex((page) => page.id === activeId)
  const newIndex = siblings.findIndex((page) => page.id === overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null
  const ordered = arrayMove(siblings, oldIndex, newIndex)
  const sortByID = new Map(ordered.map((page, index) => [page.id, index]))
  return {
    ids: ordered.map((page) => page.id),
    pages: pages.map((page) => page.parentId === parentId ? { ...page, sortNo: sortByID.get(page.id) ?? page.sortNo } : page),
  }
}

function pagePath(pages: AdminDocPage[], page: AdminDocPage | null) {
  if (!page) return []
  const path: Array<Pick<AdminDocPage, "id" | "title">> = []
  let parentId = page.parentId
  while (parentId) {
    const parent = pages.find((item) => item.id === parentId)
    if (!parent) break
    path.unshift({ id: parent.id, title: parent.title })
    parentId = parent.parentId
  }
  return path
}

export function SupportDocsWorkbench() {
  const t = useI18n()
  const handleApiError = useApiErrorHandler()
  const confirm = useConfirm()
  const [pages, setPages] = useState<AdminDocPage[]>([])
  const [selected, setSelected] = useState<AdminDocPage | null>(null)
  const [draft, setDraft] = useState<PageDraft | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sorting, setSorting] = useState(false)
  const [activeDragId, setActiveDragId] = useState<number | null>(null)
  const [createState, setCreateState] = useState<CreateState>(blankCreate)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const selectionRequest = useRef(0)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const dirty = Boolean(selected && draft && JSON.stringify(toDraft(selected)) !== JSON.stringify(draft))
  const sortingDisabled = Boolean(query.trim()) || loading || sorting
  const activeDragPage = activeDragId ? pages.find((page) => page.id === activeDragId) : undefined

  const siblingCollisionDetection = useCallback<CollisionDetection>((args) => {
    const activePage = pages.find((page) => page.id === Number(args.active.id))
    if (!activePage) return []
    const siblingIDs = new Set(childPages(pages, activePage.parentId).map((page) => page.id))
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => siblingIDs.has(Number(container.id))),
    })
  }, [pages])

  const statusOptions = useMemo(() => [
    { value: "draft", label: t("docWorkbench.statusDraft") },
    { value: "published", label: t("docWorkbench.statusPublished") },
    { value: "hidden", label: t("docWorkbench.statusHidden") },
  ], [t])

  const load = useCallback(async (preferredId?: number) => {
    setLoading(true)
    try {
      const result = await fetchDocPagesAllAdmin()
      setPages(result)
      const requestedId = preferredId ?? selected?.id
      const id = requestedId && result.some((page) => page.id === requestedId)
        ? requestedId
        : result[0]?.id
      if (!id) {
        setSelected(null)
        setDraft(null)
        return
      }
      const detail = await fetchDocPageAdmin(id)
      setSelected(detail)
      setDraft(toDraft(detail))
      const ancestors = new Set<number>()
      let parentId = detail.parentId
      while (parentId) {
        ancestors.add(parentId)
        parentId = result.find((page) => page.id === parentId)?.parentId ?? 0
      }
      setExpanded((current) => new Set([...current, ...ancestors]))
    } catch (error) {
      handleApiError(error)
    } finally {
      setLoading(false)
    }
  }, [handleApiError, selected?.id])

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  })

  async function selectPage(page: AdminDocPage) {
    if (page.id === selected?.id) return
    if (dirty) {
      const leave = await confirm({
        title: t("docWorkbench.unsavedLeaveTitle"),
        description: t("docWorkbench.unsavedLeaveConfirm"),
        confirmText: t("docWorkbench.discardChanges"),
        cancelText: t("docWorkbench.continueEditing"),
        variant: "destructive",
      })
      if (!leave) return
    }
    const requestId = ++selectionRequest.current
    try {
      const detail = await fetchDocPageAdmin(page.id)
      if (requestId !== selectionRequest.current) return
      setSelected(detail)
      setDraft(toDraft(detail))
    } catch (error) {
      if (requestId === selectionRequest.current) handleApiError(error)
    }
  }

  async function save() {
    if (!selected || !draft || !draft.title.trim() || !draft.slug.trim()) return
    setSaving(true)
    try {
      const saved = await saveDocPageAdmin({
        id: selected.id,
        ...draft,
        status: selected.status,
        sortNo: draft.parentId === selected.parentId
          ? pages.find((page) => page.id === selected.id)?.sortNo ?? selected.sortNo
          : childPages(pages, draft.parentId).length,
        title: draft.title.trim(),
        slug: draft.slug.trim(),
        summary: draft.summary.trim(),
      })
      setSelected(saved)
      setDraft(toDraft(saved))
      setPages((items) => items.map((item) => item.id === saved.id ? saved : item))
      toast.success(t("docWorkbench.saved"))
    } catch (error) {
      handleApiError(error)
    } finally {
      setSaving(false)
    }
  }

  async function saveSettings(settings: PageSettingsDraft) {
    if (!selected || !draft || !settings.slug.trim() || saving) return
    setSaving(true)
    try {
      const saved = await updateDocPageSettingsAdmin({
        id: selected.id,
        parentId: settings.parentId,
        slug: settings.slug.trim(),
        summary: settings.summary.trim(),
      })
      setSelected(saved)
      setDraft({ ...draft, parentId: saved.parentId, slug: saved.slug, summary: saved.summary })
      setPages((items) => items.map((item) => item.id === saved.id ? saved : item))
      setSettingsOpen(false)
      toast.success(t("docWorkbench.settingsSaved"))
    } catch (error) {
      handleApiError(error)
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(status: "draft" | "published" | "hidden") {
    if (!selected || saving) return
    if (dirty) {
      toast.info(t("docWorkbench.saveBeforeStatusChange"))
      return
    }
    const confirmed = await confirm({
      title: t(`docWorkbench.${status}ConfirmTitle`, { title: selected.title }),
      description: t(`docWorkbench.${status}ConfirmDescription`),
      confirmText: t(`docWorkbench.${status}Action`),
      cancelText: t("docWorkbench.cancel"),
      variant: status === "hidden" ? "destructive" : "default",
    })
    if (!confirmed) return
    setSaving(true)
    try {
      const changed = await changeDocPageStatusAdmin(selected.id, status)
      setSelected(changed)
      setDraft(toDraft(changed))
      setPages((items) => items.map((item) => item.id === changed.id ? changed : item))
      toast.success(t(`docWorkbench.${status}Success`))
    } catch (error) {
      handleApiError(error)
    } finally {
      setSaving(false)
    }
  }

  async function remove(page: AdminDocPage) {
    const confirmed = await confirm({
      title: t("docWorkbench.deleteConfirmTitle", { title: page.title }),
      description: t("docWorkbench.deleteConfirm", { title: page.title }),
      confirmText: t("docWorkbench.deletePage"),
      cancelText: t("docWorkbench.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return
    try {
      await deleteDocPageAdmin(page.id)
      selectionRequest.current += 1
      toast.success(t("docWorkbench.deleted"))
      await load(selected?.id === page.id ? undefined : selected?.id)
    } catch (error) {
      handleApiError(error)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id || sortingDisabled) return
    const activePage = pages.find((page) => page.id === Number(active.id))
    const overPage = pages.find((page) => page.id === Number(over.id))
    if (!activePage || !overPage) return
    if (activePage.parentId !== overPage.parentId) {
      toast.info(t("docWorkbench.sameLevelOnly"))
      return
    }
    const reordered = reorderSiblings(pages, activePage.parentId, activePage.id, overPage.id)
    if (!reordered) return
    const previous = pages
    setPages(reordered.pages)
    setSorting(true)
    try {
      await updateDocPageSortAdmin({ parentId: activePage.parentId, ids: reordered.ids })
      toast.success(t("docWorkbench.sortSaved"))
    } catch (error) {
      setPages(previous)
      handleApiError(error)
    } finally {
      setSorting(false)
    }
  }

  const visibleIds = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return null
    const ids = new Set<number>()
    for (const page of pages) {
      if (keyword && !`${page.title} ${page.slug} ${page.summary}`.toLowerCase().includes(keyword)) continue
      ids.add(page.id)
      let parentId = page.parentId
      while (parentId) {
        ids.add(parentId)
        parentId = pages.find((item) => item.id === parentId)?.parentId ?? 0
      }
    }
    return ids
  }, [pages, query])

  const roots = childPages(pages, 0).filter((page) => !visibleIds || visibleIds.has(page.id))
  const path = pagePath(pages, selected)
  const statusLabel = statusOptions.find((item) => item.value === selected?.status)?.label ?? selected?.status

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-muted/20">
        <div className="flex h-14 items-center justify-between border-b px-3">
          <span className="font-semibold">{t("docWorkbench.title")}</span>
          <Button size="icon" variant="ghost" title={t("docWorkbench.createPage")} aria-label={t("docWorkbench.createPage")} onClick={() => setCreateState({ open: true, parentId: 0 })}>
            <FilePlus2Icon />
          </Button>
        </div>
        <div className="p-3">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder={t("docWorkbench.searchPlaceholder")} />
          </div>
          {query.trim() ? <p className="mt-2 text-xs text-muted-foreground">{t("docWorkbench.sortDisabledDuringSearch")}</p> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={siblingCollisionDetection}
            onDragStart={(event) => setActiveDragId(Number(event.active.id))}
            onDragCancel={() => setActiveDragId(null)}
            onDragEnd={(event) => void handleDragEnd(event)}
          >
            <SortableContext items={roots.map((page) => page.id)} strategy={verticalListSortingStrategy}>
              {roots.map((page) => (
                <PageTreeNode
                  key={page.id}
                  page={page}
                  pages={pages}
                  depth={0}
                  selectedId={selected?.id}
                  expanded={expanded}
                  forceExpanded={Boolean(query)}
                  visibleIds={visibleIds}
                  sortingDisabled={sortingDisabled}
                  onToggle={(id) => setExpanded((current) => {
                    const next = new Set(current)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })}
                  onSelect={selectPage}
                  onCreate={(parentId) => setCreateState({ open: true, parentId })}
                  onDelete={remove}
                />
              ))}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeDragPage ? <PageDragOverlay page={activeDragPage} /> : null}
            </DragOverlay>
          </DndContext>
          {!loading && pages.length === 0 ? <div className="px-3 py-10 text-center text-sm text-muted-foreground">{t("docWorkbench.empty")}</div> : null}
          {loading ? <div className="px-3 py-10 text-center text-sm text-muted-foreground">{t("docWorkbench.loading")}</div> : null}
        </div>
      </aside>

      <main key={selected?.id ?? "empty"} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {draft && selected ? <>
          <div className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b bg-background px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
              {path.map((item, index) => <span key={item.id} className="flex min-w-0 items-center gap-2">{index > 0 ? <ChevronRightIcon className="size-3.5 shrink-0" /> : null}<span className="truncate">{item.title}</span></span>)}
              {path.length > 0 ? <ChevronRightIcon className="size-3.5 shrink-0" /> : null}
              <Input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className="h-8 min-w-32 max-w-xl flex-1 border-border/60 bg-muted/30 px-2 text-sm font-medium text-foreground shadow-none hover:border-border hover:bg-muted/50 focus-visible:bg-background"
                placeholder={t("docWorkbench.pageTitle")}
                aria-label={t("docWorkbench.pageTitle")}
              />
              <Badge variant="outline" className="ml-1 shrink-0">{statusLabel}</Badge>
              {selected.status === "published" && dirty ? <span className="hidden text-xs text-amber-600 xl:inline dark:text-amber-400">{t("docWorkbench.publishedSaveWarning")}</span> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={cn("hidden text-xs sm:inline", dirty ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{dirty ? t("docWorkbench.unsaved") : t("docWorkbench.savedState")}</span>
              <Button size="icon" variant="ghost" title={t("docWorkbench.pageSettings")} aria-label={t("docWorkbench.pageSettings")} onClick={() => setSettingsOpen(true)}><Settings2Icon /></Button>
              {selected.status === "published" ? <Button size="icon" variant="ghost" nativeButton={false} title={t("docWorkbench.openPublicPage")} aria-label={t("docWorkbench.openPublicPage")} render={<a href={`/support/docs/${selected.slug}`} target="_blank" rel="noreferrer" />}><ExternalLinkIcon /></Button> : null}
              <Button variant={selected.status === "published" ? "default" : "outline"} onClick={() => void save()} disabled={!dirty || saving} title={t("docWorkbench.save")}><SaveIcon /><span className="hidden xl:inline">{saving ? t("docWorkbench.saving") : t("docWorkbench.save")}</span></Button>
              {selected.status === "published" ? <Button variant="outline" onClick={() => void changeStatus("draft")} disabled={saving} title={t("docWorkbench.withdrawAction")}><EyeOffIcon /><span className="hidden xl:inline">{t("docWorkbench.withdrawAction")}</span></Button> : selected.status !== "hidden" ? <Button variant="outline" onClick={() => void changeStatus("hidden")} disabled={saving} title={t("docWorkbench.hiddenAction")}><EyeOffIcon /><span className="hidden xl:inline">{t("docWorkbench.hiddenAction")}</span></Button> : null}
              {selected.status !== "published" ? <Button onClick={() => void changeStatus("published")} disabled={saving || dirty} title={t("docWorkbench.publishedAction")}><RocketIcon /><span className="hidden xl:inline">{t("docWorkbench.publishedAction")}</span></Button> : null}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-card">
            <div className="flex min-h-0 flex-1 flex-col">
              <ContentEditor
                value={{ mode: draft.contentType === "html" ? "html" : "markdown", raw: draft.content }}
                onChange={(content) => setDraft({ ...draft, content: content.raw, contentType: content.mode })}
                onUploadImage={async (file) => {
                  const asset = await uploadAsset(file, "support/docs")
                  return { url: asset.url, alt: asset.filename, title: asset.filename }
                }}
                placeholder={t("docWorkbench.contentPlaceholder")}
                height="100%"
                className="min-h-0 flex-1 [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent"
              />
            </div>
          </div>
        </> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("docWorkbench.selectPrompt")}</div>}
      </main>

      <CreatePageDialog key={`${createState.open}-${createState.parentId}`} state={createState} pages={pages} onOpenChange={(open) => setCreateState((current) => ({ ...current, open }))} onCreated={async (id) => { setCreateState(blankCreate); await load(id) }} />
      <PageSettingsDialog key={`${selected?.id ?? 0}-${settingsOpen}`} open={settingsOpen} onOpenChange={setSettingsOpen} pages={pages} selected={selected} draft={draft} saving={saving} onSave={saveSettings} />
    </div>
  )
}

type PageTreeNodeProps = {
  page: AdminDocPage
  pages: AdminDocPage[]
  depth: number
  selectedId?: number
  expanded: Set<number>
  forceExpanded: boolean
  visibleIds: Set<number> | null
  sortingDisabled: boolean
  onToggle: (id: number) => void
  onSelect: (page: AdminDocPage) => void
  onCreate: (parentId: number) => void
  onDelete: (page: AdminDocPage) => void
}

function PageTreeNode(props: PageTreeNodeProps) {
  const { page, pages, depth, selectedId, expanded, forceExpanded, visibleIds, sortingDisabled, onToggle, onSelect, onCreate, onDelete } = props
  const t = useI18n()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id, disabled: sortingDisabled })
  const children = childPages(pages, page.id).filter((item) => !visibleIds || visibleIds.has(item.id))
  const open = forceExpanded || expanded.has(page.id)
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition: isDragging ? undefined : transition }

  return <div ref={setNodeRef} style={style} className={cn(isDragging && "relative z-10 opacity-30")}>
    <ContextMenu>
      <ContextMenuTrigger className="block">
        <div className={cn("group flex h-9 items-center rounded-md pr-1 text-sm", selectedId === page.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/60", isDragging && "shadow-sm")} style={{ paddingLeft: 4 + depth * 16 }}>
          <button type="button" className="flex size-7 shrink-0 items-center justify-center" onClick={() => children.length && onToggle(page.id)} aria-label={open ? t("docWorkbench.collapse") : t("docWorkbench.expand")}>
            <ChevronRightIcon className={cn("size-4 transition-transform", !children.length && "opacity-0", open && "rotate-90")} />
          </button>
          <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => void onSelect(page)}>{page.title}</button>
          <span className={cn("mr-1 size-1.5 rounded-full", page.status === "published" ? "bg-emerald-500" : page.status === "hidden" ? "bg-amber-500" : "bg-muted-foreground/40")} />
          <button type="button" className="flex size-7 shrink-0 cursor-grab items-center justify-center text-muted-foreground touch-none active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-35" disabled={sortingDisabled} aria-label={t("docWorkbench.dragPage", { title: page.title })} title={sortingDisabled ? t("docWorkbench.dragDisabled") : t("docWorkbench.dragPage", { title: page.title })} {...attributes} {...listeners}>
            <GripVerticalIcon className="size-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" className="opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={t("docWorkbench.pageActions", { title: page.title })} />}><MoreHorizontalIcon /></DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onCreate(page.id)}><FilePlus2Icon />{t("docWorkbench.createChildPage")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => void onDelete(page)}><Trash2Icon />{t("docWorkbench.deletePage")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-40">
        <ContextMenuItem onClick={() => onCreate(page.id)}><FilePlus2Icon />{t("docWorkbench.createChildPage")}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => void onDelete(page)}><Trash2Icon />{t("docWorkbench.deletePage")}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
    {open ? <SortableContext items={children.map((child) => child.id)} strategy={verticalListSortingStrategy}>
      {children.map((child) => <PageTreeNode key={child.id} {...props} page={child} depth={depth + 1} />)}
    </SortableContext> : null}
  </div>
}

function PageDragOverlay({ page }: { page: AdminDocPage }) {
  return <div className="flex h-9 w-64 items-center rounded-md border bg-background px-3 text-sm shadow-lg">
    <GripVerticalIcon className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
    <span className="truncate font-medium">{page.title}</span>
  </div>
}

function CreatePageDialog({ state, pages, onOpenChange, onCreated }: { state: CreateState; pages: AdminDocPage[]; onOpenChange: (open: boolean) => void; onCreated: (id: number) => void }) {
  const t = useI18n()
  const handleApiError = useApiErrorHandler()
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [parentId, setParentId] = useState(state.parentId)
  const [creating, setCreating] = useState(false)

  async function create() {
    if (!title.trim() || !slug.trim() || creating) return
    setCreating(true)
    try {
      const page = await saveDocPageAdmin({
        parentId,
        title: title.trim(),
        slug: slug.trim(),
        summary: "",
        contentType: "markdown",
        content: "",
        tags: [],
        status: "draft",
        sortNo: childPages(pages, parentId).length,
      })
      toast.success(t("docWorkbench.created"))
      onCreated(page.id)
    } catch (error) {
      handleApiError(error)
    } finally {
      setCreating(false)
    }
  }

  return <Dialog open={state.open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>{t("docWorkbench.createPage")}</DialogTitle><DialogDescription>{t("docWorkbench.createDescription")}</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2"><Label>{t("docWorkbench.pageTitle")}</Label><Input autoFocus value={title} onChange={(event) => { setTitle(event.target.value); if (!slug) setSlug(normalizeSupportSlug(event.target.value)) }} /></div>
        <div className="grid gap-2"><Label>{t("docWorkbench.slug")}</Label><Input value={slug} onChange={(event) => setSlug(normalizeSupportSlug(event.target.value))} placeholder="getting-started" /><p className="text-xs leading-5 text-muted-foreground">{t("docWorkbench.slugFormatHint")}</p></div>
        <div className="grid gap-2"><Label>{t("docWorkbench.parentPage")}</Label><OptionCombobox value={String(parentId)} onChange={(value) => setParentId(Number(value))} placeholder={t("docWorkbench.selectParentPage")} options={[{ value: "0", label: t("docWorkbench.rootDirectory") }, ...pages.map((page) => ({ value: String(page.id), label: page.title }))]} /></div>
      </div>
      <DialogFooter><Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>{t("docWorkbench.cancel")}</Button><Button disabled={!title.trim() || !slug.trim() || creating} onClick={() => void create()}>{creating ? t("docWorkbench.creating") : t("docWorkbench.createAndEdit")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function PageSettingsDialog({ open, onOpenChange, pages, selected, draft, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; pages: AdminDocPage[]; selected: AdminDocPage | null; draft: PageDraft | null; saving: boolean; onSave: (settings: PageSettingsDraft) => void }) {
  const t = useI18n()
  const [settings, setSettings] = useState<PageSettingsDraft>(() => ({ parentId: draft?.parentId ?? 0, slug: draft?.slug ?? "", summary: draft?.summary ?? "" }))
  if (!draft || !selected) return null
  const excluded = descendantIds(pages, selected.id)
  excluded.add(selected.id)
  const options = [{ value: "0", label: t("docWorkbench.rootDirectory") }, ...pages.filter((page) => !excluded.has(page.id)).map((page) => ({ value: String(page.id), label: page.title }))]

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>{t("docWorkbench.pageSettings")}</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2"><Label>{t("docWorkbench.parentPage")}</Label><OptionCombobox value={String(settings.parentId)} onChange={(value) => setSettings({ ...settings, parentId: Number(value) })} placeholder={t("docWorkbench.selectParentPage")} options={options} /></div>
        <div className="grid gap-2"><Label>{t("docWorkbench.slug")}</Label><Input value={settings.slug} onChange={(event) => setSettings({ ...settings, slug: normalizeSupportSlug(event.target.value) })} /><p className="text-xs leading-5 text-muted-foreground">{t("docWorkbench.slugFormatHint")}</p><p className="text-xs leading-5 text-muted-foreground">{t("docWorkbench.slugChangeWarning")}</p></div>
        <div className="grid gap-2"><Label>{t("docWorkbench.summary")}</Label><Textarea value={settings.summary} onChange={(event) => setSettings({ ...settings, summary: event.target.value })} rows={4} placeholder={t("docWorkbench.summaryPlaceholder")} /></div>
      </div>
      <DialogFooter><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>{t("docWorkbench.cancel")}</Button><Button disabled={!settings.slug.trim() || saving} onClick={() => onSave(settings)}>{saving ? t("docWorkbench.saving") : t("docWorkbench.save")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
