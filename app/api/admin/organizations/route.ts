import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const admin = createAdminClient()

  // Get all organizations with stats
  const { data: orgs } = await admin.from("organizations").select("*").order("created_at", { ascending: false })

  if (!orgs) return NextResponse.json([])

  // Get stats for each org
  const orgsWithStats = await Promise.all(
    orgs.map(async (org) => {
      const [{ count: lead_count }, { count: dispatch_count }, { data: ownerProfile }] =
        await Promise.all([
          admin.from("leads").select("*", { count: "exact", head: true }).eq("org_id", org.id),
          admin.from("dispatches").select("*", { count: "exact", head: true }).eq("org_id", org.id),
          admin.from("profiles").select("id").eq("org_id", org.id).limit(1),
        ])

      let owner_email: string | undefined
      if (ownerProfile?.[0]) {
        const { data: authUser } = await admin.auth.admin.getUserById(ownerProfile[0].id)
        owner_email = authUser?.user?.email
      }

      return {
        ...org,
        lead_count: lead_count ?? 0,
        dispatch_count: dispatch_count ?? 0,
        owner_email,
      }
    })
  )

  return NextResponse.json(orgsWithStats)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const body = await req.json()
  const { org_name, user_name, user_email, user_password } = body

  if (!org_name || !user_email || !user_password) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 })
  }

  if (user_password.length < 6) {
    return NextResponse.json({ error: "Senha deve ter pelo menos 6 caracteres" }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create organization first
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: org_name, owner_id: user.id })
    .select()
    .single()

  if (orgError || !org) {
    return NextResponse.json(
      { error: "Erro ao criar organização: " + orgError?.message },
      { status: 500 }
    )
  }

  // Create user account
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: user_email,
    password: user_password,
    email_confirm: true,
    user_metadata: {
      full_name: user_name || null,
      role: "client",
    },
  })

  if (authError || !authData.user) {
    // Rollback org creation
    await admin.from("organizations").delete().eq("id", org.id)
    return NextResponse.json(
      { error: "Erro ao criar usuário: " + authError?.message },
      { status: 500 }
    )
  }

  // Update org owner and profile
  await Promise.all([
    admin.from("organizations").update({ owner_id: authData.user.id }).eq("id", org.id),
    admin.from("profiles")
      .upsert({
        id: authData.user.id,
        full_name: user_name || null,
        role: "client",
        org_id: org.id,
      })
      .eq("id", authData.user.id),
  ])

  // Add default services
  const defaultServices = [
    "Troca de Óleo",
    "Revisão Geral",
    "Alinhamento e Balanceamento",
    "Troca de Pastilhas de Freio",
  ]

  await admin.from("services").insert(
    defaultServices.map(name => ({ org_id: org.id, name }))
  )

  return NextResponse.json({ org, user: { id: authData.user.id, email: user_email } })
}
