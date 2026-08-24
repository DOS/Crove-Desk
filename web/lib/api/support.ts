import { type PageResult } from "@/lib/api/admin"
import { loginWithPassword } from "@/lib/api/auth"
import { request } from "@/lib/api/client"
import { type AuthSession, writeSession } from "@/lib/auth"

export type DocPage = {
  id: number
  parentId: number
  title: string
  slug: string
  summary: string
  contentType: string
  content: string
  coverUrl: string
  tags: string[]
  status: string
  sortNo: number
  viewCount: number
  helpfulCount: number
  unhelpfulCount: number
  publishedAt: string
  createdAt: string
  updatedAt: string
  docPath?: string
}

export type DocNavigationNode = Pick<DocPage, "id" | "parentId" | "title" | "slug" | "sortNo"> & {
  children: DocNavigationNode[]
}

export type SupportUser = {
  id: number
  name: string
  email: string
  userType: string
}

export async function loginSupportCustomer(payload: { email: string; password: string }) {
  return loginWithPassword({ username: payload.email, password: payload.password })
}

export async function registerSupportCustomer(payload: { name: string; email: string; password: string }) {
  const session = await request<AuthSession>("/api/support/auth/register", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify(payload),
  })
  writeSession(session)
  return session
}

export function fetchSupportMe() {
  return request<SupportUser>("/api/support/me")
}

export function fetchDocPages(query?: Record<string, string | number | undefined>) {
  return request<PageResult<DocPage>>(`/api/support/doc-page/list${toQueryString(query)}`, {
    skipAuth: true,
  })
}

export function fetchDocNavigation() {
  return request<DocNavigationNode[]>("/api/support/doc-page/navigation", { skipAuth: true })
}

export function fetchDocPage(id: number) {
  return request<DocPage>(`/api/support/doc-page/${id}`, { skipAuth: true })
}

export function submitDocPageFeedback(id: number, helpful: boolean) {
  return request<void>("/api/support/doc-page/feedback", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ id, helpful }),
  })
}

function toQueryString(query?: Record<string, string | number | undefined>) {
  if (!query) {
    return ""
  }
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") {
      params.set(key, String(value))
    }
  })
  const raw = params.toString()
  return raw ? `?${raw}` : ""
}
