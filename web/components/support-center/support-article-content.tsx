"use client"

import MarkdownIt from "markdown-it"
import { useMemo } from "react"

import { SafeRichHTML } from "@/components/safe-rich-html"

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

type SupportArticleContentProps = {
  content: string
  contentType?: string
  id: string
}

export function SupportArticleContent({ content, contentType = "markdown", id }: SupportArticleContentProps) {
  const renderedContent = useMemo(
    () => contentType === "html" ? content : markdownRenderer.render(content),
    [content, contentType],
  )

  return (
    <SafeRichHTML
      id={id}
      html={renderedContent}
      unstyled
      className="typeset typeset-support-docs"
    />
  )
}
