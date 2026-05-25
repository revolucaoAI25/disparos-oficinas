"use client"

import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#fff",
            border: "1px solid #e2e8f0",
            color: "#0f172a",
          },
        }}
      />
    </>
  )
}
