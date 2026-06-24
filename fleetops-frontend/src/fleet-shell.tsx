import { useEffect, useMemo, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { ChevronDown, CircleDollarSign, ClipboardCheck, Database, Gauge, Languages, ListChecks, LogOut, Menu, Moon, Network, Settings, Sun, Truck, Wrench } from "lucide-react"
import { useAuth } from "./contexts/auth-context"
import { loadFleetOpsLanguage } from "./i18n"
import { applyI18n, languages, type Language } from "@/lib/i18n"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const navigation = [
  { to: "/dashboard", label: "车队概览", description: "核心运营数据", icon: Gauge },
  { to: "/fleet", label: "车辆与养护", description: "档案、维修、加油趟数", icon: Wrench },
  { to: "/shipping", label: "运输管理", description: "装车、车牌与报表", icon: Truck },
  { to: "/plate-counter", label: "车牌比对", description: "识别、保存与月度趟数", icon: ListChecks },
  { to: "/finance", label: "车队财务", description: "收支、汇率与分析", icon: CircleDollarSign },
  { to: "/attendance", label: "签到打卡", description: "司机与修理工出勤记录", icon: ClipboardCheck },
  { to: "/bulk-import", label: "Excel 批量导入", description: "模板下载与整批导入", icon: Database },
]

function Sidebar({ close }: { close?: () => void }) {
  return <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
    <div className="flex h-[72px] items-center gap-3 border-b border-sidebar-border px-5"><div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Truck className="size-5" /></div><div><div className="text-lg font-semibold tracking-tight">FleetOps</div><div className="text-[11px] text-muted-foreground">车队运营管理系统</div></div></div>
    <div className="mx-3 mt-4 rounded-2xl border border-primary/20 bg-primary/8 p-3"><div className="flex items-center gap-2 text-xs text-primary"><Network className="size-4" />独立数据库运行中</div><p className="mt-2 truncate text-sm font-medium">当前车队</p></div>
    <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4"><div className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">车队运营</div><div className="space-y-1">{navigation.map((item) => <NavLink key={item.to} to={item.to} onClick={close} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/55 hover:text-foreground"}`}><item.icon className="size-[18px] shrink-0" /><span className="min-w-0"><span className="block text-sm font-medium">{item.label}</span><span className="block truncate text-[10px] opacity-65">{item.description}</span></span></NavLink>)}</div></nav>
    <div className="border-t border-sidebar-border p-3"><NavLink to="/settings" onClick={close} className={({ isActive }) => `flex h-11 items-center gap-3 rounded-xl px-3 text-sm ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/55 hover:text-foreground"}`}><Settings className="size-[18px]" />账户与系统设置</NavLink></div>
  </div>
}

export function FleetShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem("fleetops_theme") || "dark")
  const [language] = useState<Language>(loadFleetOpsLanguage)
  const current = useMemo(() => navigation.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))?.label || (location.pathname.startsWith("/settings") ? "账户与系统设置" : "FleetOps"), [location.pathname])

  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); localStorage.setItem("fleetops_theme", theme) }, [theme])
  useEffect(() => { const id = window.setTimeout(() => applyI18n(language), 0); return () => window.clearTimeout(id) }, [language, location.pathname])

  const changeLanguage = (next: Language) => {
    if (next === language) return
    localStorage.setItem("fleetops_lang", next)
    window.location.reload()
  }

  return <div className="min-h-screen bg-background">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[244px] border-r border-border lg:block"><Sidebar /></aside>
    <div className="lg:pl-[244px]">
      <header className="sticky top-0 z-30 flex h-[72px] items-center border-b border-border bg-background/92 px-4 backdrop-blur-xl md:px-6">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="mr-2 lg:hidden"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-[280px] border-r-0 p-0"><SheetTitle className="sr-only">FleetOps 导航</SheetTitle><Sidebar close={() => setMobileOpen(false)} /></SheetContent></Sheet>
        <div className="min-w-0"><div className="text-xs text-muted-foreground">FleetOps / 车队运营</div><h1 className="truncate text-lg font-semibold">{current}</h1></div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <Badge variant="outline" className="hidden gap-1.5 border-primary/25 text-primary md:flex"><span className="size-1.5 rounded-full bg-primary" />API 正常</Badge>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon /> : <Sun />}</Button></TooltipTrigger><TooltipContent>{theme === "dark" ? "切换浅色模式" : "切换深色模式"}</TooltipContent></Tooltip>
          <div className="hidden items-center rounded-xl border border-border bg-card/70 p-1 xl:flex">{languages.map((item) => <Button key={item.value} type="button" variant={language === item.value ? "secondary" : "ghost"} size="sm" className="h-7 px-3" onClick={() => changeLanguage(item.value)}>{item.short}</Button>)}</div>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="xl:hidden"><Languages /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Language</DropdownMenuLabel><DropdownMenuSeparator />{languages.map((item) => <DropdownMenuItem key={item.value} onClick={() => changeLanguage(item.value)}>{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="gap-2 px-2"><Avatar className="size-8"><AvatarFallback className="bg-primary/15 text-primary">{(user?.display_name || user?.username || "F").slice(0, 1)}</AvatarFallback></Avatar><div className="hidden max-w-32 text-left md:block"><div className="truncate text-sm font-medium">{user?.display_name || user?.username}</div><div className="truncate text-[10px] text-muted-foreground">{user?.role === "super" ? "系统管理员" : "车队账户"}</div></div><ChevronDown className="hidden size-4 text-muted-foreground md:block" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel>{user?.email || "未绑定邮箱"}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onClick={() => navigate("/settings?tab=account")}><Settings />账户设置</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={logout} className="text-destructive"><LogOut />退出登录</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </header>
      <main className="min-h-[calc(100vh-72px)] p-4 md:p-6"><Outlet context={{ mineId: "", fleetId: user?.fleet_id || "", mines: [], fleets: [] }} /></main>
    </div>
  </div>
}
