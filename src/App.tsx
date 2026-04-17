import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  Send, 
  AlertTriangle, 
  MapPin, 
  Users, 
  Clock, 
  Activity, 
  ShieldCheck, 
  Heart, 
  Stethoscope, 
  Utensils, 
  Loader2,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Briefcase,
  Download,
  Terminal,
  Cpu,
  Globe,
  Zap,
  ChevronRight,
  Database,
  Search,
  CheckSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Sector
} from "recharts";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GoogleGenAI, Type } from "@google/genai";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Data Interfaces ---

interface Volunteer {
  name: string;
  role: string;
  skills: string[];
  organization: string;
  strength: string;
  assigned_task: string;
}

interface MachineJSON {
  raw_input: string;
  cleaned_input: string;
  location: string;
  people_count: number;
  need_type: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  urgency: "Low" | "Medium" | "High" | "Critical";
  priority_score: number;
  volunteer_count: number;
  volunteer_plan: Volunteer[];
  resource_distribution: {
    medical_team: number;
    food_supply_team: number;
    rescue_team: number;
    logistics_team: number;
  };
  reasoning_summary: string;
  confidence: number;
}

interface PipelineStep {
  name: string;
  label: string;
  status: "idle" | "running" | "completed" | "error";
  latency?: string;
}

// --- Components ---

const StatusTerminal = React.memo(({ logs }: { logs: string[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-black/80 border border-theme-border rounded-lg p-3 font-mono text-[10px] h-[120px] overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-2 text-theme-text-dim border-b border-theme-border pb-1 shrink-0">
        <Terminal className="w-3 h-3 text-theme-accent" />
        <span className="uppercase tracking-widest">System_Logs_Kernel</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-theme-accent brightness-125 select-none font-bold">»</span>
            <span className={cn(
              log.includes("SUCCESS") || log.includes("COMPLETED") ? "text-theme-success" : 
              log.includes("DETECTED") || log.includes("IDENTIFIED") ? "text-sky-400" : "text-theme-text-dim"
            )}>
              {log}
            </span>
          </div>
        ))}
        <div className="animate-pulse flex gap-2">
            <span className="text-theme-accent select-none font-bold">_</span>
        </div>
      </div>
    </div>
  );
});

StatusTerminal.displayName = "StatusTerminal";

const PriorityGauge = React.memo(({ score }: { score: number }) => {
  const data = useMemo(() => [
    { value: score, fill: score > 75 ? "#FF3D3D" : score > 40 ? "#F59E0B" : "#22C55E" },
    { value: 100 - score, fill: "rgba(255, 255, 255, 0.05)" }
  ], [score]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%" debounce={100}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="85%"
            startAngle={180}
            endAngle={0}
            dataKey="value"
            stroke="none"
            isAnimationActive={false}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute top-[60%] flex flex-col items-center">
        <span className="text-2xl font-black mono text-theme-text-main leading-none">{Math.round(score)}</span>
        <span className="text-[10px] mono text-theme-text-dim uppercase tracking-tighter">Priority Index</span>
      </div>
    </div>
  );
});

PriorityGauge.displayName = "PriorityGauge";

const ResourceWheel = React.memo(({ data }: { data: MachineJSON["resource_distribution"] }) => {
  const chartData = useMemo(() => [
    { name: "Medical", value: data.medical_team, color: "#FF3D3D" },
    { name: "Food", value: data.food_supply_team, color: "#F59E0B" },
    { name: "Rescue", value: data.rescue_team, color: "#22C55E" },
    { name: "Logistics", value: data.logistics_team, color: "#3B82F6" },
  ], [data]);

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius="50%"
          outerRadius="80%"
          paddingAngle={4}
          dataKey="value"
          stroke="none"
          isAnimationActive={false}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ backgroundColor: "#0C0C0E", border: "1px solid #1F1F23", borderRadius: "8px", fontSize: "10px" }}
          itemStyle={{ color: "#E4E4E7" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});

ResourceWheel.displayName = "ResourceWheel";

const PipelineStepIndicator = React.memo(({ step }: { step: PipelineStep }) => (
  <div className="flex flex-col items-center gap-2 group flex-1 relative">
    <div className={cn(
      "w-10 h-10 rounded-lg flex items-center justify-center border transition-all duration-500 relative z-10",
      step.status === "completed" ? "bg-theme-success/10 border-theme-success/50 text-theme-success" :
      step.status === "running" ? "bg-theme-accent/20 border-theme-accent animate-pulse text-theme-accent shadow-[0_0_15px_rgba(255,61,61,0.3)]" :
      "bg-theme-surface border-theme-border text-theme-text-dim opacity-50"
    )}>
      {step.status === "completed" ? <CheckCircle2 className="w-5 h-5" /> : 
       step.status === "running" ? <Loader2 className="w-5 h-5 animate-spin" /> :
       <Zap className="w-5 h-5" />}
    </div>
    <div className="flex flex-col items-center">
      <span className={cn(
        "mono text-[8px] uppercase tracking-widest font-bold",
        step.status === "idle" ? "text-theme-text-dim" : "text-theme-text-main"
      )}>{step.label}</span>
      {step.latency && <span className="mono text-[7px] text-theme-success opacity-70 italic">{step.latency}ms</span>}
    </div>
  </div>
));

PipelineStepIndicator.displayName = "PipelineStepIndicator";

// --- Main App ---

export default function App() {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MachineJSON | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(["SYSTEM READY", "WAITING FOR UPLINK..."]);
  const [steps, setSteps] = useState<PipelineStep[]>([
    { name: "input", label: "Intel_Ingest", status: "idle" },
    { name: "classify", label: "Need_Triage", status: "idle" },
    { name: "priority", label: "Crisis_Score", status: "idle" },
    { name: "match", label: "NGO_Deploy", status: "idle" },
    { name: "control", label: "Final_Audit", status: "idle" },
  ]);

  const addLog = React.useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const updateStep = React.useCallback((name: string, status: PipelineStep["status"], latency?: string) => {
    setSteps(prev => prev.map(s => s.name === name ? { ...s, status, latency } : s));
  }, []);

  const runAgent = React.useCallback(async (name: string, prompt: string, schema: any) => {
    const start = performance.now();
    addLog(`INITIALIZING ${name.toUpperCase()}...`);
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are the ${name} of the AidFlow Studio. Be precise. Return valid technical JSON only. Use Indian names for volunteers. Use real NGOs: Red Cross, NDRF, UNICEF, Goonj, CARE India.`,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const end = performance.now();
    const duration = Math.round(end - start);

    if (!response.text) throw new Error(`${name} empty response`);
    addLog(`${name.toUpperCase()} COMPLETED [${duration}ms]`);
    return { data: JSON.parse(response.text), latency: duration.toString() };
  }, [addLog]);

  const handleAnalyze = React.useCallback(async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setLogs(["STARTING MULTI-AGENT PIPELINE...", "SCANNING_INPUT_STREAM..."]);
    setSteps(prev => prev.map(s => ({ ...s, status: "idle", latency: undefined })));

    try {
      // Step 1: Input Ingest
      updateStep("input", "running");
      const { data: inputData, latency: l1 } = await runAgent("InputInformer", `Process: "${inputText}". 
        Extract location, estimated people affected, cleaned summary.`, {
          type: Type.OBJECT,
          properties: {
            cleaned_input: { type: Type.STRING },
            location: { type: Type.STRING },
            people_count: { type: Type.INTEGER }
          },
          required: ["cleaned_input", "location", "people_count"]
      });
      addLog(`LOCATION_DETECTED: ${inputData.location}`);
      updateStep("input", "completed", l1);

      // Step 2: Need Triage
      updateStep("classify", "running");
      const { data: classData, latency: l2 } = await runAgent("ClassifyAgent", `Triage needs for: "${inputText}". 
        Choose from: Healthcare, Food, Shelter, Sanitation, Education, Others.`, {
          type: Type.OBJECT,
          properties: {
            need_type: { type: Type.STRING }
          },
          required: ["need_type"]
      });
      addLog(`NEED_IDENTIFIED: ${classData.need_type}`);
      updateStep("classify", "completed", l2);

      // Step 3: Crisis Score
      updateStep("priority", "running");
      const { data: priData, latency: l3 } = await runAgent("PriorityScorer", `Crisis assessment for: "${inputText}". 
        Scale 0-100. Severity/Urgency: Low-Critical.`, {
          type: Type.OBJECT,
          properties: {
            severity: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
            urgency: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
            priority_score: { type: Type.INTEGER }
          },
          required: ["severity", "urgency", "priority_score"]
      });
      addLog(`SEVERITY_COMPUTED: ${priData.severity} (${priData.priority_score})`);
      updateStep("priority", "completed", l3);

      // Step 4: Strategic Match
      updateStep("match", "running");
      const { data: matchData, latency: l4 } = await runAgent("MatchMaster", `Tactical assignment for: "${classData.need_type}" in "${inputText}". 
        Produce volunteer_plan. Indian names only.`, {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              role: { type: Type.STRING },
              skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              organization: { type: Type.STRING, enum: ["Red Cross", "NDRF", "UNICEF", "Goonj", "CARE India"] },
              strength: { type: Type.STRING },
              assigned_task: { type: Type.STRING }
            },
            required: ["name", "role", "skills", "organization", "strength", "assigned_task"]
          }
      });
      addLog(`MATCHING_CONCLUDED: ${matchData.length} PERSONNEL FOUND`);
      updateStep("match", "completed", l4);

      // Step 5: Final Audit
      updateStep("control", "running");
      const { data: finalData, latency: l5 } = await runAgent("SystemController", `Assemble master response for situation: "${inputText}". 
        Assemble results into Layer 1 machine JSON. Reasoning summary is required.`, {
          type: Type.OBJECT,
          properties: {
            raw_input: { type: Type.STRING },
            cleaned_input: { type: Type.STRING },
            location: { type: Type.STRING },
            people_count: { type: Type.INTEGER },
            need_type: { type: Type.STRING },
            severity: { type: Type.STRING },
            urgency: { type: Type.STRING },
            priority_score: { type: Type.INTEGER },
            volunteer_count: { type: Type.INTEGER },
            volunteer_plan: { type: Type.ARRAY, items: { type: Type.OBJECT } },
            resource_distribution: {
              type: Type.OBJECT,
              properties: {
                medical_team: { type: Type.INTEGER },
                food_supply_team: { type: Type.INTEGER },
                rescue_team: { type: Type.INTEGER },
                logistics_team: { type: Type.INTEGER }
              }
            },
            reasoning_summary: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: ["raw_input", "cleaned_input", "location", "people_count", "need_type", "severity", "urgency", "priority_score", "volunteer_count", "volunteer_plan", "resource_distribution", "reasoning_summary", "confidence"]
      });
      addLog(`FINAL_AUDIT_SUCCESS: CONFIDENCE ${(finalData.confidence * 100).toFixed(1)}%`);
      updateStep("control", "completed", l5);

      setResult(finalData);
      addLog("MISSION DEPLOYMENT PLAN READY.");

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Pipeline Disrupted");
      addLog("CRITICAL_SYSTEM_FAILURE: PIPELINE_INTERRUPTED");
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, runAgent, updateStep, addLog]);

  const downloadPDF = React.useCallback(() => {
    if (!result) return;
    const doc = new jsPDF();
    
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 61, 61);
    doc.text("AidFlow Intelligence Studio", 105, 20, { align: "center" });
    
    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Mission Plan Generated: ${result.location}`, 105, 30, { align: "center" });
    doc.text(`Timestamp: ${new Date().toLocaleString()}`, 105, 35, { align: "center" });

    // Section: Overview
    doc.setDrawColor(200);
    doc.line(20, 45, 190, 45);
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("1. Situational Intelligence", 20, 55);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Cleaned Narrative: ${result.cleaned_input.slice(0, 100)}...`, 20, 65);
    doc.text(`Affected Population: ~${result.people_count}`, 20, 72);
    doc.text(`Severity: ${result.severity} | Urgency: ${result.urgency}`, 20, 79);
    doc.text(`Priority Index: ${result.priority_score}/100`, 20, 86);

    // Section: Reasoning
    doc.setFont("helvetica", "bold");
    doc.text("Strategic Reasoning Summary:", 20, 100);
    doc.setFont("helvetica", "normal");
    const splitReason = doc.splitTextToSize(result.reasoning_summary, 170);
    doc.text(splitReason, 20, 105);

    // Section: Volunteer Table
    doc.setFont("helvetica", "bold");
    doc.text("2. Strategic Volunteer Deployment", 20, 140);
    
    autoTable(doc, {
      startY: 145,
      head: [['Name', 'Role', 'NGO', 'Task']],
      body: result.volunteer_plan.map(v => [v.name, v.role, v.organization, v.assigned_task]),
      headStyles: { fillColor: [255, 61, 61], textColor: [255, 255, 255], halign: 'center' },
      styles: { fontSize: 8, halign: 'left' },
      margin: { left: 20, right: 20 }
    });

    // Save
    doc.save(`AidFlow_Report_${result.location.replace(/ /g, "_")}.pdf`);
  }, [result]);

  const getUrgencyColor = React.useCallback((val: string) => {
    switch (val?.toLowerCase()) {
      case "critical": return "text-[#FF3D3D]";
      case "high": return "text-[#F59E0B]";
      case "medium": return "text-sky-400";
      default: return "text-emerald-400";
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-theme-bg text-theme-text-main relative select-none">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
      <div className="scanline" />

      {/* Hero / Left Control Rail */}
      <aside className="w-[380px] border-r border-theme-border flex flex-col p-6 z-20 bg-theme-surface/80 backdrop-blur-md">
        <div className="flex items-center gap-4 mb-8">
           <div className="w-12 h-12 bg-theme-accent rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,61,61,0.5)]">
             <Globe className="w-7 h-7 text-white" />
           </div>
           <div>
             <h1 className="font-black text-xl tracking-tight leading-none">AidFlow</h1>
             <p className="mono text-[10px] text-theme-accent uppercase tracking-[0.2em] mt-1 font-bold">Studio Intelligence</p>
           </div>
        </div>

        <div className="space-y-6 flex-1 flex flex-col">
          <section className="bg-black/40 border border-theme-border rounded-xl p-4 glow-card">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-theme-accent" />
              <label className="mono text-[10px] uppercase tracking-widest text-theme-text-dim">Intel_Ingest_Port</label>
            </div>
            <form onSubmit={handleAnalyze} className="space-y-4">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Awaiting live disaster narrative..."
                className="w-full h-32 bg-[#050506] border border-theme-border rounded-lg p-3 text-[13px] leading-relaxed resize-none focus:outline-none focus:border-theme-accent transition-all mono scrollbar-hide"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !inputText}
                className={cn(
                  "w-full h-12 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 relative group overflow-hidden",
                  loading ? "bg-theme-border text-theme-text-dim cursor-not-allowed" : "bg-theme-accent text-white hover:shadow-[0_0_30px_rgba(255,61,61,0.4)]"
                )}
              >
                {loading ? (
                   <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                   </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Execute Analysis</span>
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out" />
                  </>
                )}
              </button>
            </form>
          </section>

          <StatusTerminal logs={logs} />

          <div className="bg-theme-border/20 p-4 rounded-xl border border-theme-border flex-1">
             <div className="flex items-center gap-2 mb-4">
               <Briefcase className="w-4 h-4 text-theme-accent" />
               <h3 className="mono text-[10px] font-bold uppercase tracking-widest">Pipeline_Topology</h3>
             </div>
             <div className="flex flex-col gap-6 relative">
                {/* Connector Line */}
                <div className="absolute left-[19px] top-6 bottom-6 w-[1px] bg-theme-border" />
                {steps.map((step, idx) => (
                   <div key={idx} className="flex items-center gap-4 group">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center border transition-all relative z-10",
                        step.status === "completed" ? "bg-theme-success/10 border-theme-success/50 text-theme-success" :
                        step.status === "running" ? "bg-theme-accent/20 border-theme-accent animate-pulse text-theme-accent" :
                        "bg-theme-surface border-theme-border text-theme-text-dim"
                      )}>
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-baseline">
                           <span className={cn("mono text-[10px] font-bold uppercase tracking-widest", step.status !== 'idle' ? 'text-theme-text-main' : 'text-theme-text-dim opacity-40')}>{step.label}</span>
                           {step.latency && <span className="mono text-[8px] text-theme-success">{step.latency}ms</span>}
                         </div>
                         <div className="h-0.5 bg-theme-border mt-1 rounded-full overflow-hidden">
                            {step.status === 'running' && <motion.div animate={{ x: [-40, 380] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-full w-20 bg-theme-accent" />}
                            {step.status === 'completed' && <div className="h-full w-full bg-theme-success" />}
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 grid grid-cols-12 grid-rows-[auto_1fr_auto] gap-6 relative overflow-y-auto">
         
         {/* Top Banner Analysis */}
         <section className={cn(
           "col-span-12 h-28 bg-theme-surface/50 border border-theme-border rounded-2xl p-6 flex items-center gap-12 transition-all glow-card group",
           !result && "opacity-20 grayscale pointer-events-none"
         )}>
            <div className="flex flex-col gap-1">
               <span className="mono text-[10px] text-theme-accent font-bold uppercase tracking-widest mb-1">Location_Vector</span>
               <div className="flex items-center gap-2">
                 <MapPin className="w-5 h-5 text-theme-accent" />
                 <h2 className="text-2xl font-black">{result?.location || "N/A_VECTOR"}</h2>
               </div>
            </div>

            <div className="h-12 w-[1px] bg-theme-border" />

            <div className="flex flex-col gap-1">
               <span className="mono text-[10px] text-theme-text-dim font-bold uppercase tracking-widest mb-1">Magnitude_Intel</span>
               <div className="flex items-center gap-2">
                 <Users className="w-5 h-5 text-theme-text-main" />
                 <h2 className="text-2xl font-black mono text-theme-accent">{result ? `~${result.people_count}` : "0_COUNT"}</h2>
               </div>
            </div>

            <div className="h-12 w-[1px] bg-theme-border" />

            <div className="flex-1 flex flex-col gap-2">
               <div className="flex justify-between items-baseline">
                 <span className="mono text-[10px] text-theme-text-dim font-bold uppercase tracking-widest">Crisis_Aura_Detection</span>
                 <span className={cn("mono text-[10px] font-bold uppercase", getUrgencyColor(result?.severity || ""))}>{result?.severity || "STANDBY"} Magnitude</span>
               </div>
               <div className="h-2 bg-theme-border rounded-full overflow-hidden flex gap-0.5 p-0.5">
                  {[...Array(10)].map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "h-full flex-1 rounded-sm",
                        i < (result ? result.priority_score / 10 : 0) ? "bg-theme-accent shadow-[0_0_10px_rgba(255,61,61,0.5)]" : "bg-white/5"
                      )}
                    />
                  ))}
               </div>
            </div>

            <div className="w-20 flex flex-col items-center">
               <span className="mono text-[8px] text-theme-text-dim font-bold uppercase mb-1">Confidence</span>
               <div className="w-12 h-12 rounded-full border-2 border-theme-border flex items-center justify-center p-1 relative">
                  <div className="absolute inset-0 bg-theme-success/10 rounded-full animate-ping" />
                  <span className="mono text-[10px] font-black text-theme-success">{(result?.confidence || 0) * 100}%</span>
               </div>
            </div>
         </section>

         {/* Middle Dashboard Grid */}
         <div className="col-span-12 grid grid-cols-12 gap-6">
            
            {/* Priority Visualization */}
            <div className={cn(
              "col-span-3 bg-theme-surface/50 border border-theme-border rounded-2xl p-6 flex flex-col items-center glow-card",
              !result && "opacity-20 grayscale"
            )}>
              <span className="mono text-[10px] text-theme-text-dim font-bold uppercase tracking-widest self-start mb-4">Urgency_Meter_v2</span>
              <div className="h-64 w-full">
                <PriorityGauge score={result?.priority_score || 0} />
              </div>
              <div className="mt-4 flex flex-col items-center">
                 <div className={cn("px-4 py-1 rounded border uppercase text-[10px] font-black mono tracking-widest", 
                  result?.urgency === "Critical" ? "bg-red-500/10 border-red-500/50 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : "border-theme-border text-theme-success")}>
                   Deployment: {result?.urgency || "Idle"}
                 </div>
              </div>
            </div>

            {/* Strategic Summary */}
            <div className={cn(
              "col-span-6 bg-theme-surface/50 border border-theme-border rounded-2xl p-6 glow-card flex flex-col",
              !result && "opacity-20 grayscale"
            )}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-theme-accent" />
                  <span className="mono text-[10px] text-theme-text-dim font-bold uppercase tracking-widest">Intelligence_Reasoning_Core</span>
                </div>
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => <div key={i} className="w-1 h-1 rounded-full bg-theme-accent animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />)}
                </div>
              </div>
              
              <div className="flex-1 space-y-4">
                 <div className="bg-black/20 p-4 rounded-xl border border-theme-border/50 text-sm leading-relaxed text-theme-text-main italic border-l-4 border-l-theme-accent">
                    {result ? result.reasoning_summary : "System operational. Monitoring global feeds for disaster indicators..."}
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-white/5 p-3 rounded-lg border border-theme-border group flex items-center gap-3 transition-all hover:bg-white/10">
                       <CheckSquare className="w-5 h-5 text-theme-success" />
                       <div className="flex flex-col">
                          <span className="mono text-[8px] uppercase font-black text-theme-success">Validation</span>
                          <span className="text-[11px] font-bold">Structural JSON Integrity OK</span>
                       </div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-theme-border group flex items-center gap-3 transition-all hover:bg-white/10">
                       <Database className="w-5 h-5 text-sky-400" />
                       <div className="flex flex-col">
                          <span className="mono text-[8px] uppercase font-black text-sky-400">Database</span>
                          <span className="text-[11px] font-bold">Tactical Match verified</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="mt-6 flex items-center justify-between pt-6 border-t border-theme-border">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-theme-success animate-pulse" />
                    <span className="mono text-[9px] text-theme-text-dim">AGENT RESPONSE MODE: ASYNCHRONOUS</span>
                  </div>
                  <button 
                    onClick={downloadPDF}
                    disabled={!result}
                    className="flex items-center gap-2 text-[10px] mono font-black uppercase text-theme-accent bg-theme-accent/10 border border-theme-accent/30 px-4 py-2 rounded-lg hover:bg-theme-accent hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3 h-3" />
                    Export Detailed Dossier (PDF)
                  </button>
              </div>
            </div>

            {/* Resource Distribution */}
            <div className={cn(
              "col-span-3 bg-theme-surface/50 border border-theme-border rounded-2xl p-6 flex flex-col glow-card",
              !result && "opacity-20 grayscale"
            )}>
              <span className="mono text-[10px] text-theme-text-dim font-bold uppercase tracking-widest mb-4">Resource_Payload_Wheel</span>
              <div className="flex-1 min-h-[160px]">
                {result && <ResourceWheel data={result.resource_distribution} />}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                 {[
                   { label: "MED", col: "text-theme-accent" },
                   { label: "FOOD", col: "text-[#F59E0B]" },
                   { label: "RESC", col: "text-theme-success" },
                   { label: "LOGI", col: "text-sky-400" },
                 ].map((d, i) => (
                   <div key={i} className="flex flex-col p-2 bg-black/40 rounded border border-theme-border">
                      <span className="mono text-[7px] font-black uppercase tracking-widest text-theme-text-dim">{d.label}</span>
                      <span className={cn("mono text-xs font-black", d.col)}>
                        {result ? Object.values(result.resource_distribution)[i] : "0"} units
                      </span>
                   </div>
                 ))}
              </div>
            </div>

            {/* Volunteer Deployment Table */}
            <div className={cn(
              "col-span-12 bg-theme-surface/50 border border-theme-border rounded-2xl p-6 glow-card overflow-hidden",
              !result && "opacity-20 grayscale"
            )}>
               <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-2">
                   <Users className="w-5 h-5 text-theme-accent" />
                   <h3 className="mono text-[10px] font-black uppercase tracking-[0.2em] text-theme-text-main">Strategic_Volunteer_Personnel_Matrix</h3>
                 </div>
                 <div className="px-3 py-1 bg-white/5 border border-theme-border rounded mono text-[9px] text-theme-text-dim">
                    LIVE_MATCHING_ENGINE // VERSION: 4.2.0-STABLE
                 </div>
               </div>

               <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-theme-border bg-black/20 text-theme-text-dim mono text-[9px] uppercase tracking-widest">
                        <th className="px-4 py-3 text-left font-bold">Personnel_Name</th>
                        <th className="px-4 py-3 text-left font-bold">Role_Specialization</th>
                        <th className="px-4 py-3 text-left font-bold">NGO_Nexus</th>
                        <th className="px-4 py-3 text-left font-bold">Operational_Task</th>
                        <th className="px-4 py-3 text-center font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/50">
                      {(result?.volunteer_plan || [...Array(4)]).map((v, i) => (
                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-theme-border flex items-center justify-center mono text-[10px] group-hover:bg-theme-accent group-hover:text-white transition-colors">
                                {v?.name?.charAt(0) || "?"}
                              </div>
                              <span className="font-black text-sm">{v?.name || "AWAITING_MATCH..."}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-theme-text-dim mono text-[11px]">{v?.role || "---"}</td>
                          <td className="px-4 py-4">
                            <span className="px-2 py-0.5 rounded-sm border border-theme-border bg-black/40 text-[9px] mono font-bold uppercase tracking-tighter text-white">
                               {v?.organization || "N/A"}
                            </span>
                          </td>
                          <td className="px-4 py-4 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-theme-text-main/80">
                             {v?.assigned_task || "Pipeline synchronization in progress..."}
                          </td>
                          <td className="px-4 py-4 text-center">
                             <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full mono text-[9px] font-black uppercase">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Ready
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
         </div>

         {/* Bottom Control / Status Bar */}
         <div className="col-span-12 flex items-center justify-between p-4 bg-theme-surface border border-theme-border rounded-xl">
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-theme-success animate-pulse" />
                  <span className="mono text-[9px] uppercase font-bold tracking-[0.2em] text-theme-success">Secure Network Uplink Verified</span>
               </div>
               <div className="h-4 w-[1px] bg-theme-border" />
               <div className="flex items-center gap-2 text-theme-text-dim">
                  <Clock className="w-3 h-3" />
                  <span className="mono text-[9px] uppercase">Latency: 42ms // Sync: 100%</span>
               </div>
            </div>

            <div className="flex items-center gap-4">
               <div className="flex -space-x-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="w-6 h-6 rounded-full border border-theme-surface bg-theme-border flex items-center justify-center mono text-[8px] font-black">AI</div>)}
               </div>
               <span className="mono text-[9px] text-theme-text-dim uppercase">Autonomous Agents Monitoring Feed</span>
            </div>
         </div>

      </main>

      {/* Visual Overlays */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl pointer-events-none"
          >
             <div className="relative">
                <div className="w-48 h-48 rounded-full border border-theme-accent/20 flex items-center justify-center">
                   <div className="w-32 h-32 rounded-full border-t-2 border-t-theme-accent animate-spin" />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                   <Cpu className="w-8 h-8 text-theme-accent animate-pulse" />
                   <span className="mono text-[10px] font-black uppercase tracking-[0.3em] text-theme-accent">Processing</span>
                </div>
             </div>
             <div className="mt-12 text-center space-y-4">
                <h3 className="mono text-2xl font-black text-white italic tracking-tighter">AI_ORCHESTRATOR::ALIGNING_AGENTS</h3>
                <p className="mono text-[10px] text-theme-text-dim uppercase tracking-[0.2em]">Executing mission parameters across secure nodes...</p>
                <div className="flex gap-1 justify-center">
                   {steps.map((s, i) => (
                      <div key={i} className={cn("h-1 w-12 rounded-full transition-all duration-500", s.status === 'completed' ? 'bg-theme-success shadow-[0_0_10px_#22C55E]' : s.status === 'running' ? 'bg-theme-accent w-20 shadow-[0_0_10px_#FF3D3D]' : 'bg-theme-border')} />
                   ))}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-10 right-10 z-[110] bg-red-500 text-white p-4 rounded-xl border-l-[10px] border-l-black shadow-2xl flex items-center gap-4 glow-card"
          >
             <AlertTriangle className="w-8 h-8" />
             <div className="flex flex-col">
               <span className="mono text-[10px] font-black uppercase tracking-widest">Protocol ERROR</span>
               <span className="text-sm font-bold">{error}</span>
             </div>
             <button onClick={() => setError(null)} className="ml-4 mono font-black text-xs hover:border-b">ACKNOWLEDGE</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
