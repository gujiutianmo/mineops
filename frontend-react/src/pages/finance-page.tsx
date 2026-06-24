import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useOutletContext } from "react-router-dom"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Download, FileSpreadsheet, Pencil, Plus, RefreshCw, Trash2, Upload, WalletCards } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"
import { date, money, number, text } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type Mine = { id: string; name: string }
type FinanceType = "income" | "expense"
type FinanceRecord = { id: string; mine_id?: string; fleet_id?: string; trans_type: FinanceType; amount: number; currency: string; category?: string; description?: string; recorder?: string; trans_date: string }
type FormState = { mine_id: string; fleet_id: string; trans_type: FinanceType; amount: string; currency: string; category: string; description: string; recorder: string; trans_date: string }
type Analysis = {
  record_count: number
  income_count: number
  expense_count: number
  currencies: Record<string, { income?: number; expense?: number }>
  monthly_trend: { month: string; currency: string; income: number; expense: number }[]
}
type ImportResult = { message?: string; imported?: number; errors?: string[] }

const today = () => new Date().toISOString().slice(0, 10)
const DEFAULT_RATE = 2200
const RATE_KEY = "mineops_cdf_per_usd"
const loadRate = () => {
  const value = Number(localStorage.getItem(RATE_KEY))
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RATE
}
const initialForm = (mineId = "", fleetId = ""): FormState => ({
  mine_id: mineId,
  fleet_id: fleetId,
  trans_type: "expense",
  amount: "",
  currency: "USD",
  category: "",
  description: "",
  recorder: "",
  trans_date: today(),
})

export function FinancePage() {
  const { user } = useAuth()
  const { mineId, fleetId, mines } = useOutletContext<{ mineId: string; fleetId?: string; mines: Mine[] }>()
  const isFleetOpsApp = typeof window !== "undefined" && window.location.pathname.startsWith("/fleetops")
  const effectiveFleetId = isFleetOpsApp ? user?.fleet_id || fleetId || "" : user?.role === "fleet" ? user.fleet_id || "" : fleetId || ""
  const scope = isFleetOpsApp && !effectiveFleetId ? {} : effectiveFleetId ? { fleet_id: effectiveFleetId } : mineId ? { mine_id: mineId } : {}
  const [analysis, setAnalysis] = useState<Analysis>({ record_count: 0, income_count: 0, expense_count: 0, currencies: {}, monthly_trend: [] })
  const [rows, setRows] = useState<FinanceRecord[]>([])
  const [filters, setFilters] = useState({ start_date: "", end_date: "", trans_type: "" })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceRecord | null>(null)
  const [form, setForm] = useState<FormState>(initialForm(mineId || user?.mine_id || "", effectiveFleetId))
  const [message, setMessage] = useState("")
  const [importing, setImporting] = useState(false)
  const [rate, setRate] = useState(loadRate)
  const [rateInput, setRateInput] = useState(String(loadRate()))

  const load = async () => {
    try {
      const params = { ...scope, ...filters }
      const [a, r] = await Promise.all([
        api.get<Analysis>("/finance/analysis", params),
        api.get<FinanceRecord[]>("/finance/", { limit: 1000, ...params }),
      ])
      setAnalysis({ ...analysis, ...a })
      setRows(r || [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "财务数据加载失败")
    }
  }

  useEffect(() => { void load() }, [mineId, effectiveFleetId])

  const totals = useMemo(() => {
    const data = Object.entries(analysis.currencies || {}).map(([currency, value]) => ({
      currency,
      income: Number(value.income || 0),
      expense: Number(value.expense || 0),
      net: Number(value.income || 0) - Number(value.expense || 0),
    }))
    return data.length ? data : [{ currency: "USD", income: 0, expense: 0, net: 0 }]
  }, [analysis.currencies])

  const converted = useMemo(() => {
    const usd = totals.find((item) => item.currency === "USD") || { income: 0, expense: 0, net: 0 }
    const cdf = totals.find((item) => item.currency === "CDF") || { income: 0, expense: 0, net: 0 }
    const incomeUsd = Number(usd.income) + Number(cdf.income) / rate
    const expenseUsd = Number(usd.expense) + Number(cdf.expense) / rate
    const netUsd = Number(usd.net) + Number(cdf.net) / rate
    return { incomeUsd, expenseUsd, netUsd, incomeCdf: incomeUsd * rate, expenseCdf: expenseUsd * rate, netCdf: netUsd * rate }
  }, [totals, rate])

  const chartData = useMemo(() => {
    const grouped: Record<string, { month: string; income: number; expense: number }> = {}
    for (const item of analysis.monthly_trend || []) {
      grouped[item.month] ||= { month: item.month, income: 0, expense: 0 }
      grouped[item.month].income += Number(item.income || 0)
      grouped[item.month].expense += Number(item.expense || 0)
    }
    return Object.values(grouped).slice(-12)
  }, [analysis.monthly_trend])

  const openCreate = () => {
    setEditing(null)
    setForm(initialForm(mineId || user?.mine_id || "", effectiveFleetId))
    setOpen(true)
  }

  const openEdit = (row: FinanceRecord) => {
    setEditing(row)
    setForm({
      mine_id: row.mine_id || mineId || user?.mine_id || "",
      fleet_id: row.fleet_id || effectiveFleetId,
      trans_type: row.trans_type,
      amount: String(row.amount || ""),
      currency: row.currency || "USD",
      category: row.category || "",
      description: row.description || "",
      recorder: row.recorder || "",
      trans_date: row.trans_date?.slice(0, 10) || today(),
    })
    setOpen(true)
  }

  const save = async () => {
    const targetFleetId = form.fleet_id || effectiveFleetId
    const targetMineId = form.mine_id || mineId || user?.mine_id || ""
    if (!isFleetOpsApp && !targetFleetId && !targetMineId) { setMessage("请先选择矿山或车队"); return }
    const payload = { ...form, mine_id: targetFleetId || isFleetOpsApp ? "" : targetMineId, fleet_id: targetFleetId, amount: Number(form.amount) }
    if (editing) await api.put(`/finance/${editing.id}`, payload)
    else await api.post("/finance/", payload)
    setOpen(false)
    setMessage("财务记录已保存")
    await load()
  }

  const remove = async (row: FinanceRecord) => {
    if (!confirm("确认删除这条财务记录？")) return
    await api.delete(`/finance/${row.id}`)
    await load()
  }

  const saveRate = () => {
    const next = Number(rateInput)
    if (!Number.isFinite(next) || next <= 0) { setMessage("请输入有效汇率"); return }
    setRate(next)
    localStorage.setItem(RATE_KEY, String(next))
    setMessage(`汇率已更新：1 USD = ${number(next)} CDF`)
  }

  const scopedQuery = () => {
    const params = new URLSearchParams()
    Object.entries(scope).forEach(([key, value]) => {
      if (value) params.set(key, String(value))
    })
    const search = params.toString()
    return search ? `?${search}` : ""
  }

  const importExcel = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setMessage("请上传 .xlsx 格式的 Excel 文件")
      return
    }
    setImporting(true)
    setMessage("")
    const data = new FormData()
    data.append("file", file)
    try {
      const result = await api.post<ImportResult>(`/finance/import/excel${scopedQuery()}`, data)
      const errors = result.errors || []
      setMessage(`${result.message || `成功导入 ${result.imported || 0} 条财务记录`}${errors.length ? `；失败 ${errors.length} 条：${errors.slice(0, 3).join("；")}` : ""}`)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Excel 导入失败")
    } finally {
      setImporting(false)
    }
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold">财务管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">{effectiveFleetId ? "当前为车队财务数据" : "收入、支出、净额和财务流水分析"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => api.download("/finance/import/template")}><FileSpreadsheet />导入模板</Button>
        <Button variant="outline" asChild disabled={importing}>
          <label className="cursor-pointer">
            <Upload />{importing ? "导入中..." : "批量导入"}
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                void importExcel(event.target.files?.[0])
                event.target.value = ""
              }}
            />
          </label>
        </Button>
        <Button variant="outline" onClick={() => api.download("/finance/export/excel", { ...scope, ...filters })}><Download />导出</Button>
        <Button onClick={openCreate}><Plus />新增财务</Button>
      </div>
    </div>

    <Card><CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
      <Field label="开始日期"><Input type="date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} /></Field>
      <Field label="结束日期"><Input type="date" value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} /></Field>
      <Field label="类型"><Select value={filters.trans_type || "all"} onValueChange={(value) => setFilters({ ...filters, trans_type: value === "all" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="income">收入</SelectItem><SelectItem value="expense">支出</SelectItem></SelectContent></Select></Field>
      <Button variant="outline" onClick={() => void load()}><RefreshCw />刷新分析</Button>
    </CardContent></Card>

    <div className="grid gap-3 md:grid-cols-3">{totals.map((item) => <Card key={item.currency}><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-sm font-medium">{item.currency}</p><WalletCards className="size-4 text-primary" /></div><div className="mt-4 grid gap-2 text-sm"><div className="flex justify-between text-primary"><span>收入</span><strong>{money(item.income, item.currency)}</strong></div><div className="flex justify-between text-destructive"><span>支出</span><strong>{money(item.expense, item.currency)}</strong></div><div className="flex justify-between border-t pt-2"><span>净额</span><strong className={item.net >= 0 ? "text-primary" : "text-destructive"}>{money(item.net, item.currency)}</strong></div></div></CardContent></Card>)}</div>

    <Card><CardHeader><CardTitle>汇率转换</CardTitle><CardDescription>当前默认 1 USD = 2200 CDF，可手动修改。</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-[1fr_auto]"><Field label="汇率（1 USD = ? CDF）"><Input type="number" min="1" value={rateInput} onChange={(event) => setRateInput(event.target.value)} /></Field><Button className="self-end" onClick={saveRate}>保存汇率</Button><div className="rounded-xl border border-border p-4 md:col-span-2"><div className="grid gap-3 md:grid-cols-3"><div><p className="text-xs text-muted-foreground">折算收入</p><p className="font-semibold text-primary">{money(converted.incomeUsd, "USD")}</p><p className="text-xs text-muted-foreground">{money(converted.incomeCdf, "CDF")}</p></div><div><p className="text-xs text-muted-foreground">折算支出</p><p className="font-semibold text-destructive">{money(converted.expenseUsd, "USD")}</p><p className="text-xs text-muted-foreground">{money(converted.expenseCdf, "CDF")}</p></div><div><p className="text-xs text-muted-foreground">折算净额</p><p className={`font-semibold ${converted.netUsd >= 0 ? "text-primary" : "text-destructive"}`}>{money(converted.netUsd, "USD")}</p><p className="text-xs text-muted-foreground">{money(converted.netCdf, "CDF")}</p></div></div></div></CardContent></Card>

    <Card><CardHeader><CardTitle>月度趋势</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" opacity={0.25} /><XAxis dataKey="month" /><YAxis /><Bar dataKey="income" fill="#10b981" name="收入" /><Bar dataKey="expense" fill="#ef4444" name="支出" /></BarChart></ResponsiveContainer></CardContent></Card>

    <Card className="overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>日期</TableHead><TableHead>类型</TableHead><TableHead>金额</TableHead><TableHead>分类</TableHead><TableHead>说明</TableHead><TableHead>记录人</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map((row) => <TableRow key={row.id}><TableCell>{date(row.trans_date)}</TableCell><TableCell><Badge variant={row.trans_type === "income" ? "default" : "secondary"}>{row.trans_type === "income" ? "收入" : "支出"}</Badge></TableCell><TableCell>{money(row.amount, row.currency)}</TableCell><TableCell>{text(row.category)}</TableCell><TableCell className="max-w-72 truncate">{text(row.description)}</TableCell><TableCell>{text(row.recorder)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => void remove(row)}><Trash2 /></Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="h-40 text-center text-muted-foreground">暂无财务记录</TableCell></TableRow>}</TableBody></Table></div></Card>

    {message && <p className="text-sm text-muted-foreground">{message}</p>}

    <Sheet open={open} onOpenChange={setOpen}><SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>{editing ? "编辑财务记录" : "新增财务记录"}</SheetTitle><SheetDescription>{isFleetOpsApp ? "车队财务会自动写入当前车队，不需要选择矿山。" : "收支类型只分收入和支出；“其他”放在分类里使用。"}</SheetDescription></SheetHeader><div className="space-y-4 px-4 py-5">{user?.role === "super" && !effectiveFleetId && !isFleetOpsApp ? <Field label="所属矿山"><Select value={form.mine_id || ""} onValueChange={(value) => setForm({ ...form, mine_id: value })}><SelectTrigger><SelectValue placeholder="选择矿山" /></SelectTrigger><SelectContent>{mines.map((mine) => <SelectItem key={mine.id} value={mine.id}>{mine.name}</SelectItem>)}</SelectContent></Select></Field> : null}<Field label="收支类型"><Select value={form.trans_type} onValueChange={(value: FinanceType) => setForm({ ...form, trans_type: value, category: value === "income" ? "" : form.category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">收入</SelectItem><SelectItem value="expense">支出</SelectItem></SelectContent></Select></Field><Field label="金额"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field><Field label="币种"><Select value={form.currency} onValueChange={(value) => setForm({ ...form, currency: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="CDF">CDF</SelectItem></SelectContent></Select></Field>{form.trans_type === "expense" ? <Field label="支出模块"><Select value={form.category || ""} onValueChange={(value) => setForm({ ...form, category: value })}><SelectTrigger><SelectValue placeholder="选择支出类型" /></SelectTrigger><SelectContent><SelectItem value="工资">工资</SelectItem><SelectItem value="其他">其他</SelectItem></SelectContent></Select></Field> : <Field label="收入分类"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="例如：运输收入、其他" /></Field>}<Field label="说明"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field><Field label="记录人"><Input value={form.recorder} onChange={(e) => setForm({ ...form, recorder: e.target.value })} /></Field><Field label="日期"><Input type="date" value={form.trans_date} onChange={(e) => setForm({ ...form, trans_date: e.target.value })} /></Field></div><SheetFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={() => void save()} disabled={!form.amount || !form.trans_date || (!isFleetOpsApp && !form.mine_id && !form.fleet_id && !effectiveFleetId)}>保存</Button></SheetFooter></SheetContent></Sheet>
  </div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}
