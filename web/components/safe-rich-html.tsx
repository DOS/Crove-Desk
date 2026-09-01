"use client"

import { useMemo } from "react"

import { articleHeadingId } from "@/lib/support-article"
import { cn } from "@/lib/utils"

type SafeRichHTMLProps = {
  html?: string | null
  fallback?: string
  className?: string
  id?: string
  articleHeadingIds?: boolean
  unstyled?: boolean
}

const allowedTags = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
])

const allowedAttrs = new Set(["alt", "class", "height", "href", "rel", "src", "target", "title", "width"])

function escapeHTML(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function looksLikeHTML(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function plainTextToHTML(value: string) {
  return escapeHTML(value)
    .split(/\n{2,}/)
    .map((part) => `<p>${part.replaceAll("\n", "<br>")}</p>`)
    .join("")
}

function isSafeURL(value: string) {
  if (!value) {
    return false
  }
  if (value.startsWith("/")) {
    return true
  }
  try {
    const url = new URL(value, window.location.origin)
    return ["http:", "https:"].includes(url.protocol)
  } catch {
    return false
  }
}

function appendClassName(element: Element, className: string) {
  const current = element.getAttribute("class")?.trim()
  if (!current) {
    element.setAttribute("class", className)
    return
  }
  if (current.split(/\s+/).includes(className)) {
    return
  }
  element.setAttribute("class", `${current} ${className}`)
}

function applyArticleHeadingIds(container: ParentNode) {
  container.querySelectorAll<HTMLElement>("h2, h3").forEach((heading, index) => {
    heading.id = articleHeadingId(heading.textContent || "", index)
    appendClassName(heading, "scroll-mt-20")
  })
}

function sanitizeRichHTML(value: string, options: { articleHeadingIds?: boolean } = {}) {
  const source = looksLikeHTML(value) ? value : plainTextToHTML(value)
  if (typeof window === "undefined") {
    return source
  }

  const doc = new DOMParser().parseFromString(source, "text/html")
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
  const elements: Element[] = []

  while (walker.nextNode()) {
    elements.push(walker.currentNode as Element)
  }

  for (const element of elements) {
    const tag = element.tagName.toLowerCase()
    if (!allowedTags.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }

    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase()
      const attrValue = attr.value.trim()
      if (name.startsWith("on") || !allowedAttrs.has(name)) {
        element.removeAttribute(attr.name)
        continue
      }
      if ((name === "href" || name === "src") && !isSafeURL(attrValue)) {
        element.removeAttribute(attr.name)
      }
    }

    if (tag === "a" && element.getAttribute("href")) {
      element.setAttribute("target", "_blank")
      element.setAttribute("rel", "noreferrer noopener")
    }
  }

  if (options.articleHeadingIds) {
    applyArticleHeadingIds(doc.body)
  }

  return doc.body.innerHTML
}

export function isRichTextEmpty(value?: string | null) {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    return true
  }
  if (typeof window === "undefined") {
    return normalized.replace(/<[^>]*>/g, "").trim() === ""
  }
  const doc = new DOMParser().parseFromString(normalized, "text/html")
  return (doc.body.textContent ?? "").trim() === "" && doc.body.querySelector("img") === null
}

export function SafeRichHTML({ html, fallback = "-", className, id, articleHeadingIds = false, unstyled = false }: SafeRichHTMLProps) {
  const normalized = String(html ?? "").trim()
  const safeHTML = useMemo(() => {
    if (!normalized) {
      return plainTextToHTML(fallback)
    }
    return sanitizeRichHTML(normalized, { articleHeadingIds })
  }, [articleHeadingIds, fallback, normalized])

  return (
    <div
      id={id}
      className={cn(
        !unstyled && "break-words text-sm leading-6 [&_a]:text-primary [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:font-semibold [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_p+*]:mt-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_strong]:font-semibold [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safeHTML }}
    />
  )
}
