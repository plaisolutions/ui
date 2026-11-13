---
"@plaisolutions/react": minor
---

Point the links and images the model writes to generated files at the real file.

- The model often links the files of `code_execution` and `office_documents` with paths that only exist in its sandbox (`sandbox:/mnt/data/chart.png`, `/mnt/data/report.xlsx`, `file:///...`, `./chart.png`), and the host's markdown renderer blocks them. `MessageParts` now rewrites them in assistant messages, before `renderText`, to the `url` of the matching file of the message (the one the cards download). An image of a file that is not an image becomes a link, and a sandbox link with no matching file is removed, keeping its text. Code blocks, code spans, `http(s):` links and anchors are never touched, and text that is still streaming is left as it is.
- New `resolveFileLinks` prop on `MessageParts` (default `true`) to turn it off.
- Exports `resolveGeneratedFileLinks`, `getMessageGeneratedFiles` and the `GeneratedFileLinkTarget` type.
