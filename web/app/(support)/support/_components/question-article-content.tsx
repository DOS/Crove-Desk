"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import { useImageLightboxOptional } from "@/components/image-lightbox"
import { SupportArticleContent } from "@/app/(support)/support/_components/support-article-content"
import { useI18n } from "@/i18n/provider"
import { articleHeadingId } from "@/lib/support-article"

export function SupportQuestionArticleContent({ content, contentType, id, articleHeadingIds = true }: { content: string; contentType?: string; id: string; articleHeadingIds?: boolean }) {
  const resolvedContentType = contentType || questionContentType(content)
  useHtmlArticleEnhancements(id, content, resolvedContentType, articleHeadingIds)
  return <SupportArticleContent id={id} content={content} contentType={resolvedContentType} articleHeadingIds={articleHeadingIds} />
}

function questionContentType(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content) ? "html" : "markdown"
}

function useHtmlArticleEnhancements(id: string, content: string, contentType: string, articleHeadingIds: boolean) {
  const t = useI18n()
  const lightbox = useImageLightboxOptional()
  useEffect(() => {
    if (contentType !== "html") return
    const container = document.getElementById(id)
    if (!container) return
    const cleanup: Array<() => void> = []
    if (articleHeadingIds) {
      container.querySelectorAll<HTMLElement>("h2, h3").forEach((heading, index) => {
        heading.id = articleHeadingId(heading.textContent || "", index)
        heading.classList.add("scroll-mt-20")
      })
    }
    container.querySelectorAll<HTMLPreElement>("pre").forEach((block) => {
      block.classList.add("group", "relative")
      if (block.querySelector("[data-support-copy-code]")) return
      const button = document.createElement("button")
      button.type = "button"
      button.className = "not-typeset absolute right-2 top-2 rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
      button.dataset.notTypeset = "true"
      button.dataset.supportCopyCode = "true"
      button.textContent = t("supportPublic.help.copyCode")
      button.setAttribute("aria-label", t("supportPublic.help.copyCode"))
      const copy = () => void navigator.clipboard.writeText(block.querySelector("code")?.textContent || block.textContent || "").then(() => toast.success(t("supportPublic.toast.codeCopied")))
      button.addEventListener("click", copy)
      block.appendChild(button)
      cleanup.push(() => { button.removeEventListener("click", copy); button.remove() })
    })
    const articleImages = Array.from(container.querySelectorAll<HTMLImageElement>("img"))
    articleImages.forEach((image, imageIndex) => {
      if (!lightbox) return
      image.classList.add("cursor-zoom-in")
      const open = () => lightbox.openGallery(articleImages.map((item) => ({
        src: item.currentSrc || item.src,
        alt: item.alt,
      })), imageIndex)
      image.addEventListener("click", open)
      cleanup.push(() => image.removeEventListener("click", open))
    })
    container.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
      if (table.parentElement?.classList.contains("typeset-scroll")) return
      const wrapper = document.createElement("div")
      wrapper.className = "typeset-scroll"
      table.before(wrapper)
      wrapper.appendChild(table)
      cleanup.push(() => {
        wrapper.before(table)
        wrapper.remove()
      })
    })
    return () => cleanup.forEach((dispose) => dispose())
  }, [articleHeadingIds, content, contentType, id, lightbox, t])
}
