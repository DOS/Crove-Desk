"use client"

/* eslint-disable react-hooks/refs -- FlowGram useNodeRender exposes reactive render state through a ref-backed adapter. */

import { useLayoutEffect } from "react"

import {
  Field,
  FlowNodeFormData,
  Form,
  type FormModelV2,
  type WorkflowNodeProps,
  useNodeRender,
} from "@flowgram.ai/free-layout-editor"
import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CommentSize = {
  width?: number
  height?: number
}

export function CommentNode(props: WorkflowNodeProps) {
  const render = useNodeRender(props.node)
  const formModel = render.node
    .getData(FlowNodeFormData)
    .getFormModel<FormModelV2>()
  const size = (formModel?.getValueIn("size") ?? {}) as CommentSize
  const width = Math.max(120, Number(size.width) || 240)
  const height = Math.max(80, Number(size.height) || 150)

  useLayoutEffect(() => {
    render.node.transform.update({
      size: { width, height },
    })
  }, [height, render.node, width])

  return (
    <div
      ref={render.nodeRef}
      className={cn(
        "group relative rounded-lg border border-[#f5c451] bg-[#fff9dc] p-2 text-[#594a16] shadow-sm",
        render.selected && "border-[#f59e0b] ring-1 ring-[#f59e0b]/25"
      )}
      style={{ width, height }}
      onMouseDown={render.selectNode}
      onFocus={render.onFocus}
      onBlur={render.onBlur}
    >
      <div
        className="absolute inset-x-0 top-0 h-7 cursor-move"
        draggable={!render.readonly}
        onDragStart={render.startDrag}
      />
      {!render.readonly ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="删除注释"
          className="absolute right-1 top-1 z-10 text-[#a46b00] opacity-0 hover:bg-[#f5c451]/20 group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation()
            render.deleteNode()
          }}
        >
          <Trash2Icon />
        </Button>
      ) : null}
      <Form control={formModel?.formControl}>
        <Field<string> name="note">
          {({ field }) => (
            <textarea
              value={field.value ?? ""}
              readOnly={render.readonly}
              aria-label="注释内容"
              placeholder="输入注释..."
              className="relative mt-5 h-[calc(100%-1.25rem)] w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 outline-none placeholder:text-[#9a8650]"
              onMouseDown={(event) => event.stopPropagation()}
              onChange={(event) => field.onChange(event.target.value)}
            />
          )}
        </Field>
      </Form>
    </div>
  )
}
