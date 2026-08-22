import { type PageResult } from "@/lib/api/admin"
import { loginWithPassword } from "@/lib/api/auth"
import { request } from "@/lib/api/client"
import { type AuthSession, writeSession } from "@/lib/auth"

export type SupportCategory = {
  id: number
  name: string
  slug: string
  description: string
  parentId?: number
  sortNo: number
  status: number
}

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

export type SupportQuestion = {
  id: number
  categoryId: number
  categoryName: string
  userId: number
  userName: string
  userType: string
  title: string
  contentType: string
  content: string
  tags: string[]
  status: string
  bestAnswerId: number
  answerCount: number
  voteCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
}

export type SupportAnswer = {
  id: number
  questionId: number
  authorType: string
  authorId: number
  authorName: string
  contentType: string
  content: string
  status: string
  voteCount: number
  isBestAnswer: boolean
  createdAt: string
  updatedAt: string
}

export type SupportQuestionDetail = {
  question: SupportQuestion
  answers: SupportAnswer[]
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

export function fetchSupportQuestionCategories() {
  return request<SupportCategory[]>("/api/support/question-category/list", { skipAuth: true })
}

export function fetchSupportQuestions(query?: Record<string, string | number | undefined>) {
  return request<PageResult<SupportQuestion>>(`/api/support/question/list${toQueryString(query)}`, {
    skipAuth: true,
  })
}

export function fetchSupportQuestion(id: number) {
  return request<SupportQuestionDetail>(`/api/support/question/${id}`, { skipAuth: true })
}

export function createSupportQuestion(payload: {
  categoryId: number
  title: string
  contentType: string
  content: string
  tags: string[]
}) {
  return request<SupportQuestion>("/api/support/question/create", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function createSupportAnswer(payload: { questionId: number; contentType: string; content: string }) {
  return request<SupportAnswer>("/api/support/answer/create", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function acceptSupportAnswer(questionId: number, answerId: number) {
  return request<void>("/api/support/question/accept_answer", {
    method: "POST",
    body: JSON.stringify({ questionId, answerId }),
  })
}

export function voteSupportQuestion(id: number) {
  return request<void>("/api/support/question/vote", {
    method: "POST",
    body: JSON.stringify({ id }),
  })
}

export function voteSupportAnswer(id: number) {
  return request<void>("/api/support/answer/vote", {
    method: "POST",
    body: JSON.stringify({ id }),
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
