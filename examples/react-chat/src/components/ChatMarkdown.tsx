import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type ChatMarkdownProps = {
  text: string
}

export function ChatMarkdown({ text }: ChatMarkdownProps) {
  return (
    <ReactMarkdown
      className="chat-markdown"
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href }) => (
          <a href={href} rel="noreferrer noopener" target="_blank">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  )
}
