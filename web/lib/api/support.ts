import { type PageResult } from "@/lib/api/admin"
import { loginWithPassword } from "@/lib/api/auth"
import { request } from "@/lib/api/client"
import { type AuthSession, writeSession } from "@/lib/auth"

export type SupportHelpPage = {
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
  helpPath?: string
}

export type SupportHelpNavigationNode = Pick<SupportHelpPage, "id" | "parentId" | "title" | "slug" | "sortNo"> & {
  children: SupportHelpNavigationNode[]
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

export function fetchSupportHelpPages(query?: Record<string, string | number | undefined>) {
  return request<PageResult<SupportHelpPage>>(`/api/support/help-page/list${toQueryString(query)}`, {
    skipAuth: true,
  })
}

export function fetchSupportHelpNavigation() {
  return request<SupportHelpNavigationNode[]>("/api/support/help-page/navigation", { skipAuth: true })
}

export function fetchSupportHelpPage(id: number) {
  return request<SupportHelpPage>(`/api/support/help-page/${id}`, { skipAuth: true })
}

export function submitSupportHelpPageFeedback(id: number, helpful: boolean) {
  return request<void>("/api/support/help-page/feedback", {
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
