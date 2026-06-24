import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useOutletContext } from "react-router-dom"
import { Clock, Download, Fuel, LogIn, LogOut, Pencil, Plus, Trash2, Truck, UserCheck, Wrench } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { date, datetime, money, number } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type Vehicle = {
  id: string
  plate_number: string
  driver_name?: string
  driver_phone?: string
  vehicle_type?: string
  brand_model?: string
  current_mileage_km?: number
  vehicle_status?: string
  remark?: string
}
type Maintenance = {
  id: string
  vehicle_id?: string
  repair_date: string
  plate_number: string
  driver_name?: string
  item_name?: string
  part_spec?: string
  quantity?: number
  unit_price?: number
  amount?: number
  vendor?: string
  status?: string
  remark?: string
}
type FuelTrip = {
  id: string
  vehicle_id?: string
  record_date: string
  plate_number: string
  driver_name?: string
  fuel_liters?: number
  fuel_unit_price?: number
  fuel_amount?: number
  trip_count?: number
  fuel_consumption_l100km?: number
  remark?: string
}
type FleetAttendance = {
  id: string
  staff_name: string
  staff_role: string
  check_in_time: string
  check_out_time?: string | null
  duration_hours: number
  status: string
  remark: string
}
type Mode = "vehicle" | "maintenance" | "fuel"

const today = () => new Date().toISOString().slice(0, 10)
const nowISO = () => new Date().toISOString().slice(0, 16)

export function FleetPage() {
  const { user } = useAuth()
  const { mineId, fleetId } = useOutletContext<{ mineId: string; fleetId?: string }>()
  const effectiveFleetId = user?.role === "fleet" ? user.fleet_id || "" : fleetId || ""
  const mine = effectiveFleetId ? { fleet_id: effectiveFleetId } : mineId ? { mine_id: mineId } : {}
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenance, setMaintenance] = useState<Maintenance[]>([])
  const [fuel, setFuel] = useState<FuelTrip[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [mode, setMode] = useState<Mode | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [message, setMessage] = useState("")

  // Vehicle type filter
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("")

  // Attendance
  const [attendance, setAttendance] = useState<FleetAttendance[]>([])
  const [attendanceToday, setAttendanceToday] = useState<FleetAttendance[]>([])
  const [activeAttendance, setActiveAttendance] = useState<FleetAttendance[]>([])
  const [checkInForm, setCheckInForm] = useState({ staff_name: "", staff_role: "司机", remark: "" })
  const [manualForm, setManualForm] = useState({ staff_name: "", staff_role: "司机", check_in_time: nowISO(), check_out_time: "", remark: "" })
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  const load = () => Promise.all([
    api.get<Vehicle[]>("/fleet/vehicles", { limit: 1000, ...mine }),
    api.get<Maintenance[]>("/fleet/maintenance", { limit: 1000, ...mine }),
    api.get<FuelTrip[]>("/fleet/fuel-trips", { limit: 1000, ...mine }),
    api.get<Record<string, number>>("/fleet/dashboard", mine),
  ]).then(([vehicleRows, maintenanceRows, fuelRows, statRows]) => {
    setVehicles(vehicleRows || [])
    setMaintenance(maintenanceRows || [])
    setFuel(fuelRows || [])
    setStats(statRows || {})
  }).catch((error) => setMessage(error instanceof Error ? error.message : "加载车队数据失败"))

  const loadAttendance = async () => {
    setAttendanceLoading(true)
    try {
      const [recordsRes, todayRes, activeRes] = await Promise.all([
        api.get<{ total: number; items: FleetAttendance[] }>("/fleet-attendance/records", { page_size: 200, ...mine }),
        api.get<FleetAttendance[]>("/fleet-attendance/today", mine),
        api.get<FleetAttendance[]>("/fleet-attendance/active", mine),
      ])
      setAttendance(recordsRes.items || [])
      setAttendanceToday(todayRes || [])
      setActiveAttendance(activeRes || [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载考勤失败")
    } finally {
      setAttendanceLoading(false)
    }
  }

  useEffect(() => { void load() }, [mineId, effectiveFleetId])

  // Vehicle types for filter
  const vehicleTypes = useMemo(() => {
    const types = new Set<string>()
    vehicles.forEach((v) => { if (v.vehicle_type) types.add(v.vehicle_type) })
    return Array.from(types).sort()
  }, [vehicles])

  // Filter vehicles by type
  const filteredVehicles = useMemo(() =>
    vehicleTypeFilter ? vehicles.filter((v) => v.vehicle_type === vehicleTypeFilter) : vehicles,
    [vehicles, vehicleTypeFilter])

  // Filter maintenance by vehicle type
  const filteredMaintenance = useMemo(() => {
    if (!vehicleTypeFilter) return maintenance
    const filteredPlateSet = new Set(filteredVehicles.map((v) => v.plate_number))
    return maintenance.filter((m) => filteredPlateSet.has(m.plate_number))
  }, [maintenance, vehicleTypeFilter, filteredVehicles])

  // Filter fuel by vehicle type
  const filteredFuel = useMemo(() => {
    if (!vehicleTypeFilter) return fuel
    const filteredPlateSet = new Set(filteredVehicles.map((v) => v.plate_number))
    return fuel.filter((f) => filteredPlateSet.has(f.plate_number))
  }, [fuel, vehicleTypeFilter, filteredVehicles])

  const openCreate = (next: Mode) => {
    setMode(next)
    setEditingId(null)
    setForm(next === "vehicle"
      ? { plate_number: "", driver_name: "", driver_phone: "", vehicle_type: "", brand_model: "", vehicle_status: "在用", current_mileage_km: 0, remark: "" }
      : next === "maintenance"
        ? { repair_date: today(), vehicle_id: "", plate_number: "", driver_name: "", item_name: "", part_spec: "", quantity: 1, unit_price: 0, amount: 0, vendor: "", status: "待处理", remark: "" }
        : { record_date: today(), vehicle_id: "", plate_number: "", driver_name: "", fuel_liters: 0, fuel_unit_price: 0, fuel_amount: 0, trip_count: 0, fuel_consumption_l100km: 0, remark: "" })
  }

  const openEditVehicle = (vehicle: Vehicle) => {
    setMode("vehicle")
    setEditingId(vehicle.id)
    setForm({
      plate_number: vehicle.plate_number || "",
      driver_name: vehicle.driver_name || "",
      driver_phone: vehicle.driver_phone || "",
      vehicle_type: vehicle.vehicle_type || "",
      brand_model: vehicle.brand_model || "",
      vehicle_status: vehicle.vehicle_status || "在用",
      current_mileage_km: vehicle.current_mileage_km || 0,
      remark: vehicle.remark || "",
    })
  }

  const openEditMaintenance = (record: Maintenance) => {
    const vehicle = findVehicle(record.vehicle_id, record.plate_number)
    setMode("maintenance")
    setEditingId(record.id)
    setForm({
      vehicle_id: vehicle?.id || record.vehicle_id || "",
      repair_date: String(record.repair_date || "").slice(0, 10),
      plate_number: record.plate_number || vehicle?.plate_number || "",
      driver_name: record.driver_name || vehicle?.driver_name || "",
      item_name: record.item_name || "",
      part_spec: record.part_spec || "",
      quantity: record.quantity || 0,
      unit_price: record.unit_price || 0,
      amount: record.amount || 0,
      vendor: record.vendor || "",
      status: record.status || "待处理",
      remark: record.remark || "",
    })
  }

  const openEditFuel = (record: FuelTrip) => {
    const vehicle = findVehicle(record.vehicle_id, record.plate_number)
    setMode("fuel")
    setEditingId(record.id)
    setForm({
      vehicle_id: vehicle?.id || record.vehicle_id || "",
      record_date: String(record.record_date || "").slice(0, 10),
      plate_number: record.plate_number || vehicle?.plate_number || "",
      driver_name: record.driver_name || vehicle?.driver_name || "",
      fuel_liters: record.fuel_liters || 0,
      fuel_unit_price: record.fuel_unit_price || 0,
      fuel_amount: record.fuel_amount || 0,
      trip_count: record.trip_count || 0,
      fuel_consumption_l100km: record.fuel_consumption_l100km || 0,
      remark: record.remark || "",
    })
  }

  const findVehicle = (id?: string, plate?: string) => vehicles.find((item) => item.id === id) || vehicles.find((item) => item.plate_number === plate)

  const chooseVehicle = (id: string) => {
    const vehicle = vehicles.find((item) => item.id === id)
    setForm({ ...form, vehicle_id: id, plate_number: vehicle?.plate_number || "", driver_name: vehicle?.driver_name || "" })
  }

  const save = async () => {
    if (!mode) return
    try {
      const payload = { ...form, ...mine }
      if (editingId) {
        const path = mode === "vehicle" ? `/fleet/vehicles/${editingId}` : mode === "maintenance" ? `/fleet/maintenance/${editingId}` : `/fleet/fuel-trips/${editingId}`
        await api.put(path, payload)
      } else {
        const path = mode === "vehicle" ? "/fleet/vehicles" : mode === "maintenance" ? "/fleet/maintenance" : "/fleet/fuel-trips"
        await api.post(path, payload)
      }
      setMode(null)
      setEditingId(null)
      setMessage(editingId ? "记录已修改" : "数据已保存")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败")
    }
  }

  const removeVehicle = async (vehicle: Vehicle) => {
    if (!confirm(`删除车队档案 ${vehicle.plate_number}？维修和加油记录会保留，但会解除车辆档案关联。`)) return
    try { await api.delete(`/fleet/vehicles/${vehicle.id}`); setMessage("车队档案已删除"); await load() }
    catch (error) { setMessage(error instanceof Error ? error.message : "删除失败") }
  }

  const removeMaintenance = async (record: Maintenance) => {
    if (!confirm(`删除 ${record.plate_number} 的维修/配件记录？`)) return
    try { await api.delete(`/fleet/maintenance/${record.id}`); setMessage("维修与配件记录已删除"); await load() }
    catch (error) { setMessage(error instanceof Error ? error.message : "删除失败") }
  }

  const removeFuel = async (record: FuelTrip) => {
    if (!confirm(`删除 ${record.plate_number} 的加油/趟数记录？`)) return
    try { await api.delete(`/fleet/fuel-trips/${record.id}`); setMessage("加油/趟数记录已删除"); await load() }
    catch (error) { setMessage(error instanceof Error ? error.message : "删除失败") }
  }

  const closeSheet = () => { setMode(null); setEditingId(null) }

  // Attendance actions
  const doCheckIn = async () => {
    if (!checkInForm.staff_name.trim()) { setMessage("请输入人员姓名"); return }
    try {
      await api.post("/fleet-attendance/check-in", { ...checkInForm, ...mine })
      setCheckInForm({ staff_name: "", staff_role: "司机", remark: "" })
      setMessage("签到成功")
      await loadAttendance()
    } catch (error) { setMessage(error instanceof Error ? error.message : "签到失败") }
  }

  const doCheckOut = async (id: string) => {
    try {
      await api.post(`/fleet-attendance/${id}/check-out`, {})
      setMessage("签退成功")
      await loadAttendance()
    } catch (error) { setMessage(error instanceof Error ? error.message : "签退失败") }
  }

  const doManualRecord = async () => {
    if (!manualForm.staff_name.trim() || !manualForm.check_in_time) { setMessage("请填写姓名和签到时间"); return }
    try {
      await api.post("/fleet-attendance/manual", { ...manualForm, ...mine })
      setManualForm({ staff_name: "", staff_role: "司机", check_in_time: nowISO(), check_out_time: "", remark: "" })
      setMessage("补录成功")
      await loadAttendance()
    } catch (error) { setMessage(error instanceof Error ? error.message : "补录失败") }
  }

  const removeAttendance = async (id: string) => {
    if (!confirm("删除此考勤记录？")) return
    try { await api.delete(`/fleet-attendance/records/${id}`); setMessage("考勤记录已删除"); await loadAttendance() }
    catch (error) { setMessage(error instanceof Error ? error.message : "删除失败") }
  }

  const activeVehicles = vehicles.filter((vehicle) => ["在用", "运行中", "active"].includes(vehicle.vehicle_status || "")).length
  const sheetTitle = mode === "vehicle"
    ? editingId ? "修改车队档案" : "新增车辆"
    : mode === "maintenance"
      ? editingId ? "修改维修与配件记录" : "新增维修记录"
      : editingId ? "修改加油/趟数记录" : "新增加油记录"

  // Filter dropdown component
  const TypeFilter = () => vehicleTypes.length > 0 ? (
    <div className="flex items-center gap-2">
      <Label className="text-xs whitespace-nowrap">车辆类型:</Label>
      <Select value={vehicleTypeFilter || "all"} onValueChange={(v) => setVehicleTypeFilter(v === "all" ? "" : v)}>
        <SelectTrigger className="h-8 w-40"><SelectValue placeholder="全部类型" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部类型</SelectItem>
          {vehicleTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  ) : null

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold">车队管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">车辆档案、维修配件、加油和车牌比对趟数统一管理。</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => api.download("/fleet/export/workbook", mine)}><Download />导出台账</Button>
        <Button onClick={() => openCreate("vehicle")}><Plus />新增车辆</Button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([
      ["车辆总数", stats.vehicle_count ?? vehicles.length, Truck],
      ["运行车辆", stats.active_vehicle_count ?? activeVehicles, Truck],
      ["维修支出", stats.maintenance_total ?? maintenance.reduce((sum, row) => sum + Number(row.amount || 0), 0), Wrench],
      ["本期油耗", stats.fuel_liters ?? fuel.reduce((sum, row) => sum + Number(row.fuel_liters || 0), 0), Fuel],
    ] as [string, number, LucideIcon][]).map(([label, value, Icon]) => <Card key={label}><CardContent className="flex items-center gap-4 p-5"><div className="grid size-10 place-items-center rounded-lg bg-primary/12 text-primary"><Icon className="size-5" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="metric-number mt-1 text-xl font-semibold">{number(value, 1)}</p></div></CardContent></Card>)}</div>

    <Tabs defaultValue="vehicles" className="space-y-3">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="vehicles">车辆档案</TabsTrigger>
        <TabsTrigger value="maintenance">维修与配件</TabsTrigger>
        <TabsTrigger value="fuel">加油 / 趟数</TabsTrigger>
        <TabsTrigger value="attendance" onClick={() => { void loadAttendance() }}>签到打卡</TabsTrigger>
      </TabsList>

      <TabsContent value="vehicles" className="space-y-3">
        <div className="flex items-center justify-between"><TypeFilter /><Button onClick={() => openCreate("vehicle")}><Plus />新增车辆</Button></div>
        <FleetTable headers={["车牌号", "司机", "车辆类型", "品牌型号", "里程", "状态", "备注", "操作"]} rows={filteredVehicles.map((vehicle) => [
          <span className="font-mono text-primary">{vehicle.plate_number}</span>,
          vehicle.driver_name || "—",
          vehicle.vehicle_type || "—",
          vehicle.brand_model || "—",
          `${number(vehicle.current_mileage_km, 0)} km`,
          <Badge>{vehicle.vehicle_status || "—"}</Badge>,
          <span className="inline-block max-w-56 truncate">{vehicle.remark || "—"}</span>,
          <RowActions onEdit={() => openEditVehicle(vehicle)} onDelete={() => void removeVehicle(vehicle)} />,
        ])} />
      </TabsContent>

      <TabsContent value="maintenance" className="space-y-3">
        <div className="flex items-center justify-between"><TypeFilter /><Button onClick={() => openCreate("maintenance")}><Plus />新增维修</Button></div>
        <FleetTable headers={["日期", "车牌号", "维修项目", "配件规格", "数量", "金额", "供应商", "状态", "操作"]} rows={filteredMaintenance.map((row) => [
          date(row.repair_date),
          row.plate_number,
          row.item_name || "—",
          row.part_spec || "—",
          number(row.quantity, 1),
          money(row.amount),
          row.vendor || "—",
          <Badge variant="secondary">{row.status || "—"}</Badge>,
          <RowActions onEdit={() => openEditMaintenance(row)} onDelete={() => void removeMaintenance(row)} />,
        ])} />
      </TabsContent>

      <TabsContent value="fuel" className="space-y-3">
        <div className="flex items-center justify-between"><TypeFilter /><Button onClick={() => openCreate("fuel")}><Plus />新增加油</Button></div>
        <FleetTable headers={["日期", "车牌号", "司机", "油量", "金额", "趟数", "每趟油耗", "操作"]} rows={filteredFuel.map((row) => [
          date(row.record_date),
          row.plate_number,
          row.driver_name || "—",
          `${number(row.fuel_liters, 1)} L`,
          money(row.fuel_amount),
          number(row.trip_count),
          number(row.fuel_consumption_l100km, 2),
          <RowActions onEdit={() => openEditFuel(row)} onDelete={() => void removeFuel(row)} />,
        ])} />
      </TabsContent>

      {/* Attendance Tab */}
      <TabsContent value="attendance" className="grid gap-4 xl:grid-cols-2">
        {/* Check-in Card */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2"><LogIn className="size-4 text-primary" /><span className="font-medium">签到打卡</span></div>
            <div className="space-y-2"><Label>人员姓名</Label><Input value={checkInForm.staff_name} onChange={(e) => setCheckInForm({ ...checkInForm, staff_name: e.target.value })} placeholder="输入司机或修理工姓名" /></div>
            <div className="space-y-2"><Label>角色</Label><Select value={checkInForm.staff_role} onValueChange={(v) => setCheckInForm({ ...checkInForm, staff_role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="司机">司机</SelectItem><SelectItem value="修理工">修理工</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>备注</Label><Input value={checkInForm.remark} onChange={(e) => setCheckInForm({ ...checkInForm, remark: e.target.value })} placeholder="班次、地点等" /></div>
            <Button onClick={() => void doCheckIn()} className="w-full"><LogIn className="mr-2 size-4" />签到</Button>
          </CardContent>
        </Card>

        {/* Manual Record Card */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2"><Clock className="size-4 text-primary" /><span className="font-medium">考勤补录</span></div>
            <div className="space-y-2"><Label>人员姓名</Label><Input value={manualForm.staff_name} onChange={(e) => setManualForm({ ...manualForm, staff_name: e.target.value })} placeholder="输入司机或修理工姓名" /></div>
            <div className="space-y-2"><Label>角色</Label><Select value={manualForm.staff_role} onValueChange={(v) => setManualForm({ ...manualForm, staff_role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="司机">司机</SelectItem><SelectItem value="修理工">修理工</SelectItem></SelectContent></Select></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>签到时间</Label><Input type="datetime-local" value={manualForm.check_in_time} onChange={(e) => setManualForm({ ...manualForm, check_in_time: e.target.value })} /></div><div className="space-y-2"><Label>签退时间</Label><Input type="datetime-local" value={manualForm.check_out_time} onChange={(e) => setManualForm({ ...manualForm, check_out_time: e.target.value })} /></div></div>
            <div className="space-y-2"><Label>备注</Label><Input value={manualForm.remark} onChange={(e) => setManualForm({ ...manualForm, remark: e.target.value })} /></div>
            <Button onClick={() => void doManualRecord()} variant="outline" className="w-full"><Clock className="mr-2 size-4" />保存补录</Button>
          </CardContent>
        </Card>

        {/* Active (in-progress) */}
        <Card className="xl:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3"><UserCheck className="size-4 text-emerald-500" /><span className="font-medium">当前在岗人员</span><Badge variant="secondary" className="ml-2">{activeAttendance.length}</Badge></div>
            {activeAttendance.length ? (
              <div className="space-y-2">
                {activeAttendance.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div><p className="font-medium">{r.staff_name} <Badge variant="outline" className="ml-2 text-xs">{r.staff_role}</Badge></p><p className="text-xs text-muted-foreground">签到: {datetime(r.check_in_time)} · {r.remark || "—"}</p></div>
                    <Button size="sm" variant="destructive" onClick={() => void doCheckOut(r.id)}><LogOut className="mr-1 size-3" />签退</Button>
                  </div>
                ))}
              </div>
            ) : <p className="py-8 text-center text-sm text-muted-foreground">当前没有在岗人员</p>}
          </CardContent>
        </Card>

        {/* History Table */}
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>姓名</TableHead><TableHead>角色</TableHead><TableHead>签到时间</TableHead><TableHead>签退时间</TableHead><TableHead>工时</TableHead><TableHead>状态</TableHead><TableHead>备注</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody>
                {attendanceLoading ? <TableRow><TableCell colSpan={8} className="h-20 text-center text-muted-foreground">加载中...</TableCell></TableRow>
                : attendance.length ? attendance.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.staff_name}</TableCell>
                    <TableCell><Badge variant="outline">{r.staff_role}</Badge></TableCell>
                    <TableCell>{datetime(r.check_in_time)}</TableCell>
                    <TableCell>{r.check_out_time ? datetime(r.check_out_time) : "—"}</TableCell>
                    <TableCell>{number(r.duration_hours, 2)} h</TableCell>
                    <TableCell><Badge variant={r.status === "checked_in" ? "default" : "secondary"}>{r.status === "checked_in" ? "在岗" : "已签退"}</Badge></TableCell>
                    <TableCell className="max-w-48 truncate">{r.remark || "—"}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "checked_in" && <Button variant="ghost" size="sm" onClick={() => void doCheckOut(r.id)}><LogOut className="mr-1 size-3" />签退</Button>}
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => void removeAttendance(r.id)}><Trash2 /></Button>
                    </TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={8} className="h-52 text-center text-muted-foreground">暂无考勤记录</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </Card>
      </TabsContent>
    </Tabs>

    {message && <p className="text-sm text-muted-foreground">{message}</p>}

    <Sheet open={Boolean(mode)} onOpenChange={(open) => { if (!open) closeSheet() }}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>{sheetTitle}</SheetTitle></SheetHeader>
        <div className="space-y-4 px-4 py-5">
          {mode !== "vehicle" && <Field label="选择车辆"><Select value={String(form.vehicle_id || "")} onValueChange={chooseVehicle}><SelectTrigger><SelectValue placeholder="选择车辆" /></SelectTrigger><SelectContent>{vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.plate_number} · {vehicle.driver_name || "未填司机"}</SelectItem>)}</SelectContent></Select></Field>}
          {mode === "vehicle" && <>
            <TextField label="车牌号" field="plate_number" form={form} setForm={setForm} />
            <TextField label="司机姓名" field="driver_name" form={form} setForm={setForm} />
            <TextField label="司机电话" field="driver_phone" form={form} setForm={setForm} />
            <TextField label="车辆类型" field="vehicle_type" form={form} setForm={setForm} />
            <TextField label="品牌型号" field="brand_model" form={form} setForm={setForm} />
            <TextField label="当前里程" field="current_mileage_km" type="number" form={form} setForm={setForm} />
            <Field label="车队状态"><Select value={String(form.vehicle_status || "")} onValueChange={(value) => setForm({ ...form, vehicle_status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["在用", "维修", "配件等待", "停用"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
          </>}
          {mode === "maintenance" && <>
            <TextField label="维修日期" field="repair_date" type="date" form={form} setForm={setForm} />
            <TextField label="维修项目" field="item_name" form={form} setForm={setForm} />
            <TextField label="配件规格" field="part_spec" form={form} setForm={setForm} />
            <TextField label="数量" field="quantity" type="number" form={form} setForm={setForm} />
            <TextField label="单价" field="unit_price" type="number" form={form} setForm={setForm} />
            <TextField label="金额" field="amount" type="number" form={form} setForm={setForm} />
            <TextField label="供应商" field="vendor" form={form} setForm={setForm} />
            <Field label="状态"><Select value={String(form.status || "")} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["待处理", "维修中", "已完成", "配件等待"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
          </>}
          {mode === "fuel" && <>
            <TextField label="日期" field="record_date" type="date" form={form} setForm={setForm} />
            <TextField label="加油量 (L)" field="fuel_liters" type="number" form={form} setForm={setForm} />
            <TextField label="油价" field="fuel_unit_price" type="number" form={form} setForm={setForm} />
            <TextField label="金额" field="fuel_amount" type="number" form={form} setForm={setForm} />
            <TextField label="车牌比对趟数" field="trip_count" type="number" form={form} setForm={setForm} />
          </>}
          <Field label="备注"><Textarea value={String(form.remark || "")} onChange={(event) => setForm({ ...form, remark: event.target.value })} /></Field>
        </div>
        <SheetFooter><Button variant="outline" onClick={closeSheet}>取消</Button><Button onClick={() => void save()} disabled={mode === "vehicle" && !form.plate_number}>保存</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={onEdit}><Pencil /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}><Trash2 /></Button></div>
}

function FleetTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <Card className="overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header} className="whitespace-nowrap last:text-right">{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length ? rows.map((row, index) => <TableRow key={index}>{row.map((cell, cellIndex) => <TableCell key={cellIndex} className="whitespace-nowrap last:text-right">{cell}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={headers.length} className="h-52 text-center text-muted-foreground">暂无数据</TableCell></TableRow>}</TableBody></Table></div></Card>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function TextField({ label, field, type = "text", form, setForm }: { label: string; field: string; type?: string; form: Record<string, unknown>; setForm: (value: Record<string, unknown>) => void }) {
  return <Field label={label}><Input type={type} value={String(form[field] ?? "")} onChange={(event) => setForm({ ...form, [field]: type === "number" ? Number(event.target.value) : event.target.value })} /></Field>
}
