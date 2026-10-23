"use client"

import { useState } from "react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

const DEMO_VIDEO_ID = "JLK1xIt-1zg"

/**
 * A "watch the demo" button that opens the product video in a modal and starts it.
 * The player is only mounted while the modal is open, so closing it stops the sound.
 */
export function DemoVideoButton({ className, title, children }: { className?: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] overflow-hidden bg-black p-0 ring-white/10 sm:max-w-4xl [&>[data-slot=dialog-close]]:z-10 [&>[data-slot=dialog-close]]:text-white [&>[data-slot=dialog-close]]:hover:bg-white/10">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {open && (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="aspect-video w-full"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
