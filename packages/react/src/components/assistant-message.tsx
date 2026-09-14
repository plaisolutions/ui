import type {
  ResourceReadModel,
  UIMessage,
  UIToolCallPart,
} from "@plaisolutions/client"
import type { HTMLAttributes, ReactNode } from "react"
import {
  getDatasourceResourceCards,
  isDatasourceResource,
} from "./datasource-tool-resources"
import {
  MessageContent,
  MessageParts,
  MessageRoot,
  type MessagePartsProps,
} from "./message"
import { joinClasses } from "./internal/join-classes"

type AssistantMessagePartsProps = Omit<
  MessagePartsProps,
  "className" | "message"
>

export type AssistantMessageProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  message: UIMessage
  avatar?: ReactNode
  footer?: ReactNode
  messageClassName?: string
  contentClassName?: string
  toolResultsClassName?: string
  toolPartsClassName?: string
  contentPartsClassName?: string
  messagePartsProps?: AssistantMessagePartsProps
}

function getDatasourceResources(part: UIToolCallPart): ResourceReadModel[] {
  if (part.toolType !== "datasource") return []

  const resources = part.metadata?.resources
  return Array.isArray(resources) ? resources.filter(isDatasourceResource) : []
}

function isRenderableToolPart(
  part: UIToolCallPart,
  locale?: string | null,
  hasCustomRenderer = false,
) {
  if (hasCustomRenderer || part.toolType !== "datasource") return true
  if (part.state !== "completed") return true

  return (
    getDatasourceResourceCards(getDatasourceResources(part), locale).length > 0
  )
}

function withParts(message: UIMessage, parts: UIMessage["parts"]): UIMessage {
  return { ...message, parts }
}

export function AssistantMessage({
  message,
  avatar,
  footer,
  messageClassName,
  contentClassName,
  toolResultsClassName,
  toolPartsClassName,
  contentPartsClassName,
  messagePartsProps,
  className,
  ...props
}: AssistantMessageProps) {
  const toolParts = message.parts.filter(
    (part): part is UIToolCallPart => part.type === "tool-call",
  )
  const contentParts = message.parts.filter((part) => part.type !== "tool-call")
  const renderableToolParts = toolParts.filter((part) =>
    isRenderableToolPart(
      part,
      messagePartsProps?.locale,
      Boolean(messagePartsProps?.renderToolCall),
    ),
  )
  const hasContentRow = contentParts.length > 0 || footer !== undefined

  return (
    <div
      className={joinClasses(
        "plai-assistant-message flex w-full flex-col gap-2",
        className,
      )}
      {...props}
    >
      {renderableToolParts.length > 0 ? (
        <div
          className={joinClasses(
            "plai-assistant-message-tools flex w-full items-start gap-3",
            toolResultsClassName,
          )}
        >
          {avatar ? (
            <div
              aria-hidden="true"
              className="plai-assistant-message-avatar-spacer size-10 shrink-0"
            />
          ) : null}
          <div className="min-w-0 max-w-full flex-1">
            <MessageParts
              {...messagePartsProps}
              message={withParts(message, renderableToolParts)}
              className={toolPartsClassName}
            />
          </div>
        </div>
      ) : null}

      {hasContentRow ? (
        <MessageRoot
          align="start"
          className={joinClasses(
            "plai-assistant-message-content",
            messageClassName,
          )}
        >
          {avatar}
          <MessageContent className={contentClassName}>
            {contentParts.length > 0 ? (
              <MessageParts
                {...messagePartsProps}
                message={withParts(message, contentParts)}
                className={contentPartsClassName}
              />
            ) : null}
            {footer}
          </MessageContent>
        </MessageRoot>
      ) : null}
    </div>
  )
}
