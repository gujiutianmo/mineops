import { useEffect, useRef, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Clock, Download, LogIn, LogOut, Trash2, Upload, UserCheck, Users } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { datetime, number } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type FleetAttendance = {
  id: string; staff_name: string; staff_role: string
  check_in_time: string; check_out_time?: string | null
  duration_hours: number; status: string; remark: string
}
type Staff = { id: string; staff_name: string; staff_role: string; remark: string }

const nowISO = () => new Date().toISOString().slice(0, 16)

export function FleetAttendancePage() {
  const { user } = useAuth()
  const { fleetId } = useOutletContext<{ mineId: string; fleetId?: string }>()
  const effectiveFleetId = user?.role === "fleet" ? user.fleet_id || "" : fleetId || ""
  const mine = effectiveFleetId ? { fleet_id: effectiveFleetId } : {}

  const [records, setRecords] = useState<FleetAttendance[]>([])
  const [active, setActive] = useState<FleetAttendance[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const [checkInForm, setCheckInForm] = useState({ staff_name: "", staff_role: "司机", remark: "" })
  const [manualForm, setManualForm] = useState({ staff_name: "", staff_role: "司机", check_in_time: nowISO(), check_out_time: "", remark: "" })

  const load = async () => {
    setLoading(true)
    try {
      const [r, a, s] = await Promise.all([
        api.get<{ total: number; items: FleetAttendance[] }>("/fleet-attendance/records", { page_size: 200, ...mine }),
        api.get<FleetAttendance[]>("/fleet-attendance/active", mine),
        api.get<Staff[]>("/fleet-attendance/staff", mine),
      ])
      setRecords(r.items || [])
      setActive(a || [])
      setStaffList(s || [])
    } catch (e) { setMessage(e instanceof Error ? e.message : "加载失败") }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [effectiveFleetId])

  const selectStaff = (name: string) => {
    const s = staffList.find((x) => x.staff_name === name)
    setCheckInForm({ ...checkInForm, staff_name: name, staff_role: s?.staff_role || "司机" })
  }

  const doCheckIn = async () => {
    if (!checkInForm.staff_name.trim()) { setMessage("请输入人员姓名"); return }
    try {
      await api.post("/fleet-attendance/check-in", { ...checkInForm, ...mine })
      setCheckInForm({ staff_name: "", staff_role: "司机", remark: "" })
      setMessage("签到成功")
      await load()
    } catch (e) { setMessage(e instanceof Error ? e.message : "签到失败") }
  }

  const doCheckOut = async (id: string) => {
    try { await api.post(`/fleet-attendance/${id}/check-out`, {}); setMessage("签退成功"); await load() }
    catch (e) { setMessage(e instanceof Error ? e.message : "签退失败") }
  }

  const doManual = async () => {
    if (!manualForm.staff_name.trim() || !manualForm.check_in_time) { setMessage("请填写姓名和签到时间"); return }
    try {
      await api.post("/fleet-attendance/manual", { ...manualForm, ...mine })
      setManualForm({ staff_name: "", staff_role: "司机", check_in_time: nowISO(), check_out_time: "", remark: "" })
      setMessage("补录成功"); await load()
    } catch (e) { setMessage(e instanceof Error ? e.message : "补录失败") }
  }

  const doDelete = async (id: string) => {
    if (!confirm("删除此考勤记录？")) return
    try { await api.delete(`/fleet-attendance/records/${id}`); setMessage("已删除"); await load() }
    catch (e) { setMessage(e instanceof Error ? e.message : "删除失败") }
  }

  const importExcel = async (file?: File) => {
    if (!file) return
    setImporting(true); setMessage("")
    try {
      const fd = new FormData(); fd.append("file", file)
      const result = await api.post<{ message: string; imported: number; errors: string[] }>("/fleet-attendance/staff/import", fd)
      setMessage(`${result.message}${result.errors.length ? `，错误: ${result.errors.slice(0, 3).join("; ")}` : ""}`)
      await load()
    } catch (e) { setMessage(e instanceof Error ? e.message : "导入失败") }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = "" }
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">签到打卡</h2>
        <p className="mt-1 text-sm text-muted-foreground">修理工与司机每日签到、签退及考勤记录管理。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => api.download("/fleet-attendance/staff/template")}><Download className="mr-1 size-4" />人员模板</Button>
        <Button variant="outline" asChild disabled={importing}>
          <label className="cursor-pointer"><Upload className="mr-1 size-4" />{importing ? "导入中..." : "批量导入人员"}<input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { void importExcel(e.target.files?.[0]) }} /></label>
        </Button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="flex items-center gap-3 p-4"><Users className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">在册人员</p><p className="text-xl font-semibold">{staffList.length}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><UserCheck className="size-5 text-emerald-500" /><div><p className="text-xs text-muted-foreground">当前在岗</p><p className="text-xl font-semibold">{active.length}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><Clock className="size-5 text-amber-500" /><div><p className="text-xs text-muted-foreground">考勤记录</p><p className="text-xl font-semibold">{records.length}</p></div></CardContent></Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><LogIn className="size-4 text-primary" />签到打卡</CardTitle><CardDescription>从花名册选择或手动输入姓名签到。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>人员姓名</Label>
            {staffList.length > 0 ? (
              <Select value={checkInForm.staff_name || "__manual"} onValueChange={(v) => v === "__manual" ? setCheckInForm({ ...checkInForm, staff_name: "" }) : selectStaff(v)}>
                <SelectTrigger><SelectValue placeholder="选择人员或手动输入" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual">✏️ 手动输入姓名...</SelectItem>
                  {staffList.map((s) => <SelectItem key={s.id} value={s.staff_name}>{s.staff_name} · {s.staff_role}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null}
            <Input value={checkInForm.staff_name} onChange={(e) => setCheckInForm({ ...checkInForm, staff_name: e.target.value })} placeholder={staffList.length > 0 ? "或直接输入姓名" : "输入司机或修理工姓名"} />
          </div>
          <div className="space-y-2"><Label>角色</Label><Select value={checkInForm.staff_role} onValueChange={(v) => setCheckInForm({ ...checkInForm, staff_role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="司机">司机</SelectItem><SelectItem value="修理工">修理工</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>备注</Label><Input value={checkInForm.remark} onChange={(e) => setCheckInForm({ ...checkInForm, remark: e.target.value })} placeholder="班次、地点等" /></div>
          <Button onClick={() => void doCheckIn()} className="w-full"><LogIn className="mr-2 size-4" />签到</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="size-4 text-primary" />考勤补录</CardTitle><CardDescription>手动补充历史签到/签退记录。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>人员姓名</Label><Input value={manualForm.staff_name} onChange={(e) => setManualForm({ ...manualForm, staff_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>角色</Label><Select value={manualForm.staff_role} onValueChange={(v) => setManualForm({ ...manualForm, staff_role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="司机">司机</SelectItem><SelectItem value="修理工">修理工</SelectItem></SelectContent></Select></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>签到时间</Label><Input type="datetime-local" value={manualForm.check_in_time} onChange={(e) => setManualForm({ ...manualForm, check_in_time: e.target.value })} /></div><div className="space-y-2"><Label>签退时间</Label><Input type="datetime-local" value={manualForm.check_out_time} onChange={(e) => setManualForm({ ...manualForm, check_out_time: e.target.value })} /></div></div>
          <div className="space-y-2"><Label>备注</Label><Input value={manualForm.remark} onChange={(e) => setManualForm({ ...manualForm, remark: e.target.value })} /></div>
          <Button onClick={() => void doManual()} variant="outline" className="w-full"><Clock className="mr-2 size-4" />保存补录</Button>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserCheck className="size-4 text-emerald-500" />当前在岗人员 <Badge variant="secondary" className="ml-2">{active.length}</Badge></CardTitle></CardHeader>
      <CardContent>
        {active.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{active.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{r.staff_name} <Badge variant="outline" className="ml-1 text-xs">{r.staff_role}</Badge></p><p className="text-xs text-muted-foreground">签到: {datetime(r.check_in_time)}</p></div><Button size="sm" variant="destructive" onClick={() => void doCheckOut(r.id)}><LogOut className="mr-1 size-3" />签退</Button></div>
        ))}</div> : <p className="py-8 text-center text-sm text-muted-foreground">当前没有在岗人员</p>}
      </CardContent>
    </Card>

    <Card className="overflow-hidden">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base">考勤记录</CardTitle></CardHeader>
      <div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>姓名</TableHead><TableHead>角色</TableHead><TableHead>签到时间</TableHead><TableHead>签退时间</TableHead><TableHead>工时</TableHead><TableHead>状态</TableHead><TableHead>备注</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
        <TableBody>{loading ? <TableRow><TableCell colSpan={8} className="h-20 text-center">加载中...</TableCell></TableRow> : records.length ? records.map((r) => (
          <TableRow key={r.id}><TableCell className="font-medium">{r.staff_name}</TableCell><TableCell><Badge variant="outline">{r.staff_role}</Badge></TableCell><TableCell>{datetime(r.check_in_time)}</TableCell><TableCell>{r.check_out_time ? datetime(r.check_out_time) : "—"}</TableCell><TableCell>{number(r.duration_hours, 2)} h</TableCell><TableCell><Badge variant={r.status === "checked_in" ? "default" : "secondary"}>{r.status === "checked_in" ? "在岗" : "已签退"}</Badge></TableCell><TableCell className="max-w-48 truncate">{r.remark || "—"}</TableCell><TableCell className="text-right">{r.status === "checked_in" && <Button variant="ghost" size="sm" onClick={() => void doCheckOut(r.id)}><LogOut className="mr-1 size-3" />签退</Button>}<Button variant="ghost" size="icon" className="text-destructive" onClick={() => void doDelete(r.id)}><Trash2 /></Button></TableCell></TableRow>
        )) : <TableRow><TableCell colSpan={8} className="h-52 text-center text-muted-foreground">暂无考勤记录</TableCell></TableRow>}</TableBody>
      </Table></div>
    </Card>
    {message && <p className="text-sm text-muted-foreground">{message}</p>}
  </div>
}
