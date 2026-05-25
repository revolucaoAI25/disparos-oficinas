"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Loader2, Save, Building2, User, Key } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
  })

  const [org, setOrg] = useState({
    id: "",
    name: "",
  })

  const [passwords, setPasswords] = useState({
    current: "",
    new_password: "",
    confirm: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, role, org_id")
      .eq("id", user.id)
      .single()

    setProfile({
      full_name: profileData?.full_name ?? "",
      email: user.email ?? "",
    })

    if (profileData?.org_id) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", profileData.org_id)
        .single()

      if (orgData) {
        setOrg({ id: orgData.id, name: orgData.name })
      }
    }

    setLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: profile.full_name })
      .eq("id", user.id)

    if (error) {
      toast.error("Erro ao salvar perfil")
    } else {
      toast.success("Perfil atualizado!")
    }
    setSaving(false)
  }

  async function saveOrgName() {
    if (!org.id) return
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("organizations")
      .update({ name: org.name })
      .eq("id", org.id)

    if (error) {
      toast.error("Erro ao salvar nome da organização")
    } else {
      toast.success("Nome da organização atualizado!")
    }
    setSaving(false)
  }

  async function changePassword() {
    if (passwords.new_password !== passwords.confirm) {
      toast.error("As senhas não coincidem")
      return
    }
    if (passwords.new_password.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres")
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: passwords.new_password,
    })

    if (error) {
      toast.error("Erro ao alterar senha: " + error.message)
    } else {
      toast.success("Senha alterada com sucesso!")
      setPasswords({ current: "", new_password: "", confirm: "" })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Gerencie suas informações de conta e organização."
      />

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <CardTitle className="text-base">Meu Perfil</CardTitle>
            </div>
            <CardDescription>Suas informações pessoais de acesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Nome completo</Label>
              <Input
                id="full-name"
                value={profile.full_name}
                onChange={(e) => setProfile(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-slate-50 text-slate-500"
              />
              <p className="text-xs text-slate-400">O e-mail não pode ser alterado.</p>
            </div>
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar perfil
            </Button>
          </CardContent>
        </Card>

        {/* Organization */}
        {org.id && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <CardTitle className="text-base">Organização</CardTitle>
              </div>
              <CardDescription>Informações da sua oficina na plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Nome da organização</Label>
                <Input
                  id="org-name"
                  value={org.name}
                  onChange={(e) => setOrg(o => ({ ...o, name: e.target.value }))}
                  placeholder="Nome da sua oficina"
                />
              </div>
              <Button onClick={saveOrgName} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar nome
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-500" />
              <CardTitle className="text-base">Alterar Senha</CardTitle>
            </div>
            <CardDescription>Defina uma nova senha de acesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pw">Nova senha</Label>
              <Input
                id="new-pw"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={passwords.new_password}
                onChange={(e) => setPasswords(p => ({ ...p, new_password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirmar nova senha</Label>
              <Input
                id="confirm-pw"
                type="password"
                placeholder="Repita a nova senha"
                value={passwords.confirm}
                onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
              />
            </div>
            <Button
              onClick={changePassword}
              disabled={saving || !passwords.new_password || !passwords.confirm}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Alterar senha
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
