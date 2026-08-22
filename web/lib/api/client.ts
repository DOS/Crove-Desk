import { expireSession, readSession } from "@/lib/auth"
import { translateCurrentMessage } from "@/i18n/messages"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || ""

type JsonResult<T> = {
  errorCode: number
  message: string
  data: T
  success: boolean
}

type RequestOptions = RequestInit & {
  skipAuth?: boolean
  baseUrl?: string
  onResponse?: (response: Response) => void
}

export type BlobResponse = {
  blob: Blob
  filename: string
}

export class ApiRequestError extends Error {
  errorCode?: number

  constructor(message: string, errorCode?: number, options?: ErrorOptions) {
    super(message, options)
    this.name = "ApiRequestError"
    this.errorCode = errorCode
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError
}

function normalizeApiRequestError(error: unknown) {
  if (isApiRequestError(error)) {
    return error
  }
  return new ApiRequestError(
    translateCurrentMessage("api.requestFailed"),
    undefined,
    { cause: error }
  )
}

async function parseResult<T>(response: Response) {
  const payload = (await response.json()) as JsonResult<T>
  if (!response.ok || !payload.success) {
    if (payload.errorCode === 3000 || payload.errorCode === 3002) {
      expireSession()
    }
    throw new ApiRequestError(
      payload.message || translateCurrentMessage("api.requestFailed"),
      payload.errorCode
    )
  }
  return payload.data
}

function buildRequestHeaders(headers: HeadersInit | undefined, skipAuth?: boolean, body?: BodyInit | null) {
  const session = readSession()
  const authHeaders = new Headers(headers)

  if (!skipAuth && session?.accessToken) {
    authHeaders.set("Authorization", `Bearer ${session.accessToken}`)
  }
  if (
    !authHeaders.has("Content-Type") &&
    body &&
    !(typeof FormData !== "undefined" && body instanceof FormData)
  ) {
    authHeaders.set("Content-Type", "application/json")
  }
  return authHeaders
}

function parseFilename(contentDisposition: string | null) {
  if (!contentDisposition) {
    return ""
  }
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }
  const match = contentDisposition.match(/filename="?([^";]+)"?/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ""
}

export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { headers, skipAuth, baseUrl, onResponse, ...rest } = options
  delete (rest as RequestOptions).baseUrl
  delete (rest as RequestOptions).onResponse
  const authHeaders = buildRequestHeaders(headers, skipAuth, rest.body)

  const requestBaseUrl = baseUrl !== undefined ? baseUrl : API_BASE_URL
  try {
    const response = await fetch(`${requestBaseUrl}${path}`, {
      ...rest,
      headers: authHeaders,
      cache: "no-store",
    })
    onResponse?.(response)
    return await parseResult<T>(response)
  } catch (error) {
    throw normalizeApiRequestError(error)
  }
}

export async function requestBlob(
  path: string,
  options: RequestOptions = {}
): Promise<BlobResponse> {
  const { headers, skipAuth, baseUrl, onResponse, ...rest } = options
  delete (rest as RequestOptions).baseUrl
  delete (rest as RequestOptions).onResponse
  const authHeaders = buildRequestHeaders(headers, skipAuth, rest.body)
  const requestBaseUrl = baseUrl !== undefined ? baseUrl : API_BASE_URL
  const response = await fetch(`${requestBaseUrl}${path}`, {
    ...rest,
    headers: authHeaders,
    cache: "no-store",
  })
  onResponse?.(response)

  const contentType = response.headers.get("Content-Type") ?? ""
  if (contentType.includes("application/json")) {
    try {
      await parseResult<never>(response)
    } catch (error) {
      throw error
    }
    throw new ApiRequestError(translateCurrentMessage("api.requestFailed"))
  }
  if (!response.ok) {
    throw new ApiRequestError(response.statusText || translateCurrentMessage("api.requestFailed"))
  }
  return {
    blob: await response.blob(),
    filename: parseFilename(response.headers.get("Content-Disposition")),
  }
}
