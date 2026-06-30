# Vanilla Chat Example

```ts
import { PlaiChat, PlaiThreadTransport } from "@plai/client";

const chat = new PlaiChat({
  transport: new PlaiThreadTransport({
    api: "https://api.plaisolutions.com",
    chatSessionId: "session_123",
    threadId: "thread_456",
    headers: { Authorization: "Bearer <token>" },
  }),
});

chat.subscribe((state) => {
  document.querySelector("#status")!.textContent = state.status;
  document.querySelector("#messages")!.textContent = JSON.stringify(
    state.messages,
    null,
    2,
  );
});

document.querySelector("form")!.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>("#input")!;
  await chat.sendMessage({ text: input.value });
  input.value = "";
});
```
