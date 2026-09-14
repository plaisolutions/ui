import type { UIMessage } from "@plaisolutions/client"
import type { HTMLAttributes, ReactNode } from "react"
import { AssistantMessage } from "./assistant-message"
import { joinClasses } from "./internal/join-classes"
import {
  MessageContent,
  MessageParts,
  MessageRoot,
  type MessagePartsProps,
  type MessageRootProps,
} from "./message"
import { UserMessage } from "./user-message"

type RoutedMessagePartsProps = Omit<MessagePartsProps, "className" | "message">

export type RoutedMessageProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  message: UIMessage
  avatar?: ReactNode
  footer?: ReactNode
  messageClassName?: string
  contentClassName?: string
  partsClassName?: string
  toolResultsClassName?: string
  toolPartsClassName?: string
  messagePartsProps?: RoutedMessagePartsProps
}

export type MessageProps = MessageRootProps | RoutedMessageProps

function isRoutedMessageProps(
  props: MessageProps,
): props is RoutedMessageProps {
  return "message" in props
}

export function Message(props: MessageProps) {
  if (!isRoutedMessageProps(props)) return <MessageRoot {...props} />

  const {
    message,
    avatar,
    footer,
    messageClassName,
    contentClassName,
    partsClassName,
    toolResultsClassName,
    toolPartsClassName,
    messagePartsProps,
    className,
    ...rootProps
  } = props

  if (message.role === "assistant") {
    return (
      <AssistantMessage
        {...rootProps}
        className={className}
        message={message}
        avatar={avatar}
        footer={footer}
        messageClassName={messageClassName}
        contentClassName={contentClassName}
        contentPartsClassName={partsClassName}
        toolResultsClassName={toolResultsClassName}
        toolPartsClassName={toolPartsClassName}
        messagePartsProps={messagePartsProps}
      />
    )
  }

  if (message.role === "user") {
    return (
      <UserMessage
        {...rootProps}
        className={joinClasses(className, messageClassName)}
        message={message}
        avatar={avatar}
        footer={footer}
        contentClassName={contentClassName}
        partsClassName={partsClassName}
        messagePartsProps={messagePartsProps}
      />
    )
  }

  return (
    <MessageRoot
      {...rootProps}
      align="start"
      className={joinClasses(className, messageClassName)}
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
