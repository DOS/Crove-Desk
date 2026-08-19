"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronRightIcon, ExternalLinkIcon, FilePlus2Icon, MoreHorizontalIcon, PanelRightIcon, SaveIcon, SearchIcon, Settings2Icon, Trash2Icon } from "lucide-react"
import { MdEditor, MdPreview } from "md-editor-rt"
import "md-editor-rt/lib/style.css"
import { toast } from "sonner"

import { OptionCombobox } from "@/components/option-combobox"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { deleteSupportHelpPageAdmin, fetchSupportHelpPageAdmin, fetchSupportHelpPagesAdmin, saveSupportHelpPageAdmin, type AdminSupportHelpPage } from "@/lib/api/admin"

type PageDraft = Pick<AdminSupportHelpPage, "parentId" | "title" | "slug" | "summary" | "content" | "contentType" | "status" | "sortNo" | "tags">
type CreateState = { open: boolean; parentId: number }

const blankCreate: CreateState = { open: false, parentId: 0 }
const statusOptions = [
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
  { value: "hidden", label: "已隐藏" },
]

function toDraft(page: AdminSupportHelpPage): PageDraft {
  return { parentId: page.parentId ?? 0, title: page.title, slug: page.slug, summary: page.summary ?? "", content: page.content ?? "", contentType: page.contentType || "markdown", status: page.status || "draft", sortNo: page.sortNo ?? 0, tags: page.tags ?? [] }
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

function descendantIds(pages: AdminSupportHelpPage[], id: number) {
  const result = new Set<number>()
  const visit = (parentId: number) => pages.filter((page) => page.parentId === parentId).forEach((page) => { result.add(page.id); visit(page.id) })
  visit(id)
  return result
}

export function SupportHelpWorkbench() {
  const [pages, setPages] = useState<AdminSupportHelpPage[]>([])
  const [selected, setSelected] = useState<AdminSupportHelpPage | null>(null)
  const [draft, setDraft] = useState<PageDraft | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [createState, setCreateState] = useState<CreateState>(blankCreate)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const dirty = Boolean(selected && draft && JSON.stringify(toDraft(selected)) !== JSON.stringify(draft))

  const load = useCallback(async (preferredId?: number) => {
    setLoading(true)
    try {
      const result = await fetchSupportHelpPagesAdmin({ limit: 500 })
      setPages(result.results)
      const id = preferredId ?? selected?.id ?? result.results[0]?.id
      if (id) {
        const detail = await fetchSupportHelpPageAdmin(id)
        setSelected(detail)
        setDraft(toDraft(detail))
        const ancestors = new Set<number>()
        let parentId = detail.parentId
        while (parentId) { ancestors.add(parentId); parentId = result.results.find((page) => page.id === parentId)?.parentId ?? 0 }
        setExpanded((current) => new Set([...current, ...ancestors]))
      } else {
        setSelected(null)
        setDraft(null)
      }
    } finally { setLoading(false) }
  }, [selected?.id])

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key === "s") { event.preventDefault(); void save() } }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  })

  async function selectPage(page: AdminSupportHelpPage) {
    if (page.id === selected?.id) return
    if (dirty && !window.confirm("当前页面有未保存的修改，确定离开吗？")) return
    const detail = await fetchSupportHelpPageAdmin(page.id)
    setSelected(detail)
    setDraft(toDraft(detail))
  }

  async function save() {
    if (!selected || !draft || !draft.title.trim() || !draft.slug.trim()) return
    setSaving(true)
    try {
      const saved = await saveSupportHelpPageAdmin({ id: selected.id, ...draft, title: draft.title.trim(), slug: draft.slug.trim(), summary: draft.summary.trim() })
      setSelected(saved)
      setDraft(toDraft(saved))
      setPages((items) => items.map((item) => item.id === saved.id ? saved : item))
      toast.success("页面已保存")
    } finally { setSaving(false) }
  }

  async function remove(page: AdminSupportHelpPage) {
    if (!window.confirm(`确定删除“${page.title}”吗？有子页面时不能删除。`)) return
    await deleteSupportHelpPageAdmin(page.id)
    toast.success("页面已删除")
    await load(selected?.id === page.id ? undefined : selected?.id)
  }

  const visibleIds = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return null
    const ids = new Set<number>()
    for (const page of pages) {
      if (!`${page.title} ${page.slug} ${page.summary}`.toLowerCase().includes(keyword)) continue
      ids.add(page.id)
      let parentId = page.parentId
      while (parentId) { ids.add(parentId); parentId = pages.find((item) => item.id === parentId)?.parentId ?? 0 }
    }
    return ids
  }, [pages, query])

  return (
    <div className="flex min-h-[calc(100vh-8.5rem)] overflow-hidden border-y bg-background xl:border-x">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-muted/20">
        <div className="flex h-14 items-center justify-between border-b px-3">
          <span className="font-semibold">帮助中心</span>
          <Button size="icon" variant="ghost" title="新建页面" onClick={() => setCreateState({ open: true, parentId: 0 })}><FilePlus2Icon /></Button>
        </div>
        <div className="p-3"><div className="relative"><SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜索页面" /></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {pages.filter((page) => page.parentId === 0 && (!visibleIds || visibleIds.has(page.id))).map((page) => (
            <PageTreeNode key={page.id} page={page} pages={pages} depth={0} selectedId={selected?.id} expanded={expanded} forceExpanded={Boolean(query)} visibleIds={visibleIds} onToggle={(id) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })} onSelect={selectPage} onCreate={(parentId) => setCreateState({ open: true, parentId })} onDelete={remove} />
          ))}
          {!loading && pages.length === 0 ? <div className="px-3 py-10 text-center text-sm text-muted-foreground">新建第一个帮助页面</div> : null}
          {loading ? <div className="px-3 py-10 text-center text-sm text-muted-foreground">正在加载...</div> : null}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {draft && selected ? <>
          <div className="flex h-14 items-center justify-between gap-3 border-b px-4">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{draft.title || "未命名页面"}</p><p className="text-xs text-muted-foreground">{dirty ? "有未保存修改" : "所有修改已保存"}</p></div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" title="页面设置" onClick={() => setSettingsOpen(true)}><Settings2Icon /></Button>
              <Button size="icon" variant="ghost" title="预览" className="xl:hidden" onClick={() => setPreviewOpen(true)}><PanelRightIcon /></Button>
              {selected.status === "published" ? <Button size="icon" variant="ghost" nativeButton={false} title="打开前台页面" render={<a href={`/support/help/${selected.slug}`} target="_blank" rel="noreferrer" />}><ExternalLinkIcon /></Button> : null}
              <Button onClick={() => void save()} disabled={!dirty || saving}><SaveIcon />{saving ? "保存中" : "保存"}</Button>
            </div>
          </div>
          <div className="h-[calc(100%-3.5rem)] overflow-y-auto p-5">
            <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="h-auto border-0 px-0 text-3xl font-semibold shadow-none focus-visible:ring-0" aria-label="页面标题" />
            <Textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className="my-3 min-h-9 resize-none border-0 px-0 text-muted-foreground shadow-none focus-visible:ring-0" placeholder="添加页面摘要" aria-label="页面摘要" />
            <MdEditor modelValue={draft.content} onChange={(content) => setDraft({ ...draft, content })} language="zh-CN" preview={false} className="min-h-[calc(100vh-19rem)] !bg-transparent" />
          </div>
        </> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">从左侧选择页面，或新建页面</div>}
      </main>

      <aside className="hidden w-[38%] min-w-80 max-w-[680px] shrink-0 overflow-y-auto border-l bg-muted/10 p-7 xl:block"><PagePreview draft={draft} childPages={pages.filter((page) => page.parentId === selected?.id)} /></aside>
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}><SheetContent className="w-full overflow-y-auto sm:max-w-2xl"><SheetHeader><SheetTitle>页面预览</SheetTitle></SheetHeader><div className="p-6"><PagePreview draft={draft} childPages={pages.filter((page) => page.parentId === selected?.id)} /></div></SheetContent></Sheet>
      <CreatePageDialog key={`${createState.open}-${createState.parentId}`} state={createState} pages={pages} onOpenChange={(open) => setCreateState((current) => ({ ...current, open }))} onCreated={async (id) => { setCreateState(blankCreate); await load(id) }} />
      <PageSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} pages={pages} selected={selected} draft={draft} onChange={setDraft} />
    </div>
  )
}

function PageTreeNode({ page, pages, depth, selectedId, expanded, forceExpanded, visibleIds, onToggle, onSelect, onCreate, onDelete }: { page: AdminSupportHelpPage; pages: AdminSupportHelpPage[]; depth: number; selectedId?: number; expanded: Set<number>; forceExpanded: boolean; visibleIds: Set<number> | null; onToggle: (id: number) => void; onSelect: (page: AdminSupportHelpPage) => void; onCreate: (parentId: number) => void; onDelete: (page: AdminSupportHelpPage) => void }) {
  const children = pages.filter((item) => item.parentId === page.id && (!visibleIds || visibleIds.has(item.id)))
  const open = forceExpanded || expanded.has(page.id)
  return <div>
    <div className={`group flex h-9 items-center rounded-md pr-1 text-sm ${selectedId === page.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"}`} style={{ paddingLeft: 4 + depth * 16 }}>
      <button type="button" className="flex size-7 shrink-0 items-center justify-center" onClick={() => children.length && onToggle(page.id)} aria-label={open ? "折叠子页面" : "展开子页面"}><ChevronRightIcon className={`size-4 transition-transform ${children.length ? "" : "opacity-0"} ${open ? "rotate-90" : ""}`} /></button>
      <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => void onSelect(page)}>{page.title}</button>
      <span className={`mr-1 size-1.5 rounded-full ${page.status === "published" ? "bg-emerald-500" : page.status === "hidden" ? "bg-amber-500" : "bg-muted-foreground/40"}`} />
      <DropdownMenu><DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" className="opacity-0 group-hover:opacity-100" aria-label={`页面操作：${page.title}`} />}><MoreHorizontalIcon /></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={() => onCreate(page.id)}><FilePlus2Icon />新建子页面</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => void onDelete(page)}><Trash2Icon />删除页面</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>
    {open ? children.map((child) => <PageTreeNode key={child.id} page={child} pages={pages} depth={depth + 1} selectedId={selectedId} expanded={expanded} forceExpanded={forceExpanded} visibleIds={visibleIds} onToggle={onToggle} onSelect={onSelect} onCreate={onCreate} onDelete={onDelete} />) : null}
  </div>
}

function CreatePageDialog({ state, pages, onOpenChange, onCreated }: { state: CreateState; pages: AdminSupportHelpPage[]; onOpenChange: (open: boolean) => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [parentId, setParentId] = useState(state.parentId)
  async function create() {
    if (!title.trim() || !slug.trim()) return
    const page = await saveSupportHelpPageAdmin({ parentId, title: title.trim(), slug: slug.trim(), summary: "", contentType: "markdown", content: `# ${title.trim()}\n`, tags: [], status: "draft", sortNo: pages.filter((item) => item.parentId === parentId).length })
    toast.success("页面已创建")
    onCreated(page.id)
  }
  return <Dialog open={state.open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>新建页面</DialogTitle><DialogDescription>页面既会出现在目录中，也可以直接承载正文。</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>页面标题</Label><Input autoFocus value={title} onChange={(event) => { setTitle(event.target.value); if (!slug) setSlug(slugify(event.target.value)) }} /></div><div className="grid gap-2"><Label>Slug</Label><Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} placeholder="getting-started" /></div><div className="grid gap-2"><Label>父页面</Label><OptionCombobox value={String(parentId)} onChange={(value) => setParentId(Number(value))} placeholder="选择父页面" options={[{ value: "0", label: "根目录" }, ...pages.map((page) => ({ value: String(page.id), label: page.title }))]} /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={!title.trim() || !slug.trim()} onClick={() => void create()}>创建并编辑</Button></DialogFooter></DialogContent></Dialog>
}

function PageSettingsDialog({ open, onOpenChange, pages, selected, draft, onChange }: { open: boolean; onOpenChange: (open: boolean) => void; pages: AdminSupportHelpPage[]; selected: AdminSupportHelpPage | null; draft: PageDraft | null; onChange: (draft: PageDraft) => void }) {
  if (!draft || !selected) return null
  const excluded = descendantIds(pages, selected.id); excluded.add(selected.id)
  const options = [{ value: "0", label: "根目录" }, ...pages.filter((page) => !excluded.has(page.id)).map((page) => ({ value: String(page.id), label: page.title }))]
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>页面设置</DialogTitle><DialogDescription>调整页面位置、访问路径和发布状态，保存后生效。</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>父页面</Label><OptionCombobox value={String(draft.parentId)} onChange={(value) => onChange({ ...draft, parentId: Number(value) })} placeholder="选择父页面" options={options} /></div><div className="grid gap-2"><Label>Slug</Label><Input value={draft.slug} onChange={(event) => onChange({ ...draft, slug: slugify(event.target.value) })} /></div><div className="grid gap-2"><Label>状态</Label><OptionCombobox value={draft.status} onChange={(status) => onChange({ ...draft, status })} placeholder="选择状态" options={statusOptions} /></div><div className="grid gap-2"><Label>排序</Label><Input type="number" min={0} value={draft.sortNo} onChange={(event) => onChange({ ...draft, sortNo: Number(event.target.value) })} /></div></div><DialogFooter><Button onClick={() => onOpenChange(false)}>完成</Button></DialogFooter></DialogContent></Dialog>
}

function PagePreview({ draft, childPages }: { draft: PageDraft | null; childPages: AdminSupportHelpPage[] }) {
  if (!draft) return <div className="text-sm text-muted-foreground">选择页面后查看预览</div>
  return <article><h1 className="mb-2 text-3xl font-semibold">{draft.title || "未命名页面"}</h1>{draft.summary ? <p className="mb-6 text-muted-foreground">{draft.summary}</p> : null}{draft.content ? <MdPreview id="support-help-page-preview" modelValue={draft.content} language="zh-CN" /> : null}{childPages.length ? <div className="mt-8 border-t pt-5"><h2 className="mb-3 text-base font-semibold">本节页面</h2><div className="grid gap-2">{childPages.map((page) => <div key={page.id} className="rounded-md border p-3"><div className="font-medium">{page.title}</div>{page.summary ? <div className="mt-1 text-sm text-muted-foreground">{page.summary}</div> : null}</div>)}</div></div> : null}</article>
}
