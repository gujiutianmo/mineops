import { lazy, Suspense, useEffect } from "react"
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/auth-context"
import { FleetOpsLogin } from "./login-screen"
import { FleetShell } from "./fleet-shell"
import { SaveSuccessDialog } from "@/components/save-success-dialog"
import { TooltipProvider } from "@/components/ui/tooltip"
import { applyI18n } from "@/lib/i18n"
import { loadFleetOpsLanguage } from "./i18n"

const FleetDashboardPage = lazy(() => import("./dashboard-page").then((module) => ({ default: module.FleetDashboardPage })))
const FleetPage = lazy(() => import("@/pages/fleet-page").then((module) => ({ default: module.FleetPage })))
const FinancePage = lazy(() => import("@/pages/finance-page").then((module) => ({ default: module.FinancePage })))
const ShippingPage = lazy(() => import("@/pages/shipping-page").then((module) => ({ default: module.ShippingPage })))
const PlateCounterPage = lazy(() => import("@/pages/plate-counter-page").then((module) => ({ default: module.PlateCounterPage })))
const SettingsPage = lazy(() => import("@/pages/settings-page").then((module) => ({ default: module.SettingsPage })))
const BulkImportPage = lazy(() => import("@/pages/bulk-import-page").then((module) => ({ default: module.BulkImportPage })))
const FleetAttendancePage = lazy(() => import("@/pages/fleet-attendance-page").then((module) => ({ default: module.FleetAttendancePage })))

function RouteLoader({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="grid min-h-[320px] place-items-center text-sm text-muted-foreground">正在加载模块…</div>}>{children}</Suspense>
}

function ProtectedFleetOps() {
  const { user, loading } = useAuth()
  const location = useLocation()

  useEffect(() => {
    const id = window.setTimeout(() => applyI18n(loadFleetOpsLanguage()), 0)
    return () => window.clearTimeout(id)
  }, [user, loading, location.pathname])

  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">正在加载 FleetOps…</div>
  if (!user) return <FleetOpsLogin />
  if (user.must_change_password && location.pathname !== "/settings") return <Navigate to="/settings?tab=account" replace />

  return <Routes>
    <Route element={<FleetShell />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<RouteLoader><FleetDashboardPage /></RouteLoader>} />
      <Route path="fleet" element={<RouteLoader><FleetPage /></RouteLoader>} />
      <Route path="shipping" element={<RouteLoader><ShippingPage /></RouteLoader>} />
      <Route path="plate-counter" element={<RouteLoader><PlateCounterPage /></RouteLoader>} />
      <Route path="finance" element={<RouteLoader><FinancePage /></RouteLoader>} />
      <Route path="bulk-import" element={<RouteLoader><BulkImportPage /></RouteLoader>} />
      <Route path="attendance" element={<RouteLoader><FleetAttendancePage /></RouteLoader>} />
      <Route path="settings" element={<RouteLoader><SettingsPage /></RouteLoader>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>
}

export function FleetOpsApp() {
  return <HashRouter><AuthProvider><TooltipProvider><ProtectedFleetOps /><SaveSuccessDialog /></TooltipProvider></AuthProvider></HashRouter>
}
