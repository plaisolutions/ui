import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

function SheetDemo() {
  return (
    <Sheet>
      <SheetTrigger className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white">
        Open Sheet
      </SheetTrigger>
      <SheetContent>
        <SheetHeader className="pr-10">
          <SheetTitle>Are you absolutely sure?</SheetTitle>
          <SheetDescription>
            This action cannot be undone. Review the information before
            continuing.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter className="pt-6">
          <SheetClose className="rounded-md border border-neutral-300 px-4 py-2 text-sm">
            Cancel
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

const meta: Meta<typeof SheetDemo> = {
  title: "Components/Sheet",
  component: SheetDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
}

export default meta

type Story = StoryObj<typeof SheetDemo>

export const Default: Story = {}
