---
"@plaisolutions/client": minor
"@plaisolutions/react": minor
---

Personal connector tool results (the user's own Gmail, Google Calendar, Outlook) render as cards: found emails, a read email, the calendar agenda grouped by day and saved drafts (with their body), with links to open each item in the provider. Actions awaiting the user's confirmation show what will happen (the email to send, the new event, an update against the current event, the event to delete) with an "awaiting your confirmation" badge instead of "completed", and the confirmation result lists each action's outcome with a link. Any other tool with a confirm policy also shows as pending with its arguments. The tool use indicator names the service and the action ("Searching Gmail"). New `personal_connector` and `tool_confirmation` tool types and their metadata types.
