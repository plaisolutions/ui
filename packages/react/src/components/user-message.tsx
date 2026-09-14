import type { UIMessage } from "@plaisolutions/client"
import type { ReactNode } from "react"
import { joinClasses } from "./internal/join-classes"
import {
  MessageContent,
  MessageParts,
  MessageRoot,
  type MessagePartsProps,
  type MessageRootProps,
} from "./message"

type UserMessagePartsProps = Omit<MessagePartsProps, "className" | "message">

export type UserMessageProps = Omit<MessageRootProps, "align" | "children"> & {
  message: UIMessage
  avatar?: ReactNode
  footer?: ReactNode
  contentClassName?: string
  partsClassName?: string
  messagePartsProps?: UserMessagePartsProps
}

export function UserMessage({
  message,
  avatar,
  footer,
  contentClassName,
  partsClassName,
  messagePartsProps,
  className,
  ...props
}: UserMessageProps) {
  return (
    <MessageRoot
      align="end"
      className={joinClasses("plai-user-message", className)}
      {...props}
    >
      {avatar}
      <MessageContent className={contentClassName}>
        <MessageParts
          {...messagePartsProps}
          message={message}
          className={partsClassName}
        />
        {footer}
      </MessageContent>
    </MessageRoot>
  )
}
