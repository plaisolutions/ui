import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MessageAvatar, MessageFooter, UserMessage } from "../components"

const message = {
  id: "user-turn",
  role: "user" as const,
  parts: [{ type: "text" as const, text: "How does this work?" }],
}

describe("UserMessage", () => {
  it("renders a complete user turn aligned to the end", () => {
    const view = render(
      <UserMessage
        message={message}
        avatar={<MessageAvatar src="" fallback="Jane Doe" />}
        footer={<MessageFooter>Message actions</MessageFooter>}
        contentClassName="custom-content"
        partsClassName="custom-parts"
      />,
    )

    const row = view.container.querySelector(".plai-user-message")

    expect(row?.getAttribute("data-align")).toBe("end")
    expect(row?.classList.contains("flex-row-reverse")).toBe(true)
    expect(row?.querySelectorAll(".plai-message-avatar")).toHaveLength(1)
    expect(row?.querySelector(".custom-content")).toBeTruthy()
    expect(row?.querySelector(".custom-parts")).toBeTruthy()
    expect(screen.getByText("How does this work?")).toBeTruthy()
    expect(screen.getByText("Message actions")).toBeTruthy()
  })

  it("forwards MessageParts options and custom renderers", () => {
    const renderText = vi.fn((part: { text: string }) => (
      <strong>Custom: {part.text}</strong>
    ))

    render(
      <UserMessage
        message={message}
        messagePartsProps={{ locale: "es-ES", renderText }}
      />,
    )

    expect(screen.getByText("Custom: How does this work?")).toBeTruthy()
    expect(renderText).toHaveBeenCalledOnce()
  })
})
