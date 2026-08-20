"use client"

import { useMemo, type MouseEvent } from "react"
import rehypeHighlight from "rehype-highlight"
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

import { useImageLightboxOptional } from "@/components/image-lightbox"
import { SafeRichHTML } from "@/components/safe-rich-html"
import { useI18n } from "@/i18n/provider"
import { articleHeadingId } from "@/lib/support-article"

type MarkdownNode = {
  children?: MarkdownNode[]
  properties?: Record<string, unknown>
  tagName?: string
  type: string
  value?: string
}

function nodeText(node: MarkdownNode): string {
  if (node.type === "text") return node.value ?? ""
  return node.children?.map(nodeText).join("") ?? ""
}

function rehypeArticleHeadingIds() {
  return (tree: MarkdownNode) => {
    let headingIndex = 0
    const visit = (node: MarkdownNode) => {
      if (node.type === "element" && (node.tagName === "h2" || node.tagName === "h3")) {
        node.properties = {
          ...node.properties,
          className: "scroll-mt-20",
          id: articleHeadingId(nodeText(node), headingIndex),
        }
        headingIndex += 1
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}

function supportArticleUrlTransform(url: string, key: string) {
  const transformed = defaultUrlTransform(url)
  if (!transformed || (key !== "href" && key !== "src")) return transformed
  if (transformed.startsWith("/")) return transformed
  try {
    const parsed = new URL(transformed, "https://support.local")
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? transformed : ""
  } catch {
    return ""
  }
}

type SupportArticleContentProps = {
  content: string
  contentType?: string
  id: string
}

export function SupportArticleContent({ content, contentType = "markdown", id }: SupportArticleContentProps) {
  const t = useI18n()
  const lightbox = useImageLightboxOptional()
  const components = useMemo<Components>(() => ({
    a: ({ children, href, ...props }) => (
      <a {...props} href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    ),
    img: ({ alt, src, ...props }) => (
      // Markdown images can use arbitrary remote hosts, so Next Image cannot optimize them safely.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...props}
        alt={alt ?? ""}
        src={src}
        className={lightbox && typeof src === "string" ? "cursor-zoom-in" : undefined}
        onClick={lightbox && typeof src === "string" ? () => lightbox.open(src, alt ?? "") : undefined}
      />
    ),
    pre: ({ children, ...props }) => {
      const copy = (event: MouseEvent<HTMLButtonElement>) => {
        const code = event.currentTarget.parentElement?.querySelector("code")?.textContent ?? ""
        void navigator.clipboard.writeText(code).then(() => toast.success(t("supportPublic.toast.codeCopied")))
      }
      return (
        <pre {...props} className="group relative">
          {children}
          <button
            type="button"
            className="not-typeset absolute right-2 top-2 rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
            data-not-typeset
            aria-label={t("supportPublic.help.copyCode")}
            onClick={copy}
          >
            {t("supportPublic.help.copyCode")}
          </button>
        </pre>
      )
    },
    table: ({ children, ...props }) => (
      <div className="typeset-scroll">
        <table {...props}>{children}</table>
      </div>
    ),
  }), [lightbox, t])

  if (contentType === "html") {
    return <SafeRichHTML id={id} html={content} unstyled className="typeset typeset-support-docs" />
  }

  return (
    <div id={id} className="typeset typeset-support-docs">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[
          rehypeArticleHeadingIds,
          [rehypeHighlight, { detect: false, plainText: ["text", "txt", "plaintext"] }],
        ]}
        skipHtml
        urlTransform={supportArticleUrlTransform}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
