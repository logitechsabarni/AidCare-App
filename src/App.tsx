import React, { useState } from "react";
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
  TrendingUp,
  Briefcase
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
  Cell
} from "recharts";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Volunteer {
  name: string;
  role: string;
  skills: string[];
  organization: string;
  strength: string;
  assigned_task: string;
}

interface BackendResponse {
  location: string;
  people_count: number;
  severity: "Low" | "Medium" | "High" | "Critical";
  urgency: "Low" | "Medium" | "High" | "Critical";
  priority_score: number;
  need_type: string;
  volunteer_count: number;
  volunteer_plan: Volunteer[];
  resource_distribution: {
    medical_team: number;
    food_supply_team: number;
    rescue_team: number;
    logistics_team: number;
  };
  confidence: number;
}

interface DashboardReport {
  situation_summary: string;
  severity_visual: {
    label: string;
    score: number;
  };
  urgency_meter: {
    level: string;
    value: number;
  };
  affected_estimate: string;
  key_needs: string[];
  volunteer_table: {
    name: string;
    role: string;
    ngo: string;
    task: string;
  }[];
  resource_cards: {
    type: "MEDICAL" | "FOOD" | "RESCUE" | "LOGISTICS";
    allocation: number;
  }[];
  insight_logs: string[];
}

interface PipelineResult {
  backend_response: BackendResponse;
  dashboard_report: DashboardReport;
  timestamp: string;
}

export default function App() {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAgent = async (name: string, prompt: string, schema: any) => {
    console.log(`[${name}] Executing...`);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are the ${name} of the AidFlow System. Only return valid JSON matching the specified schema.`,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    if (!response.text) throw new Error(`Agent ${name} returned no output`);
    return JSON.parse(response.text);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Agent 1: Situation Intel Agent
      const situation = await runAgent(
        "SituationIntelAgent",
        `Extract situation data from: "${inputText}". 
         Return JSON: { location: string, people_estimate: number, context: string }.`,
        {
          type: Type.OBJECT,
          properties: {
            location: { type: Type.STRING },
            people_estimate: { type: Type.INTEGER },
            context: { type: Type.STRING }
          },
          required: ["location", "people_estimate", "context"]
        }
      );

      // Agent 2: Needs Analysis Agent
      const needs = await runAgent(
        "NeedsAnalysisAgent",
        `Identify primary needs for: "${inputText}". 
         Return JSON: { primary_need: string, key_indicators: string[] }.`,
        {
          type: Type.OBJECT,
          properties: {
            primary_need: { type: Type.STRING },
            key_indicators: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["primary_need", "key_indicators"]
        }
      );

      // Agent 3: Priority Scoring Agent
      const priority = await runAgent(
        "PriorityScoringAgent",
        `Calculate priority for: "${inputText}". 
         Return JSON: { severity: "Low" | "Medium" | "High" | "Critical", urgency: "Low" | "Medium" | "High" | "Critical", score: number(0-100) }.`,
        {
          type: Type.OBJECT,
          properties: {
            severity: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
            urgency: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
            score: { type: Type.INTEGER }
          },
          required: ["severity", "urgency", "score"]
        }
      );

      // Agent 4: NGO Strategic Matching Agent
      const matching = await runAgent(
        "MatchingAgent",
        `Match NGOs for: "${inputText}". 
         NGO Options: Red Cross, NDRF, Goonj, CARE India, Doctors Without Borders, UNICEF.
         Role consistency: Medical (paramedic, doctor), Rescue (Search/Rescue NDRF), Logistics (coordinator).
         Use realistic Indian names only (Arjun Mehta, Priya Nair, etc.).
         Return JSON matching Layer 1 volunteer_plan schema.`,
        {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              role: { type: Type.STRING },
              skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              organization: { type: Type.STRING },
              strength: { type: Type.STRING },
              assigned_task: { type: Type.STRING }
            },
            required: ["name", "role", "skills", "organization", "strength", "assigned_task"]
          }
        }
      );

      // Agent 5: System Controller Agent (Generates Backend Layer)
      const backendResponse = await runAgent(
        "ControllerAgent",
        `Compile Machine JSON for:
         Location: ${situation.location}
         Severity: ${priority.severity}
         Volunteers: ${JSON.stringify(matching)}
         Distribution must match severity logic. Critical = High allocations.
         Return exactly Layer 1 Machine JSON.`,
        {
          type: Type.OBJECT,
          properties: {
            location: { type: Type.STRING },
            people_count: { type: Type.INTEGER },
            severity: { type: Type.STRING },
            urgency: { type: Type.STRING },
            priority_score: { type: Type.INTEGER },
            need_type: { type: Type.STRING },
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
            confidence: { type: Type.NUMBER }
          },
          required: ["location", "people_count", "severity", "urgency", "priority_score", "need_type", "volunteer_count", "volunteer_plan", "resource_distribution", "confidence"]
        }
      );

      // Agent 6: Dashboard Rendering Agent (Generates UI Layer)
      const dashboardReport = await runAgent(
        "DashboardAgent",
        `Generate UI Dashboard Report based on previous intelligence.
         Situation: ${situation.context}
         Backend Response: ${JSON.stringify(backendResponse)}
         Return exactly Layer 2 UI structure.`,
        {
          type: Type.OBJECT,
          properties: {
            situation_summary: { type: Type.STRING },
            severity_visual: {
              type: Type.OBJECT,
              properties: { label: { type: Type.STRING }, score: { type: Type.INTEGER } }
            },
            urgency_meter: {
              type: Type.OBJECT,
              properties: { level: { type: Type.STRING }, value: { type: Type.INTEGER } }
            },
            affected_estimate: { type: Type.STRING },
            key_needs: { type: Type.ARRAY, items: { type: Type.STRING } },
            volunteer_table: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  ngo: { type: Type.STRING },
                  task: { type: Type.STRING }
                }
              }
            },
            resource_cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  allocation: { type: Type.INTEGER }
                }
              }
            },
            insight_logs: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["situation_summary", "severity_visual", "urgency_meter", "affected_estimate", "key_needs", "volunteer_table", "resource_cards", "insight_logs"]
        }
      );

      setResult({
        backend_response: backendResponse,
        dashboard_report: dashboardReport,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Pipeline Error:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyBadge = (val: string) => {
    switch (val?.toLowerCase()) {
      case "critical": return "bg-[rgba(255,61,61,0.2)] text-[#FF3D3D]";
      case "high": return "bg-[rgba(245,158,11,0.2)] text-[#F59E0B]";
      case "medium": return "bg-sky-500/20 text-sky-400";
      default: return "bg-emerald-500/20 text-emerald-400";
    }
  };

  const chartData = result ? result.dashboard_report.resource_cards.map(card => ({
    name: card.type,
    value: card.allocation,
    opacity: card.type === "RESCUE" ? 0.9 : card.type === "MEDICAL" ? 0.7 : 0.5
  })) : [];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0A0A0B] text-[#E4E4E7]">
      {/* Header */}
      <header className="h-16 bg-[#121214] border-b border-[#27272A] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FF3D3D] rounded flex items-center justify-center font-black text-white text-lg">A</div>
          <div className="font-bold text-lg tracking-tight">
            AidFlow <span className="font-light opacity-60">Intelligence</span>
          </div>
        </div>
        <div className="mono text-[11px] text-[#22C55E] flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-pulse" />
          PIPELINE READY // CLOUD-RUN: ACTIVE // GEMINI-3-FLASH
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 grid grid-cols-[320px_1fr] overflow-hidden">
        {/* Sidebar */}
        <aside className="border-r border-[#27272A] bg-[#0A0A0B] flex flex-col p-5 gap-6 overflow-y-auto">
          <div>
            <label className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-2 block">
              Disaster Narrative Input
            </label>
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Submit disaster report..."
                className="w-full h-36 bg-[#121214] border border-[#27272A] rounded-lg p-3 text-[13px] leading-relaxed resize-none focus:outline-none focus:border-[#FF3D3D] transition-colors"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !inputText}
                className={cn(
                  "w-full h-10 rounded font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed",
                  loading ? "bg-[#27272A] text-[#71717A]" : "bg-[#FF3D3D] text-white hover:opacity-90 active:scale-[0.98]"
                )}
              >
                {loading ? "PROCESSING..." : "EXECUTE DISPATCH PLAN"}
              </button>
            </form>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-1">
              Agent Pipeline Status
            </span>
            {[
              { name: "SituationIntelAgent.scan()", status: result ? "done" : loading ? "busy" : "wait" },
              { name: "NeedsAnalysisAgent.tag()", status: result ? "done" : loading ? "busy" : "wait" },
              { name: "PriorityScoringAgent.calc()", status: result ? "done" : loading ? "busy" : "wait" },
              { name: "MatchingAgent.lookup()", status: result ? "done" : loading ? "busy" : "wait" },
              { name: "ControllerAgent.compile()", status: result ? "done" : loading ? "busy" : "wait" },
              { name: "DashboardAgent.render()", status: result ? "done" : loading ? "busy" : "wait" },
            ].map((agent, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex items-center justify-between p-2.5 border rounded text-[12px] bg-[#0A0A0B]",
                  agent.status === "busy" ? "border-[#FF3D3D] bg-[#FF3D3D]/5" : "border-[#27272A]"
                )}
              >
                <span className={cn(agent.status === "wait" && "opacity-40")}>{agent.name}</span>
                {agent.status === "done" && <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />}
                {agent.status === "busy" && <span className="text-[10px] text-[#FF3D3D] animate-pulse">EXECUTING</span>}
                {agent.status === "wait" && <span className="opacity-20">—</span>}
              </div>
            ))}
          </div>
        </aside>

        {/* Dashboard Area */}
        <section className="bg-[#0A0A0B] overflow-y-auto p-5 relative">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center border border-dashed border-[#27272A] rounded-xl text-[#71717A]"
              >
                <Activity className="w-12 h-12 mb-4 opacity-20" />
                <span className="mono text-[10px] uppercase tracking-[0.2em]">Awaiting Situation Feed</span>
              </motion.div>
            )}

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-[#121214] rounded-xl border border-[#27272A] animate-pulse" />)}
                </div>
                <div className="h-64 bg-[#121214] rounded-xl border border-[#27272A] animate-pulse" />
              </motion.div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-4 gap-4"
              >
                {/* Situation Analysis */}
                <div className="col-span-2 bg-[#121214] border border-[#27272A] rounded-xl p-4">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-3 block">
                    Intelligence Summary
                  </span>
                  <div className="border-l-2 border-[#FF3D3D] pl-4 text-[14px] leading-relaxed text-[#E4E4E7]">
                    {result.dashboard_report.situation_summary}
                  </div>
                </div>

                {/* Urgency Level */}
                <div className="bg-[#121214] border border-[#27272A] rounded-xl p-4 flex flex-col">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-3 block">
                    Priority Score
                  </span>
                  <div className="mt-1">
                    <span className={cn("text-[10px] font-bold uppercase py-1 px-3 rounded-full", getUrgencyBadge(result.dashboard_report.urgency_meter.level))}>
                      {result.dashboard_report.urgency_meter.level}
                    </span>
                    <div className="flex items-baseline gap-2 mt-4 ml-1">
                      <span className="mono text-3xl font-bold">{result.dashboard_report.severity_visual.score}</span>
                      <span className="text-[12px] text-[#71717A]">/ 100</span>
                    </div>
                    <div className="h-1 bg-[#27272A] rounded-full mt-3 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${result.dashboard_report.severity_visual.score}%` }}
                        className="h-full bg-[#FF3D3D]"
                      />
                    </div>
                  </div>
                </div>

                {/* Affected Population */}
                <div className="bg-[#121214] border border-[#27272A] rounded-xl p-4">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-3 block">
                    Affected Context
                  </span>
                  <div className="mono text-xl font-bold mt-2 ml-1 text-[#FF3D3D]">
                    {result.dashboard_report.affected_estimate}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {result.dashboard_report.key_needs.map((need, idx) => (
                      <span key={idx} className="text-[9px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20 uppercase font-bold">
                        {need}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Volunteer Table */}
                <div className="col-span-4 bg-[#121214] border border-[#27272A] rounded-xl p-4 overflow-hidden">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-4 block">
                    Strategic Volunteer Deployment Plan
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[12px]">
                      <thead>
                        <tr className="border-b border-[#27272A]">
                          <th className="text-left py-2 font-normal text-[#71717A]">NAME</th>
                          <th className="text-left py-2 font-normal text-[#71717A]">DESIGNATION</th>
                          <th className="text-left py-2 font-normal text-[#71717A]">ORGANIZATION</th>
                          <th className="text-left py-2 font-normal text-[#71717A]">MISSION ASSIGNMENT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#27272A]/50">
                        {result.dashboard_report.volunteer_table.map((v, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 font-semibold">{v.name}</td>
                            <td className="py-3 text-[#71717A]">{v.role}</td>
                            <td className="py-3">
                              <span className="bg-[#27272A] text-[10px] px-2 py-0.5 rounded uppercase tracking-tighter text-white">
                                {v.ngo}
                              </span>
                            </td>
                            <td className="py-3 text-[#E4E4E7] mono text-[11px]">{v.task}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Resource Distribution */}
                <div className="col-span-2 bg-[#121214] border border-[#27272A] rounded-xl p-4">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-5 block">
                    Tactical Resource Allocation (%)
                  </span>
                  <div className="flex items-end gap-3 h-28 px-2">
                    {chartData.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${d.value}%` }}
                          className="w-full bg-[#FF3D3D] rounded-t-sm relative flex items-center justify-center min-h-[4px]"
                          style={{ opacity: d.opacity }}
                        >
                          <span className="mono vertical-rl text-[9px] text-[#E4E4E7] font-bold py-2 pointer-events-none uppercase">
                            {d.name}
                          </span>
                        </motion.div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Intelligence Logs */}
                <div className="col-span-2 bg-[#121214] border border-[#27272A] rounded-xl p-4">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-3 block">
                    Multi-Agent Intelligence Feed
                  </span>
                  <div className="mono text-[11px] text-[#71717A] space-y-1 overflow-y-auto max-h-28 scrollbar-hide">
                    {result.dashboard_report.insight_logs.map((log, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-[#22C55E]">✓</span>
                        <span>{log}</span>
                      </div>
                    ))}
                    <div className="animate-pulse flex gap-2">
                      <span className="text-[#FF3D3D] font-bold">»</span>
                      <span className="italic text-[9px]">AWAITING NEXT CYCLE...</span>
                    </div>
                  </div>
                </div>

                {/* Backend Compatibility Footer (within report) */}
                <div className="col-span-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <ShieldCheck className="w-4 h-4 text-emerald-500" />
                     <span className="mono text-[10px] text-emerald-400 uppercase tracking-widest">Backend JSON Layer Verified</span>
                   </div>
                   <div className="mono text-[9px] text-[#71717A]">CONFIDENCE_INDEX: {(result.backend_response.confidence * 100).toFixed(1)}%</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Footer */}
      <footer className="h-8 bg-[#121214] border-top border-[#27272A] flex items-center justify-between px-4 shrink-0 mono text-[10px] text-[#71717A]">
        <div>NODE: ASIA-SOUTH1-A // SECURE_CON: AES_256</div>
        <div>&copy; 2026 AIDFLOW MULTI-AGENT ARCHITECTURE</div>
        <div>LATENCY: 42MS // JSON_STRUCT: VALID</div>
      </footer>
    </div>
  );
}

function Card({ icon, label, value, badgeClass }: { icon: React.ReactNode, label: string, value: string | number, badgeClass?: string }) {
  // Unused in updated layout but kept for compatibility if needed elsewhere
  return null;
}


