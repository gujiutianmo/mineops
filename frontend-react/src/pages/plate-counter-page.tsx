import { useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Download, FileSearch, RefreshCw, Save, Target, Trash2, Upload } from "lucide-react"
import { api } from "@/lib/api"
import { date, datetime, number } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type Summary = { plate: string; plate_number?: string; count: number }
type AnalyzeResult = { summary?: Summary[]; daily?: Array<{ date?: string; total_trips?: number; summary?: Summary[] }>; total_trips?: number; source?: string; raw_text?: string; saved_days?: number }
type SavedRecord = { id: string; record_date: string; source: string; saved_at: string; total_trips?: number; active_plate_count?: number; summary?: Summary[] }
type RecordsResponse = { total: number; items: SavedRecord[] }
type Monthly = { year_month: string; total_trips?: number; saved_days?: number; active_plate_count?: number; summary?: Summary[]; daily?: Array<{ date: string; source?: string; total_trips?: number }> }
type TargetsResponse = { mine_id: string; fleet_id?: string | null; source?: string; plates: string[]; synced_vehicles?: number }

export function PlateCounterPage() {
  const { mineId } = useOutletContext<{ mineId: string }>()
  const mine = mineId ? { mine_id: mineId } : {}
  const [rawText, setRawText] = useState("")
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10))
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [records, setRecords] = useState<SavedRecord[]>([])
  const [monthly, setMonthly] = useState<Monthly | null>(null)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [targetText, setTargetText] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const load = () => Promise.all([
    api.get<RecordsResponse>("/plate-counter/records", mine),
    api.get<Monthly>("/plate-counter/monthly", { year_month: month, ...mine }),
    api.get<TargetsResponse>("/plate-counter/targets", mine),
  ]).then(([recordRows, monthlyRows, targetRows]) => {
    setRecords(recordRows.items || [])
    setMonthly(monthlyRows)
    setTargetText((targetRows.plates || []).join("\n"))
  }).catch((error) => setMessage(error instanceof Error ? error.message : "加载车牌比对数据失败"))

  useEffect(() => { void load() }, [mineId, month])

  const summary = result?.summary || []
  const monthRows = monthly?.summary || []
  const dailyRows = monthly?.daily || []
  const targetCount = useMemo(() => targetText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).length, [targetText])

  const analyze = async () => {
    if (!rawText.trim()) return
    setBusy(true)
    setMessage("")
    try {
      setResult(await api.post<AnalyzeResult>("/plate-counter/analyze", { text: rawText, source: "手工录入", record_date: recordDate, ...mine }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "分析失败")
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    if (!rawText.trim()) return
    setBusy(true)
    try {
      const saved = await api.post<AnalyzeResult>("/plate-counter/records", { raw_text: rawText, source: "手工录入", record_date: recordDate, ...mine })
      setResult(saved)
      setMessage("比对数据已保存，并已同步到车队趟数统计")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败")
    } finally {
      setBusy(false)
    }
  }
  const analyzeFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const suffix = mineId ? `?mine_id=${mineId}` : ""
      const next = await api.post<AnalyzeResult>(`/plate-counter/analyze-file${suffix}`, form)
      setResult(next)
      setRawText(next.raw_text || "")
      setMessage("文件已识别，确认后可保存为每日车牌趟数")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "文件识别失败")
    } finally {
      setBusy(false)
    }
  }
  const refreshTargets = async () => {
    try {
      const targets = await api.get<TargetsResponse>("/plate-counter/targets", mine)
      setTargetText((targets.plates || []).join("\n"))
      setMessage(`目标车牌已从车辆档案刷新：${targets.plates.length} 个`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刷新失败")
    }
  }
  const removeRecord = async (row: SavedRecord) => {
    if (!confirm(`删除 ${row.record_date} 的车牌比对数据？`)) return
    const suffix = mineId ? `?mine_id=${mineId}` : ""
    await api.delete(`/plate-counter/records/${encodeURIComponent(row.record_date)}${suffix}`)
    setMessage("车牌比对记录已删除，车队趟数已同步更新")
    await load()
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">车牌比对</h2>
        <p className="mt-1 text-sm text-muted-foreground">每天车牌识别后直接保存为车队趟数，月度统计会自动汇总。</p>
      </div>
      <Button variant="outline" onClick={() => api.download("/plate-counter/monthly/export", { year_month: month, ...mine })}><Download />导出月报</Button>
    </div>

    <Tabs defaultValue="entry" className="space-y-4">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="entry">每日录入</TabsTrigger>
        <TabsTrigger value="monthly">月度统计</TabsTrigger>
        <TabsTrigger value="history">保存记录</TabsTrigger>
        <TabsTrigger value="targets">目标车牌</TabsTrigger>
      </TabsList>

      <TabsContent value="entry" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
        <Card>
          <CardHeader><CardTitle className="text-base">原始运输文本</CardTitle><CardDescription>粘贴聊天记录、调度文本或车牌清单，也可以上传表格/文本文件识别。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2"><Label>记录日期</Label><Input type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} className="w-52" /></div>
              <Button variant="outline" asChild><Label className="cursor-pointer"><Upload />上传识别<Input type="file" accept=".xlsx,.csv,.tsv,.txt,.log" className="hidden" onChange={(event) => void analyzeFile(event.target.files?.[0])} /></Label></Button>
            </div>
            <Textarea className="min-h-[320px] font-mono text-sm" placeholder="粘贴包含车牌号的运输记录…" value={rawText} onChange={(event) => setRawText(event.target.value)} />
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void analyze()} disabled={!rawText || busy}><FileSearch />分析比对</Button><Button onClick={() => void save()} disabled={!rawText || busy}><Save />保存到车牌比对趟数</Button></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">比对结果</CardTitle><CardDescription>{summary.length ? `识别 ${summary.length} 个目标车牌，共 ${summary.reduce((sum, row) => sum + Number(row.count || 0), 0)} 趟` : "分析后将在这里显示车牌趟数"}</CardDescription></CardHeader>
          <CardContent className="p-0"><SummaryTable rows={summary} empty="暂无分析结果" /></CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="monthly" className="space-y-4">
        <Card><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between"><div className="space-y-2"><Label>统计月份</Label><Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="w-52" /></div><div className="grid grid-cols-3 gap-6 text-right"><Metric label="保存天数" value={monthly?.saved_days || 0} /><Metric label="活跃车牌" value={monthly?.active_plate_count || 0} /><Metric label="总趟数" value={monthly?.total_trips || 0} /></div></CardContent></Card>
        <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1fr)]"><Card><CardHeader><CardTitle className="text-base">每日汇总</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>日期</TableHead><TableHead>来源</TableHead><TableHead className="text-right">趟数</TableHead></TableRow></TableHeader><TableBody>{dailyRows.length ? dailyRows.map((row) => <TableRow key={row.date}><TableCell>{date(row.date)}</TableCell><TableCell>{row.source || "—"}</TableCell><TableCell className="text-right font-semibold">{number(row.total_trips)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="h-52 text-center text-muted-foreground">暂无每日汇总</TableCell></TableRow>}</TableBody></Table></CardContent></Card><Card><CardHeader><CardTitle className="text-base">车牌月度趟数</CardTitle></CardHeader><CardContent className="p-0"><SummaryTable rows={monthRows} empty="该月份暂无车牌统计" /></CardContent></Card></div>
      </TabsContent>

      <TabsContent value="history">
        <Card className="overflow-hidden"><Table><TableHeader><TableRow><TableHead>日期</TableHead><TableHead>来源</TableHead><TableHead>总趟数</TableHead><TableHead>保存时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{records.length ? records.map((row) => <TableRow key={row.id || row.record_date}><TableCell>{date(row.record_date)}</TableCell><TableCell>{row.source || "—"}</TableCell><TableCell>{number(row.total_trips)}</TableCell><TableCell>{datetime(row.saved_at)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive" onClick={() => void removeRecord(row)}><Trash2 /></Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="h-52 text-center text-muted-foreground">暂无保存记录</TableCell></TableRow>}</TableBody></Table></Card>
      </TabsContent>

      <TabsContent value="targets">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="size-4 text-primary" />目标车牌名单</CardTitle><CardDescription>目标车牌从车辆档案自动同步，不可手动修改。如需修改请到车辆档案管理中操作。</CardDescription></CardHeader>
          <CardContent className="space-y-4"><Textarea className="min-h-[360px] font-mono text-sm" value={targetText} readOnly disabled placeholder="从车辆档案加载车牌…" /><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">当前 {targetCount} 个目标车牌，与车辆档案保持同步</p><Button onClick={() => void refreshTargets()}><RefreshCw className="mr-2 size-4" />从车辆档案刷新</Button></div></CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    {message && <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">{message}</p>}
  </div>
}

function SummaryTable({ rows, empty }: { rows: Summary[]; empty: string }) {
  return <Table><TableHeader><TableRow><TableHead>车牌号</TableHead><TableHead className="text-right">趟数</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map((row, index) => <TableRow key={`${row.plate || row.plate_number}-${index}`}><TableCell className="font-mono text-primary">{row.plate || row.plate_number}</TableCell><TableCell className="text-right text-lg font-semibold">{row.count}</TableCell></TableRow>) : <TableRow><TableCell colSpan={2} className="h-64 text-center text-muted-foreground">{empty}</TableCell></TableRow>}</TableBody></Table>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="metric-number text-2xl font-semibold">{number(value)}</p></div>
}
