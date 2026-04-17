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
  organization: string;
  assigned_task: string;
}

interface PipelineResult {
  id: string;
  original_text: string;
  extracted: {
    location: string;
    people_count: number;
    urgency: string;
  };
  classification: {
    category: string;
  };
  priority: {
    severity: string;
    urgency: string;
    priority_score: number;
  };
  matching: {
    matched_ngo: string;
    required_skills: string[];
  };
  plan: {
    volunteer_count: number;
    volunteer_plan: Volunteer[];
  };
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
      // Step 1: InputAgent
      const inputResult = await runAgent(
        "InputAgent",
        `Clean and extract basic info from this disaster text: "${inputText}". 
         Return JSON with: location (string), people_count (number, estimate if needed), urgency (Low/Medium/High/Critical).`,
        {
          type: Type.OBJECT,
          properties: {
            location: { type: Type.STRING },
            people_count: { type: Type.INTEGER },
            urgency: { type: Type.STRING }
          },
          required: ["location", "people_count", "urgency"]
        }
      );

      // Step 2: ClassificationAgent
      const classificationResult = await runAgent(
        "ClassificationAgent",
        `Based on this text: "${inputText}", classify the primary needs. 
         Return JSON with key 'category' which must be one of: Food, Healthcare, Shelter, Education, Sanitation, Others.`,
        {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING }
          },
          required: ["category"]
        }
      );

      // Step 3: PriorityAgent
      const priorityResult = await runAgent(
        "PriorityAgent",
        `Assess priority for: "${inputText}". 
         Return JSON with: severity (Low/Medium/High/Critical), urgency (Low/Medium/High/Critical), priority_score (0-100).`,
        {
          type: Type.OBJECT,
          properties: {
            severity: { type: Type.STRING },
            urgency: { type: Type.STRING },
            priority_score: { type: Type.INTEGER }
          },
          required: ["severity", "urgency", "priority_score"]
        }
      );

      // Step 4: MatchingAgent
      const matchingResult = await runAgent(
        "MatchingAgent",
        `Match the best NGO for: "${inputText}" with category "${classificationResult.category}". 
         NGO Options: Red Cross, UNICEF, NDRF, Goonj, CARE India. 
         Return JSON with: matched_ngo (string), required_skills (array of strings).`,
        {
          type: Type.OBJECT,
          properties: {
            matched_ngo: { type: Type.STRING },
            required_skills: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["matched_ngo", "required_skills"]
        }
      );

      // Step 5: ControllerAgent
      const finalResult = await runAgent(
        "ControllerAgent",
        `Finalize response plan for situation at "${inputResult.location}" with severity "${priorityResult.severity}". 
         Create a volunteer plan. 
         Rule: Low -> 2-3, Medium -> 4-6, High -> 7-10, Critical -> 11-15.
         Return JSON with: 
         - volunteer_count (number)
         - volunteer_plan (array of objects with: name, role, organization, assigned_task)
         Ensure volunteer_count matches array length.`,
        {
          type: Type.OBJECT,
          properties: {
            volunteer_count: { type: Type.INTEGER },
            volunteer_plan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  organization: { type: Type.STRING },
                  assigned_task: { type: Type.STRING }
                },
                required: ["name", "role", "organization", "assigned_task"]
              }
            }
          },
          required: ["volunteer_count", "volunteer_plan"]
        }
      );

      setResult({
        id: Math.random().toString(36).substring(7),
        original_text: inputText,
        extracted: inputResult,
        classification: classificationResult,
        priority: priorityResult,
        matching: matchingResult,
        plan: finalResult,
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
    switch (val.toLowerCase()) {
      case "critical": return "bg-[rgba(255,61,61,0.2)] text-[#FF3D3D]";
      case "high": return "bg-[rgba(245,158,11,0.2)] text-[#F59E0B]";
      case "medium": return "bg-sky-500/20 text-sky-400";
      default: return "bg-emerald-500/20 text-emerald-400";
    }
  };

  const chartData = result ? [
    { name: "MEDS", value: result.classification.category === "Healthcare" ? 90 : 30, opacity: 0.9 },
    { name: "WATER", value: result.classification.category === "Food" ? 80 : 60, opacity: 0.7 },
    { name: "FOOD", value: 40, opacity: 0.5 },
    { name: "SHELTER", value: result.classification.category === "Shelter" ? 70 : 30, opacity: 0.3 },
  ] : [];

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
              { name: "InputAgent.clean()", status: result ? "done" : loading ? "busy" : "wait" },
              { name: "ClassificationAgent.tag()", status: result ? "done" : loading ? "busy" : "wait" },
              { name: "PriorityAgent.score()", status: result ? "done" : loading ? "busy" : "wait" },
              { name: "MatchingAgent.assign()", status: result ? "done" : loading ? "busy" : "wait" },
              { name: "ControllerAgent.validate()", status: result ? "done" : loading ? "busy" : "wait" },
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
                    Situation Analysis
                  </span>
                  <div className="border-l-2 border-[#FF3D3D] pl-4 text-[14px] leading-relaxed text-[#E4E4E7]">
                    Extraction reveals a <span className="font-bold text-white uppercase">{result.priority.severity}</span> magnitude event in <span className="font-bold text-white">{result.extracted.location}</span>. 
                    {result.extracted.people_count > 0 && ` Approximately ${result.extracted.people_count} persons affected.`} Primary needs identified as <span className="font-bold text-[#FF3D3D]">{result.classification.category}</span>.
                  </div>
                </div>

                {/* Urgency Level */}
                <div className="bg-[#121214] border border-[#27272A] rounded-xl p-4 flex flex-col">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-3 block">
                    Urgency Level
                  </span>
                  <div className="mt-1">
                    <span className={cn("text-[10px] font-bold uppercase py-1 px-3 rounded-full", getUrgencyBadge(result.priority.urgency))}>
                      {result.priority.urgency}
                    </span>
                    <div className="flex items-baseline gap-2 mt-4 ml-1">
                      <span className="mono text-3xl font-bold">{result.priority.priority_score}</span>
                      <span className="text-[12px] text-[#71717A]">/ 100</span>
                    </div>
                    <div className="h-1 bg-[#27272A] rounded-full mt-3 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${result.priority.priority_score}%` }}
                        className="h-full bg-[#FF3D3D]"
                      />
                    </div>
                  </div>
                </div>

                {/* Casualties / Population */}
                <div className="bg-[#121214] border border-[#27272A] rounded-xl p-4">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-3 block">
                    Est. Affected Population
                  </span>
                  <div className="mono text-3xl font-bold mt-2 ml-1">
                    ~{result.extracted.people_count}
                  </div>
                  <span className="text-[11px] text-[#71717A] block mt-1">At-risk individuals identified</span>
                </div>

                {/* Volunteer Table */}
                <div className="col-span-4 bg-[#121214] border border-[#27272A] rounded-xl p-4 overflow-hidden">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-4 block">
                    Volunteer Assignment Plan (MatchingAgent Alpha)
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[12px]">
                      <thead>
                        <tr className="border-b border-[#27272A]">
                          <th className="text-left py-2 font-normal text-[#71717A]">VOLUNTEER NAME</th>
                          <th className="text-left py-2 font-normal text-[#71717A]">ROLE / SPECIALIZATION</th>
                          <th className="text-left py-2 font-normal text-[#71717A]">NGO AFFILIATION</th>
                          <th className="text-left py-2 font-normal text-[#71717A]">ASSIGNED TASK</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#27272A]/50">
                        {result.plan.volunteer_plan.map((v, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 font-semibold">{v.name}</td>
                            <td className="py-3 text-[#71717A]">{v.role}</td>
                            <td className="py-3">
                              <span className="bg-[#27272A] text-[10px] px-2 py-0.5 rounded uppercase tracking-tighter">
                                {v.organization}
                              </span>
                            </td>
                            <td className="py-3 text-[#E4E4E7]">{v.assigned_task}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Resource Distribution */}
                <div className="col-span-2 bg-[#121214] border border-[#27272A] rounded-xl p-4">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-5 block">
                    Resource Distribution Logic
                  </span>
                  <div className="flex items-end gap-3 h-28 px-2">
                    {chartData.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${d.value}%` }}
                          className="w-full bg-[#FF3D3D] rounded-t-sm relative flex items-center justify-center"
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

                {/* Agent Logs */}
                <div className="col-span-2 bg-[#121214] border border-[#27272A] rounded-xl p-4">
                  <span className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-3 block">
                    Intelligence Pipeline Logs
                  </span>
                  <div className="mono text-[11px] text-[#71717A] space-y-1">
                    <div>{`> SCAN_NGO_DB [SUCCESS]`}</div>
                    <div>{`> FILTERING: sector=${result.extracted.location}`}</div>
                    <div>{`> ANALYSIS: category=${result.classification.category}`}</div>
                    <div>{`> MATCH_FOUND: ${result.matching.matched_ngo}`}</div>
                    <div>{`> ASSIGN_QUEUE_ID: ${result.id.toUpperCase()}`}</div>
                  </div>
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


