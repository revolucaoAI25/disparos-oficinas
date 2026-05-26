"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Play, Pause, Zap, Loader2 } from "lucide-react"
import { CadenceStatus } from "@/types"

interface CadenceDetailActionsProps {
  id: string
  name: string
  status: CadenceStatus
  pendingDispatches: number
}

export function CadenceDetailActions({
  id,
  name,
  status,
  pendingDispatches,
}: CadenceDetailActionsProps) {
  const router = useRouter()
  const [loadingToggle, setLoadingToggle] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [loadingFire, setLoadingFire] = useState(false)

  async function handleFireNow() {
    setLoadingFire(true)
    await fetch(`/api/cadences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fire_now: true }),
    })
    router.refresh()
    setLoadingFire(false)
  }

  async function handleToggle() {
    setLoadingToggle(true)
    const newStatus: CadenceStatus = status === "active" ? "paused" : "active"
    // draft → active, paused → active, active → paused
    await fetch(`/api/cadences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
    setLoadingToggle(false)
  }

  async function handleDelete() {
    if (!confirm(`Excluir a cadência "${name}"? Esta ação é irreversível.`)) return
    setLoadingDelete(true)
    await fetch(`/api/cadences/${id}`, { method: "DELETE" })
    router.push("/cadences")
  }

  return (
    <div className="flex items-center gap-2">
      {/* Fire now */}
      {status === "active" && pendingDispatches > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleFireNow}
          disabled={loadingFire}
        >
          {loadingFire ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          Disparar Agora
          {!loadingFire && pendingDispatches > 0 && (
            <span className="ml-1 bg-amber-100 text-amber-700 rounded-full px-1.5 text-xs font-semibold">
              {pendingDispatches}
            </span>
          )}
        </Button>
      )}

      {/* Edit */}
      <Link href={`/cadences/${id}/edit`}>
        <Button variant="outline" size="sm">
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Button>
      </Link>

      {/* Toggle status */}
      {(status === "active" || status === "paused" || status === "draft") && (
        <Button
          variant={status === "active" ? "outline" : "success"}
          size="sm"
          onClick={handleToggle}
          disabled={loadingToggle}
        >
          {loadingToggle ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : status === "active" ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              Pausar
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Ativar
            </>
          )}
        </Button>
      )}

      {/* Delete */}
      <Button
        variant="outline"
        size="sm"
        className="text-red-500 border-red-200 hover:bg-red-50"
        onClick={handleDelete}
        disabled={loadingDelete}
      >
        {loadingDelete ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
        Excluir
      </Button>
    </div>
  )
}
