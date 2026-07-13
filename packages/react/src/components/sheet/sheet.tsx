import type {
  ButtonHTMLAttributes,
  Dispatch,
  DialogHTMLAttributes,
  ForwardedRef,
  HTMLAttributes,
  MutableRefObject,
  PropsWithChildren,
  SetStateAction,
} from "react"
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { X } from "../icons"
import { joinClasses } from "../internal/join-classes"

export type SheetProps = PropsWithChildren<{
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}>

export type SheetTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>
export type SheetCloseProps = ButtonHTMLAttributes<HTMLButtonElement>

export type SheetContentProps = Omit<
  DialogHTMLAttributes<HTMLDialogElement>,
  "open"
> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  closeLabel?: string
}

export type SheetHeaderProps = HTMLAttributes<HTMLDivElement>
export type SheetFooterProps = HTMLAttributes<HTMLDivElement>
export type SheetTitleProps = HTMLAttributes<HTMLHeadingElement>
export type SheetDescriptionProps = HTMLAttributes<HTMLParagraphElement>

type SheetContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: MutableRefObject<HTMLButtonElement | null>
  contentId: string
  titleId: string
  descriptionId: string
  labelledBy: string | undefined
  describedBy: string | undefined
  setLabelledBy: Dispatch<SetStateAction<string | undefined>>
  setDescribedBy: Dispatch<SetStateAction<string | undefined>>
}

const SheetContext = createContext<SheetContextValue | null>(null)

let bodyScrollLockCount = 0
let bodyOverflowBeforeLock = ""

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow
    document.body.style.overflow = "hidden"
  }
  bodyScrollLockCount += 1
}

function unlockBodyScroll() {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = bodyOverflowBeforeLock
  }
}

function useSheetContext(componentName: string) {
  const context = useContext(SheetContext)
  if (!context) {
    throw new Error(`${componentName} must be used within Sheet.`)
  }
  return context
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

export function Sheet({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const [labelledBy, setLabelledBy] = useState<string>()
  const [describedBy, setDescribedBy] = useState<string>()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const open = controlledOpen ?? uncontrolledOpen

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [controlledOpen, onOpenChange],
  )

  const context = useMemo<SheetContextValue>(
    () => ({
      open,
      setOpen,
      triggerRef,
      contentId,
      titleId,
      descriptionId,
      labelledBy,
      describedBy,
      setLabelledBy,
      setDescribedBy,
    }),
    [open, setOpen, contentId, titleId, descriptionId, labelledBy, describedBy],
  )

  return (
    <SheetContext.Provider value={context}>{children}</SheetContext.Provider>
  )
}

export const SheetTrigger = forwardRef<HTMLButtonElement, SheetTriggerProps>(
  function SheetTrigger({ onClick, type = "button", ...props }, forwardedRef) {
    const { open, setOpen, triggerRef, contentId } =
      useSheetContext("SheetTrigger")

    const setTriggerRef = useCallback(
      (element: HTMLButtonElement | null) => {
        triggerRef.current = element
        assignRef(forwardedRef, element)
      },
      [forwardedRef, triggerRef],
    )

    return (
      <button
        {...props}
        ref={setTriggerRef}
        type={type}
        data-slot="sheet-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) {
            setOpen(true)
          }
        }}
      />
    )
  },
)

export const SheetClose = forwardRef<HTMLButtonElement, SheetCloseProps>(
  function SheetClose({ onClick, type = "button", ...props }, forwardedRef) {
    const { setOpen } = useSheetContext("SheetClose")

    return (
      <button
        {...props}
        ref={forwardedRef}
        type={type}
        data-slot="sheet-close"
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) {
            setOpen(false)
          }
        }}
      />
    )
  },
)

function getSideClasses(side: NonNullable<SheetContentProps["side"]>) {
  if (side === "left") {
    return "inset-y-0 left-0 h-full w-full max-w-lg border-r"
  }
  if (side === "top") {
    return "inset-x-0 top-0 max-h-[85vh] w-full border-b"
  }
  if (side === "bottom") {
    return "inset-x-0 bottom-0 max-h-[85vh] w-full border-t"
  }
  return "inset-y-0 right-0 h-full w-full max-w-lg border-l"
}

export const SheetContent = forwardRef<HTMLDialogElement, SheetContentProps>(
  function SheetContent(
    {
      children,
      className,
      side = "right",
      showCloseButton = true,
      closeLabel = "Close",
      onCancel,
      onClick,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    forwardedRef,
  ) {
    const { open, setOpen, triggerRef, contentId, labelledBy, describedBy } =
      useSheetContext("SheetContent")
    const [present, setPresent] = useState(open)
    const dialogRef = useRef<HTMLDialogElement | null>(null)

    const setDialogRef = useCallback(
      (element: HTMLDialogElement | null) => {
        dialogRef.current = element
        assignRef(forwardedRef, element)
      },
      [forwardedRef],
    )

    useEffect(() => {
      if (open) {
        setPresent(true)
      }
    }, [open])

    useEffect(() => {
      if (!present) {
        return
      }

      const dialog = dialogRef.current
      if (!dialog) {
        return
      }

      if (!dialog.open) {
        if (typeof dialog.showModal === "function") {
          dialog.showModal()
        } else {
          dialog.setAttribute("open", "")
        }
      }

      lockBodyScroll()

      const initialFocus =
        dialog.querySelector<HTMLElement>(
          "[data-sheet-initial-focus], [autofocus]",
        ) ??
        dialog.querySelector<HTMLElement>('[data-slot="sheet-title"]') ??
        dialog.querySelector<HTMLElement>('button, [href], [tabindex="0"]')
      initialFocus?.focus({ preventScroll: true })

      return () => {
        unlockBodyScroll()
        if (dialog.open) {
          if (typeof dialog.close === "function") {
            dialog.close()
          } else {
            dialog.removeAttribute("open")
          }
        }
        triggerRef.current?.focus({ preventScroll: true })
      }
    }, [present, triggerRef])

    useEffect(() => {
      if (open || !present) {
        return
      }

      const fallbackTimer = window.setTimeout(() => setPresent(false), 250)
      return () => window.clearTimeout(fallbackTimer)
    }, [open, present])

    if (!present) {
      return null
    }

    const state = open ? "open" : "closed"

    return (
      <dialog
        {...props}
        ref={setDialogRef}
        id={contentId}
        data-slot="sheet-overlay"
        data-state={state}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy ?? labelledBy}
        aria-describedby={ariaDescribedBy ?? describedBy}
        className="plai-sheet-overlay fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-black/80 p-0"
        onCancel={(event) => {
          onCancel?.(event)
          if (!event.defaultPrevented) {
            event.preventDefault()
            setOpen(false)
          }
        }}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented && event.target === event.currentTarget) {
            setOpen(false)
          }
        }}
      >
        <div
          data-slot="sheet-content"
          data-state={state}
          data-side={side}
          className={joinClasses(
            "plai-sheet-content fixed overflow-y-auto border-neutral-200 bg-white px-6 py-5 text-neutral-950 shadow-2xl outline-none",
            getSideClasses(side),
            className,
          )}
          onAnimationEnd={(event) => {
            if (event.currentTarget === event.target && !open) {
              setPresent(false)
            }
          }}
        >
          {showCloseButton ? (
            <SheetClose
              aria-label={closeLabel}
              className="absolute right-4 top-2 rounded-sm p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              <X className="h-5 w-5" />
            </SheetClose>
          ) : null}
          {children}
        </div>
      </dialog>
    )
  },
)

export const SheetHeader = forwardRef<HTMLDivElement, SheetHeaderProps>(
  function SheetHeader({ className, ...props }, forwardedRef) {
    return (
      <div
        {...props}
        ref={forwardedRef}
        data-slot="sheet-header"
        className={joinClasses("flex flex-col gap-4", className)}
      />
    )
  },
)

export const SheetFooter = forwardRef<HTMLDivElement, SheetFooterProps>(
  function SheetFooter({ className, ...props }, forwardedRef) {
    return (
      <div
        {...props}
        ref={forwardedRef}
        data-slot="sheet-footer"
        className={joinClasses("mt-auto flex flex-col gap-2", className)}
      />
    )
  },
)

export const SheetTitle = forwardRef<HTMLHeadingElement, SheetTitleProps>(
  function SheetTitle(
    { className, id, tabIndex = -1, ...props },
    forwardedRef,
  ) {
    const { titleId, setLabelledBy } = useSheetContext("SheetTitle")
    const resolvedId = id ?? titleId

    useEffect(() => {
      setLabelledBy(resolvedId)
      return () => {
        setLabelledBy((current) =>
          current === resolvedId ? undefined : current,
        )
      }
    }, [resolvedId, setLabelledBy])

    return (
      <h2
        {...props}
        ref={forwardedRef}
        id={resolvedId}
        tabIndex={tabIndex}
        data-slot="sheet-title"
        className={joinClasses(
          "text-lg font-semibold leading-6 outline-none",
          className,
        )}
      />
    )
  },
)

export const SheetDescription = forwardRef<
  HTMLParagraphElement,
  SheetDescriptionProps
>(function SheetDescription({ className, id, ...props }, forwardedRef) {
  const { descriptionId, setDescribedBy } = useSheetContext("SheetDescription")
  const resolvedId = id ?? descriptionId

  useEffect(() => {
    setDescribedBy(resolvedId)
    return () => {
      setDescribedBy((current) =>
        current === resolvedId ? undefined : current,
      )
    }
  }, [resolvedId, setDescribedBy])

  return (
    <p
      {...props}
      ref={forwardedRef}
      id={resolvedId}
      data-slot="sheet-description"
      className={joinClasses("text-sm text-neutral-600", className)}
    />
  )
})
