"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Play, Pause, Loader2 } from "lucide-react"
import Link from "next/link"
import { CadenceStatus } from "@/types"

interface CadenceRowActionsProps {
  id: string
  name: string
  status: CadenceStatus
}

export function CadenceRowActions({ id, name, status }: CadenceRowActionsProps) {
  const router = useRouter()
  const [loadingToggle, setLoadingToggle] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)

  async function handleToggle() {
    setLoadingToggle(true)
    const newStatus: CadenceStatus = status === "active" ? "paused" : "active"
    await fetch(`/api/cadences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
    setLoadingToggle(false)
  }

  async function handleDelete() {
    if (!confirm(`Excluir a cadência "${name}"? Esta ação não pode ser desfeita.`)) return
    setLoadingDelete(true)
    await fetch(`/api/cadences/${id}`, { method: "DELETE" })
    router.refresh()
    setLoadingDelete(false)
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {(status === "active" || status === "paused") && (
        <Button
          variant="ghost"
          size="sm"
          title={status === "active" ? "Pausar" : "Ativar"}
          className="text-slate-400 hover:text-slate-700"
          onClick={handleToggle}
          disabled={loadingToggle}
        >
          {loadingToggle ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : status === "active" ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </Button>
      )}

      <Link href={`/cadences/${id}`}>
        <Button
          variant="ghost"
          size="sm"
          title="Editar"
          className="text-slate-400 hover:text-slate-700"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </Link>

      <Button
        variant="ghost"
        size="sm"
        title="Excluir"
        className="text-slate-400 hover:text-red-500"
        onClick={handleDelete}
        disabled={loadingDelete}
      >
        {loadingDelete ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  )
}
