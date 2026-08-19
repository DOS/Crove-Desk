import { type PageResult } from "@/lib/api/admin"
import { request } from "@/lib/api/client"

const SUPPORT_TOKEN_KEY = "agent_desk_support_token"

export type SupportCategory = {
  id: number
  name: string
  slug: string
  description: string
  parentId?: number
  sortNo: number
  status: number
}

export type SupportArticle = {
  id: number
  categoryId: number
  categoryName: string
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
}

export type SupportQuestion = {
  id: number
  categoryId: number
  categoryName: string
  customerId: number
  customerName: string
  title: string
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

export type SupportCustomer = {
  id: number
  name: string
  email: string
}

export type SupportLoginResponse = {
  accessToken: string
  expiresAt: string
  customer: SupportCustomer
}

export function readSupportToken() {
  if (typeof window === "undefined") {
    return ""
  }
  return localStorage.getItem(SUPPORT_TOKEN_KEY) || ""
}

export function writeSupportToken(token: string) {
  localStorage.setItem(SUPPORT_TOKEN_KEY, token)
}

export function clearSupportToken() {
  localStorage.removeItem(SUPPORT_TOKEN_KEY)
}

function supportAuthHeaders() {
  const token = readSupportToken()
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

export function loginSupportCustomer(payload: { email: string; password: string }) {
  return request<SupportLoginResponse>("/api/support/auth/login", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify(payload),
  })
}

export function registerSupportCustomer(payload: { name: string; email: string; password: string }) {
  return request<SupportLoginResponse>("/api/support/auth/register", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify(payload),
  })
}

export function fetchSupportMe() {
  return request<SupportCustomer>("/api/support/me", {
    skipAuth: true,
    headers: supportAuthHeaders(),
  })
}

export function fetchSupportArticleCategories() {
  return request<SupportCategory[]>("/api/support/article-category/list", { skipAuth: true })
}

export function fetchSupportArticles(query?: Record<string, string | number | undefined>) {
  return request<PageResult<SupportArticle>>(`/api/support/article/list${toQueryString(query)}`, {
    skipAuth: true,
  })
}

export function fetchSupportArticle(idOrSlug: string | number) {
  return request<SupportArticle>(`/api/support/article/${idOrSlug}`, { skipAuth: true })
}

export function submitSupportArticleFeedback(id: number, helpful: boolean) {
  return request<void>("/api/support/article/feedback", {
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
  content: string
  tags: string[]
}) {
  return request<SupportQuestion>("/api/support/question/create", {
    method: "POST",
    skipAuth: true,
    headers: supportAuthHeaders(),
    body: JSON.stringify(payload),
  })
}

export function createSupportAnswer(payload: { questionId: number; content: string }) {
  return request<SupportAnswer>("/api/support/answer/create", {
    method: "POST",
    skipAuth: true,
    headers: supportAuthHeaders(),
    body: JSON.stringify(payload),
  })
}

export function acceptSupportAnswer(questionId: number, answerId: number) {
  return request<void>("/api/support/question/accept_answer", {
    method: "POST",
    skipAuth: true,
    headers: supportAuthHeaders(),
    body: JSON.stringify({ questionId, answerId }),
  })
}

export function voteSupportQuestion(id: number) {
  return request<void>("/api/support/question/vote", {
    method: "POST",
    skipAuth: true,
    headers: supportAuthHeaders(),
    body: JSON.stringify({ id }),
  })
}

export function voteSupportAnswer(id: number) {
  return request<void>("/api/support/answer/vote", {
    method: "POST",
    skipAuth: true,
    headers: supportAuthHeaders(),
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
