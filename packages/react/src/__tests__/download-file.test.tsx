import { afterEach, describe, expect, it, vi } from "vitest"
import { downloadFile } from "../components/internal/download-file"

describe("downloadFile", () => {
  const { createObjectURL, revokeObjectURL } = URL

  afterEach(() => {
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("saves the fetched bytes under the file name without navigating", async () => {
    const blob = new Blob(["data"])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(blob, { status: 200 })),
    )
    URL.createObjectURL = vi.fn(() => "blob:local")
    URL.revokeObjectURL = vi.fn()
    const open = vi.spyOn(window, "open").mockReturnValue(null)
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("report.xlsx")
        expect(this.href).toBe("blob:local")
      })

    await downloadFile({
      url: "https://storage.googleapis.com/bucket/report-1a2b3c4d.xlsx",
      name: "report.xlsx",
    })

    expect(fetch).toHaveBeenCalledWith(
      "https://storage.googleapis.com/bucket/report-1a2b3c4d.xlsx",
      { credentials: "omit" },
    )
    expect(click).toHaveBeenCalledOnce()
    expect(open).not.toHaveBeenCalled()
  })

  it("opens the URL in a new tab when the cross-origin read is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    )
    const open = vi.spyOn(window, "open").mockReturnValue(null)

    await downloadFile({ url: "https://example.com/report.xlsx" })

    expect(open).toHaveBeenCalledWith(
      "https://example.com/report.xlsx",
      "_blank",
      "noopener,noreferrer",
    )
  })

  it("rejects on an HTTP error so the caller can report it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    )
    const open = vi.spyOn(window, "open").mockReturnValue(null)

    await expect(
      downloadFile({ url: "https://example.com/report.xlsx" }),
    ).rejects.toThrow("403")
    expect(open).not.toHaveBeenCalled()
  })
})
