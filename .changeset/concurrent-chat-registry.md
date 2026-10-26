---
"@plaisolutions/client": minor
"@plaisolutions/react": minor
---

Let several conversations stream at the same time and outlive the components that render them. Add `ChatRegistry` (instances keyed by conversation, LRU eviction, `runInvocation` owning uploads + send, `cancel`/`release`, busy keys and `onEvent`/`onError`/`onSettled` fan-out) and `StreamCoordinator` (concurrency budget shared between registries, reserved synchronously). `PlaiChat.getState()` now returns a stable snapshot between changes, and `getRevision()`/`getInitialState()` are new. `useChat({ chat })` subscribes to an external instance without stopping it on unmount; new hooks `useOwnedChatRegistry`, `useRegistryChat`, `useChatRegistryBusy` and `useStreamCoordinator`. Existing `useChat({ transport })` usage is unchanged.
