"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
  type UIEvent,
} from "react"

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerScrollable,
} from "@/components/ui/message-scroller"
import { cn } from "@/lib/utils"

export type ConversationMessageScrollerHandle = {
  scrollToBottom: () => void
}

type ConversationMessageScrollerProps = {
  children: ReactNode
  className?: string
  viewportClassName?: string
  contentClassName?: string
  hasMoreOlder?: boolean
  loadingOlder?: boolean
  onLoadOlder?: () => void | Promise<void>
  onNearBottomChange?: (nearBottom: boolean) => void
  onNearBottomVisible?: () => void
  topSlot?: ReactNode
  scrollThreshold?: number
}

const ConversationMessageScrollerInner = forwardRef<
  ConversationMessageScrollerHandle,
  ConversationMessageScrollerProps
>(function ConversationMessageScrollerInner(
  {
    children,
    className,
    viewportClassName,
    contentClassName,
    hasMoreOlder = false,
    loadingOlder = false,
    onLoadOlder,
    onNearBottomChange,
    onNearBottomVisible,
    topSlot,
    scrollThreshold = 120,
  },
  ref,
) {
  const { scrollToEnd } = useMessageScroller()
  const scrollable = useMessageScrollerScrollable()
  const loadingRef = useRef(false)
  const nearBottomRef = useRef(false)
  const onLoadOlderRef = useRef(onLoadOlder)
  const onNearBottomChangeRef = useRef(onNearBottomChange)
  const onNearBottomVisibleRef = useRef(onNearBottomVisible)

  useEffect(() => {
    onLoadOlderRef.current = onLoadOlder
  }, [onLoadOlder])

  useEffect(() => {
    onNearBottomChangeRef.current = onNearBottomChange
  }, [onNearBottomChange])

  useEffect(() => {
    onNearBottomVisibleRef.current = onNearBottomVisible
  }, [onNearBottomVisible])

  useEffect(() => {
    loadingRef.current = loadingOlder
  }, [loadingOlder])

  useEffect(() => {
    const nearBottom = !scrollable.end
    nearBottomRef.current = nearBottom
    onNearBottomChangeRef.current?.(nearBottom)
    if (nearBottom) {
      onNearBottomVisibleRef.current?.()
    }
  }, [scrollable.end])

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      scrollToEnd({ behavior: "auto" })
    },
  }), [scrollToEnd])

  const maybeLoadOlder = useCallback((viewport: HTMLElement) => {
    if (!hasMoreOlder || loadingRef.current || !onLoadOlderRef.current) {
      return
    }
    if (viewport.scrollTop > scrollThreshold) {
      return
    }
    loadingRef.current = true
    void Promise.resolve(onLoadOlderRef.current()).finally(() => {
      loadingRef.current = false
    })
  }, [hasMoreOlder, scrollThreshold])

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      maybeLoadOlder(event.currentTarget)
    },
    [maybeLoadOlder],
  )

  return (
    <MessageScroller className={className}>
      <MessageScrollerViewport
        className={cn("agent-desk-scrollbar bg-muted/10", viewportClassName)}
        onScroll={handleScroll}
        preserveScrollOnPrepend
      >
        <MessageScrollerContent
          className={cn("gap-4 px-6 py-5", contentClassName)}
        >
          {topSlot}
          {children}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton />
    </MessageScroller>
  )
})

export const ConversationMessageScroller = forwardRef<
  ConversationMessageScrollerHandle,
  ConversationMessageScrollerProps
>(function ConversationMessageScroller(props, ref) {
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <ConversationMessageScrollerInner {...props} ref={ref} />
    </MessageScrollerProvider>
  )
})

export { MessageScrollerItem as ConversationMessageScrollerItem }
