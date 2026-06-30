export function streamFromString(
  input: string,
  chunkSize = input.length,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let offset = 0

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= input.length) {
        controller.close()
        return
      }

      const next = input.slice(offset, offset + chunkSize)
      offset += chunkSize
      controller.enqueue(encoder.encode(next))
    },
  })
}
