import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  AssistantMessage,
  MessageAvatar,
  MessageFooter,
} from "../components"

const avatar = (
  <MessageAvatar
    src="https://example.com/assistant.png"
    fallback="PLai Assistant"
  />
)

describe("AssistantMessage", () => {
  it("renders tools without an avatar and the assistant content with one avatar", () => {
    const view = render(
      <AssistantMessage
        avatar={avatar}
        footer={<MessageFooter>Message actions</MessageFooter>}
        message={{
          id: "assistant-turn",
          role: "assistant",
          parts: [
            { type: "text", text: "Here is the answer." },
            {
              type: "tool-call",
              id: "web-search",
              name: "search_web",
              toolType: "perplexity",
              input: { query: "PLai" },
              state: "completed",
              metadata: {
                type: "perplexity",
                search_results: [
                  {
                    title: "PLai",
                    url: "https://example.com/plai",
                  },
                ],
              },
            },
          ],
        }}
      />,
    )

    const toolsRow = view.container.querySelector(
      ".plai-assistant-message-tools",
    ) as HTMLElement
    const contentRow = view.container.querySelector(
      ".plai-assistant-message-content",
    ) as HTMLElement

    expect(toolsRow).toBeTruthy()
    expect(contentRow).toBeTruthy()
    expect(toolsRow.querySelector(".plai-message-avatar")).toBeNull()
    expect(
      toolsRow.querySelector(".plai-assistant-message-avatar-spacer"),
    ).toBeTruthy()
    expect(contentRow.querySelector(".plai-message-avatar")).toBeTruthy()
    expect(view.container.querySelectorAll(".plai-message-avatar")).toHaveLength(
      1,
    )
    expect(within(toolsRow).getByText("Internet search results")).toBeTruthy()
    expect(within(contentRow).getByText("Here is the answer.")).toBeTruthy()
    expect(within(contentRow).getByText("Message actions")).toBeTruthy()
    expect(view.container.firstElementChild?.firstElementChild).toBe(toolsRow)
  })

  it("keeps a pending tool row avatar-free until assistant content starts", () => {
    const view = render(
      <AssistantMessage
        avatar={avatar}
        message={{
          id: "pending-turn",
          role: "assistant",
          parts: [
            {
              type: "tool-call",
              id: "pending-tool",
              name: "search_docs",
              toolType: "datasource",
              input: {},
              state: "pending",
            },
          ],
        }}
      />,
    )

    expect(screen.getByRole("status")).toBeTruthy()
    expect(
      view.container.querySelector(".plai-assistant-message-tools"),
    ).toBeTruthy()
    expect(
      view.container.querySelector(".plai-assistant-message-content"),
    ).toBeNull()
    expect(view.container.querySelector(".plai-message-avatar")).toBeNull()
  })

  it("omits the tool row for an empty completed datasource", () => {
    const view = render(
      <AssistantMessage
        avatar={avatar}
        message={{
          id: "empty-datasource-turn",
          role: "assistant",
          parts: [
            {
              type: "tool-call",
              id: "empty-datasource",
              name: "search_docs",
              toolType: "datasource",
              input: {},
              state: "completed",
              metadata: {
                documents_metadata: [],
                chunk_ids: null,
                relevance_scores: null,
                resources: [],
              },
            },
            { type: "text", text: "No matching resources were found." },
          ],
        }}
      />,
    )

    expect(
      view.container.querySelector(".plai-assistant-message-tools"),
    ).toBeNull()
    expect(screen.getByText("No matching resources were found.")).toBeTruthy()
    expect(view.container.querySelectorAll(".plai-message-avatar")).toHaveLength(
      1,
    )
  })

  it("preserves custom tool renderers even when a datasource has no resources", () => {
    const renderToolCall = vi.fn(() => <div>Custom datasource result</div>)
    const view = render(
      <AssistantMessage
        avatar={avatar}
        messagePartsProps={{ renderToolCall }}
        message={{
          id: "custom-tool-turn",
          role: "assistant",
          parts: [
            {
              type: "tool-call",
              id: "custom-datasource",
              name: "search_docs",
              toolType: "datasource",
              input: {},
              state: "completed",
            },
            { type: "text", text: "Custom answer" },
          ],
        }}
      />,
    )

    expect(screen.getByText("Custom datasource result")).toBeTruthy()
    expect(renderToolCall).toHaveBeenCalledOnce()
    expect(
      view.container
        .querySelector(".plai-assistant-message-tools")
        ?.querySelector(".plai-message-avatar"),
    ).toBeNull()
  })
})
