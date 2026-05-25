"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Zap,
  Send,
  Settings,
  Wrench,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/cadences", label: "Cadências", icon: Zap },
  { href: "/dispatches", label: "Disparos", icon: Send },
  { href: "/services", label: "Serviços", icon: Wrench },
  { href: "/settings", label: "Configurações", icon: Settings },
]

const adminNavItems = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/admin/clients", label: "Clientes", icon: Building2 },
]

interface SidebarProps {
  userRole?: string
  userName?: string
  orgName?: string
}

export function Sidebar({ userRole, userName, orgName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  const initials = userName
    ? userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "U"

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-white border-r border-slate-200 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-slate-200",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">MecânicaFlow</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1 rounded-md hover:bg-slate-100 text-slate-500 transition-colors",
            collapsed && "mt-0"
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          )
        })}

        {userRole === "admin" && (
          <>
            <div className={cn(
              "pt-4 pb-2",
              collapsed ? "px-2" : "px-3"
            )}>
              {!collapsed && (
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Administração
                </p>
              )}
              {collapsed && <div className="h-px bg-slate-200" />}
            </div>
            {adminNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User section */}
      <div className={cn(
        "border-t border-slate-200 p-3",
        collapsed ? "flex flex-col items-center gap-2" : ""
      )}>
        <div className={cn(
          "flex items-center gap-3 mb-2",
          collapsed && "flex-col gap-1"
        )}>
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="text-xs bg-slate-900 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{userName || "Usuário"}</p>
              <p className="text-xs text-slate-500 truncate">{orgName || (userRole === "admin" ? "Administrador" : "")}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-red-600 transition-colors",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && "Sair"}
        </button>
      </div>
    </aside>
  )
}
