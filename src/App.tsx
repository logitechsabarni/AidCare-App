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
  CheckSquare,
  LayoutDashboard,
  Brain,
  Truck,
  FileText,
  Workflow,
  DownloadCloud,
  Layers,
  Info,
  Map as MapIcon,
  Wind,
  Droplets,
  Flame,
  Globe2,
  MessageSquare,
  Thermometer,
  Shield,
  Eye,
  Settings,
  HelpCircle,
  Maximize2,
  Filter,
  BarChart3,
  BarChart2,
  Bot
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
  Sector,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from "recharts";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});
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
  lat: number;
  lng: number;
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
  feature_importance: {
    people_count: number;
    severity_keywords: number;
    urgency_signals: number;
    location_risk: number;
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

const TacticalScatterPlot = React.memo(({ seed }: { seed?: string }) => {
  const data = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 1000,
      id: `UN-${i}`
    }));
  }, [seed]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis type="number" dataKey="x" name="Distance" unit="km" stroke="#71717A" fontSize={8} tickLine={false} axisLine={false} />
        <YAxis type="number" dataKey="y" name="Density" unit="%" stroke="#71717A" fontSize={8} tickLine={false} axisLine={false} />
        <ZAxis type="number" dataKey="z" range={[60, 400]} name="Payload" unit="kg" />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: "#0C0C0E", border: "1px solid #1F1F23", borderRadius: "8px", fontSize: "10px" }} />
        <Scatter name="Resource Density" data={data} fill="#FF3D3D">
           {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#FF3D3D" : "#3B82F6"} />
           ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
});

TacticalScatterPlot.displayName = "TacticalScatterPlot";

const NeuralMeshVisualizer = React.memo(() => {
  const rings = [0, 1, 2, 3];
  
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#020203] rounded-2xl border border-theme-border group perspective-1000">
      {/* Background Deep Space / Scanning Lines */}
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      
      <svg className="absolute inset-0 w-full h-full opacity-30">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <pattern id="neuralPatternComplex" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
           <circle cx="20" cy="20" r="0.5" fill="#FF3D3D" fillOpacity="0.5" />
           <path d="M 0 20 L 40 20 M 20 0 L 20 40" stroke="#FF3D3D" strokeWidth="0.2" strokeOpacity="0.1" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#neuralPatternComplex)" />
        
        {/* Wandering Data Streams */}
        {[...Array(5)].map((_, i) => (
          <motion.circle
            key={i}
            r="1"
            fill="#FF3D3D"
            animate={{
              cx: [Math.random() * 400, Math.random() * 400],
              cy: [Math.random() * 400, Math.random() * 400],
              opacity: [0, 0.8, 0],
              scale: [0.5, 1.5, 0.5]
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              repeat: Infinity,
              ease: "linear"
            }}
            filter="url(#glow)"
          />
        ))}
      </svg>

      {/* Main Holographic Core */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
         <div className="relative w-56 h-56 transform-gpu group-hover:scale-110 transition-transform duration-700">
            {/* Spinning Rings with Gradients */}
            {rings.map((i) => (
              <motion.div
                key={i}
                initial={{ rotate: i * 90, scale: 0.7, opacity: 0 }}
                animate={{ 
                  rotate: (i * 90) + (i % 2 === 0 ? 360 : -360),
                  scale: [0.8, 1, 0.8],
                  opacity: [0.1, 0.4, 0.1],
                  borderRadius: [
                    "40% 60% 70% 30% / 40% 40% 60% 60%", 
                    "60% 40% 30% 70% / 60% 60% 40% 40%",
                    "40% 60% 70% 30% / 40% 40% 60% 60%"
                  ]
                }}
                transition={{ 
                  duration: 10 + i * 3, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute inset-0 border-2 border-transparent"
                style={{
                  background: `linear-gradient(${i * 45}deg, transparent, rgba(255,61,61,0.2), transparent)`,
                  borderImage: `linear-gradient(${i * 90}deg, #FF3D3D, #3B82F6) 1`,
                  maskImage: `radial-gradient(circle at center, transparent 65%, black 100%)`,
                  WebkitMaskImage: `radial-gradient(circle at center, transparent 65%, black 100%)`,
                  filter: 'blur(0.5px)'
                }}
              />
            ))}
            
            {/* Central Bio-Node */}
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="relative">
                  {/* Aura Layers */}
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-theme-accent/30 blur-2xl rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 2, 1], opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 5, repeat: Infinity }}
                    className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"
                  />
                  
                  {/* The Icon Container - Glassmorphism */}
                  <div className="relative z-10 p-5 bg-gradient-to-br from-black/80 to-theme-border/20 border border-theme-accent/50 rounded-[2rem] backdrop-blur-xl shadow-[0_0_30px_rgba(255,61,61,0.2)]">
                    <Brain className="w-10 h-10 text-theme-accent filter drop-shadow-[0_0_10px_rgba(255,61,61,0.8)]" />
                    
                    {/* Interior Scanning Ray */}
                    <motion.div
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-x-0 h-[1px] bg-theme-accent shadow-[0_0_8px_rgba(255,61,61,1)] z-20"
                    />
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* High-Tech HUD Overlays */}
      <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
         <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
               <span className="mono text-[10px] text-theme-accent font-black tracking-tighter flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-theme-accent animate-pulse" />
                  ML_KINETIC_SYNC
               </span>
               <div className="flex gap-1">
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ scaleY: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity }}
                      className="w-[2px] h-3 bg-theme-accent/40 rounded-full"
                    />
                  ))}
               </div>
            </div>
            <div className="mono text-[8px] text-theme-text-dim text-right font-bold space-y-1">
               <div>VECTOR::0042.88</div>
               <div>RECOGNITION::ENGAGED</div>
               <div className="text-theme-accent font-black">STABILITY::99.4%</div>
            </div>
         </div>

         <div className="flex items-end justify-between">
            <div className="space-y-1">
               <div className="flex items-center gap-2">
                  <span className="mono text-[8px] text-theme-text-dim uppercase font-black tracking-[0.3em]">Neural_Topology</span>
                  <div className="h-[1px] w-12 bg-theme-border flex-grow" />
               </div>
               <span className="mono text-[7px] text-theme-text-dim uppercase tracking-wider opacity-60">Deep_Supply_Sync_Engaged_Sector_07</span>
            </div>
            <div className="w-12 h-12 border-b-2 border-r-2 border-theme-accent p-1 opacity-40">
               <div className="w-full h-full border border-theme-accent/20 border-dashed" />
            </div>
         </div>
      </div>
    </div>
  );
});

NeuralMeshVisualizer.displayName = "NeuralMeshVisualizer";

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

type TabType = "situation" | "analysis" | "volunteers" | "resources" | "heatmap" | "chat" | "pipeline" | "download";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// --- Map Components ---

const MapSetter = ({ lat, lng }: { lat: number, lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [lat, lng, map]);
  return null;
};

const TacticalMap = React.memo(({ lat, lng, type, location }: { lat: number, lng: number, type?: string, location?: string }) => {
  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-theme-border relative">
      <MapContainer center={[lat, lng]} zoom={13} style={{ height: "100%", width: "100%" }} touchZoom={false} scrollWheelZoom={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <MapSetter lat={lat} lng={lng} />
        <Marker position={[lat, lng]}>
          <Popup>
            <div className="text-xs font-sans">
              <div className="font-bold text-theme-accent">{type?.toUpperCase() || "CRISIS"} CENTER</div>
              <div>{location || "Active Hotspot"}</div>
            </div>
          </Popup>
        </Marker>
        <Circle 
          center={[lat, lng]} 
          radius={2000} 
          pathOptions={{ color: '#FF3D3D', fillColor: '#FF3D3D', fillOpacity: 0.1, weight: 1 }} 
        />
      </MapContainer>
      <div className="absolute top-2 right-2 z-[1000] bg-black/80 border border-theme-border p-2 rounded backdrop-blur-sm pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-theme-accent animate-pulse" />
          <span className="mono text-[8px] uppercase tracking-widest text-theme-accent font-bold">Live_Satellite_Feed</span>
        </div>
        <div className="mono text-[7px] text-theme-text-dim">COORD: {lat.toFixed(4)}, {lng.toFixed(4)}</div>
      </div>
    </div>
  );
});

TacticalMap.displayName = "TacticalMap";

const ImportanceChart = React.memo(({ data }: { data: MachineJSON["feature_importance"] }) => {
  const chartData = useMemo(() => [
    { name: "Count", val: data.people_count },
    { name: "Keywords", val: data.severity_keywords },
    { name: "Urgency", val: data.urgency_signals },
    { name: "Loc Risk", val: data.location_risk },
  ], [data]);

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <BarChart data={chartData} layout="vertical" margin={{ left: -20, right: 20 }}>
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" stroke="#71717A" fontSize={8} tickLine={false} axisLine={false} />
        <Tooltip 
          cursor={{ fill: "rgba(255,255,255,0.05)" }}
          contentStyle={{ backgroundColor: "#0C0C0E", border: "1px solid #1F1F23", borderRadius: "8px", fontSize: "10px" }}
        />
        <Bar dataKey="val" fill="#FF3D3D" radius={[0, 4, 4, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
});

ImportanceChart.displayName = "ImportanceChart";

const HeatmapOverlay = React.memo(({ lat, lng }: { lat: number, lng: number }) => {
  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-theme-border relative">
      <MapContainer center={[lat, lng]} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <MapSetter lat={lat} lng={lng} />
        {/* Mock heat clusters with pulsing effect */}
        {[
          { pos: [lat, lng] as [number, number], r: 80000, op: 0.4, c: "#FF3D3D" },
          { pos: [lat + 1.2, lng - 0.8] as [number, number], r: 40000, op: 0.2, c: "#F59E0B" },
          { pos: [lat - 0.5, lng + 1.5] as [number, number], r: 60000, op: 0.3, c: "#EF4444" },
          { pos: [lat + 2, lng + 2] as [number, number], r: 30000, op: 0.1, c: "#3B82F6" }
        ].map((cluster, i) => (
          <React.Fragment key={i}>
            <Circle 
              center={cluster.pos} 
              radius={cluster.r} 
              pathOptions={{ stroke: false, fillOpacity: cluster.op, fillColor: cluster.c }} 
            />
            <Circle 
              center={cluster.pos} 
              radius={cluster.r * 1.5} 
              pathOptions={{ stroke: true, color: cluster.c, weight: 1, fill: false, dashArray: "5, 10" }} 
            />
          </React.Fragment>
        ))}
      </MapContainer>
      
      {/* Legend Overlay */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-black/80 backdrop-blur-md border border-theme-border p-4 rounded-xl flex flex-col gap-3">
         <span className="mono text-[9px] font-black text-theme-accent uppercase tracking-widest border-b border-theme-border pb-2">Spectral_Density_Key</span>
         <div className="space-y-2">
            {[
              { label: "High Casualty Probability", color: "bg-[#FF3D3D]" },
              { label: "Infrastructure Collapse", color: "bg-[#F59E0B]" },
              { label: "Medical Resource Deficit", color: "bg-[#EF4444]" },
              { label: "In-Transit Logistics", color: "bg-[#3B82F6]" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                 <div className={cn("w-2 h-2 rounded-full", item.color)} />
                 <span className="mono text-[8px] text-theme-text-dim uppercase">{item.label}</span>
              </div>
            ))}
         </div>
      </div>
      
      {/* HUD Info */}
      <div className="absolute top-6 right-6 z-[1000] flex flex-col items-end gap-2">
         <div className="px-3 py-1 bg-theme-accent text-white mono text-[10px] font-black uppercase rounded shadow-lg">Heatmap_Mode: MULTISPECTRAL</div>
         <div className="px-3 py-1 bg-black/60 border border-white/20 rounded mono text-[9px] text-theme-text-dim">SCAN_FREQ: 14.2 GHz</div>
      </div>
    </div>
  );
});

HeatmapOverlay.displayName = "HeatmapOverlay";

// --- Main App ---

export default function App() {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MachineJSON | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("situation");
  const [logs, setLogs] = useState<string[]>(["SYSTEM READY", "WAITING FOR UPLINK..."]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const scrollChatRef = useRef<HTMLDivElement>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([
    { name: "input", label: "Intel_Ingest", status: "idle" },
    { name: "classify", label: "Need_Triage", status: "idle" },
    { name: "priority", label: "Crisis_Score", status: "idle" },
    { name: "match", label: "NGO_Deploy", status: "idle" },
    { name: "control", label: "Final_Audit", status: "idle" },
  ]);

  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  const addLog = React.useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const isQuotaError = (err: any) => {
    const msg = err?.message || String(err);
    return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
  };

  const updateStep = React.useCallback((name: string, status: PipelineStep["status"], latency?: string) => {
    setSteps(prev => prev.map(s => s.name === name ? { ...s, status, latency } : s));
  }, []);

  const runAgent = React.useCallback(async (name: string, prompt: string, schema: any) => {
    const start = performance.now();
    addLog(`INITIALIZING ${name.toUpperCase()}...`);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: `You are the ${name} of the AidFlow Intelligence Command Center. Provide high-density, strategic intelligence in precise JSON. 

MANDATORY RULES:
1. All volunteers must belong to: [Red Cross, NDRF, UNICEF, Goonj, CARE India, Doctors Without Borders].
2. STRICT NGO DIVERSITY: For any group of 3 or more volunteers, you MUST use at least 3 DIFFERENT NGOs from the list. Never assign all personnel to one organization.
3. Use specialized roles: Instead of just 'Doctor' or 'Volunteer', use 'Trauma Surgeon', 'Hazardous Materials Specialist', 'Emergency Logistician', etc.
4. For the Input Agent, always provide precise, real-world lat/lng coordinates for the identified disaster location. For example: Wayanad, Kerala is approx 11.6854, 76.1320. Ensure coordinates are geographically accurate for the specific state/province.
5. Location Naming: Always include the State/Province in the location name (e.g. "Wayanad, Kerala, India" instead of just "Wayanad").
6. For the Priority Agent, provide feature importance weights (0-1) summing to approx 1.`,
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      if (!response.text) throw new Error(`${name} empty response`);
      const end = performance.now();
      const duration = Math.round(end - start);
      addLog(`${name.toUpperCase()} COMPLETED [${duration}ms]`);
      return { data: JSON.parse(response.text), latency: duration.toString() };
    } catch (err: any) {
      if (isQuotaError(err)) {
        setIsQuotaExceeded(true);
        throw new Error("QUOTA_EXHAUSTED");
      }
      throw err;
    }
  }, [addLog, setIsQuotaExceeded]);

  const handleAnalyze = React.useCallback(async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setLogs(["STARTING MULTI-AGENT PIPELINE...", "SCANNING_INPUT_STREAM..."]);
    setSteps(prev => prev.map(s => ({ ...s, status: "idle", latency: undefined })));

    try {
      setActiveTab("situation");

      // 1. Ingest
      updateStep("input", "running");
      const { data: ingData, latency: l1 } = await runAgent("InputAgent", `Process disaster report: "${inputText}". 
      1. Identify the specific location including Town/City, State, and Country.
      2. Retrieve precise latitude and longitude for this exact location.
      3. Extract estimated headcount and urgency.`, {
        type: Type.OBJECT,
        properties: {
          location: { type: Type.STRING, description: "Full location: City, State, Country" },
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER },
          people_count: { type: Type.INTEGER },
          urgency: { type: Type.STRING },
          cleaned_input: { type: Type.STRING }
        },
        required: ["location", "lat", "lng", "people_count", "urgency", "cleaned_input"]
      });
      updateStep("input", "completed", l1);

      // 2. Classify
      updateStep("classify", "running");
      const { data: clsData, latency: l2 } = await runAgent("ClassifyAgent", `Categorize needs for: ${ingData.cleaned_input}`, {
        type: Type.OBJECT,
        properties: {
          need_type: { type: Type.STRING }
        },
        required: ["need_type"]
      });
      updateStep("classify", "completed", l2);

      // 3. Priority
      updateStep("priority", "running");
      const { data: priData, latency: l3 } = await runAgent("PriorityAgent", `Score crisis in ${ingData.location} for ${ingData.people_count} people.`, {
        type: Type.OBJECT,
        properties: {
          severity: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
          priority_score: { type: Type.INTEGER },
          feature_importance: {
            type: Type.OBJECT,
            properties: {
              people_count: { type: Type.NUMBER },
              severity_keywords: { type: Type.NUMBER },
              urgency_signals: { type: Type.NUMBER },
              location_risk: { type: Type.NUMBER }
            },
            required: ["people_count", "severity_keywords", "urgency_signals", "location_risk"]
          }
        },
        required: ["severity", "priority_score", "feature_importance"]
      });
      updateStep("priority", "completed", l3);

      // 4. Match
      updateStep("match", "running");
      const { data: matData, latency: l4 } = await runAgent("MatchAgent", `Deploy a specialized personnel pool for a ${priData.severity} severity ${clsData.need_type} disaster. 
      SCALE REQUIREMENTS: 
      - If 'Critical': 15-22 personnel, min 7 unique NGOs. 
      - If 'High': 10-12 personnel, min 5 unique NGOs. 
      NGO LIST: Red Cross, MSF, OXFAM, UNICEF, WFP, CARE, Mercy Corps, NRC, IRC, Direct Relief.
      CRITICAL: Each role must have a UNIQUE TACTICAL TASK. For example, 'Deploying Portable Water Filtration Unit Model X' or 'Setting up Triage Zone Gamma-4'. Use technical/clinical terminology.`, {
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
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                organization: { type: Type.STRING },
                strength: { type: Type.STRING },
                assigned_task: { type: Type.STRING }
              },
              required: ["name", "role", "organization", "assigned_task"]
            }
          }
        },
        required: ["volunteer_count", "volunteer_plan"]
      });
      updateStep("match", "completed", l4);

      // 5. Audit
      updateStep("control", "running");
      const { data: finData, latency: l5 } = await runAgent("ControllerAgent", `Final review. Assemble full mission dossier. 
      CRITICAL: Validate NGO diversity. For 'Critical' severity, ensure at least 5-6 unique organizations are represented. For 'High', at least 4.
      Ensure tasks are distinct and clinical.`, {
        type: Type.OBJECT,
        properties: {
          raw_input: { type: Type.STRING },
          cleaned_input: { type: Type.STRING },
          location: { type: Type.STRING },
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER },
          people_count: { type: Type.INTEGER },
          need_type: { type: Type.STRING },
          severity: { type: Type.STRING },
          urgency: { type: Type.STRING },
          priority_score: { type: Type.INTEGER },
          volunteer_count: { type: Type.INTEGER },
          volunteer_plan: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                organization: { type: Type.STRING },
                assigned_task: { type: Type.STRING },
                strength: { type: Type.STRING }
              },
              required: ["name", "role", "organization", "assigned_task"]
            } 
          },
          resource_distribution: {
            type: Type.OBJECT,
            properties: {
              medical_team: { type: Type.INTEGER },
              food_supply_team: { type: Type.INTEGER },
              rescue_team: { type: Type.INTEGER },
              logistics_team: { type: Type.INTEGER }
            },
            required: ["medical_team", "food_supply_team", "rescue_team", "logistics_team"]
          },
          reasoning_summary: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["resource_distribution", "reasoning_summary", "confidence", "volunteer_plan"]
      });
      updateStep("control", "completed", l5);

      const res: MachineJSON = {
        raw_input: inputText,
        cleaned_input: finData.cleaned_input || ingData.cleaned_input,
        location: finData.location || ingData.location,
        lat: finData.lat || ingData.lat,
        lng: finData.lng || ingData.lng,
        people_count: finData.people_count || ingData.people_count,
        need_type: finData.need_type || clsData.need_type,
        severity: (finData.severity || priData.severity) as any,
        urgency: (finData.urgency || ingData.urgency) as any,
        priority_score: finData.priority_score || priData.priority_score,
        volunteer_count: finData.volunteer_count || matData.volunteer_count,
        volunteer_plan: (finData.volunteer_plan || matData.volunteer_plan).map((v: any, idx: number) => {
          const ngoList = ["Red Cross", "NDRF", "UNICEF", "Goonj", "CARE India", "Doctors Without Borders"];
          return {
            ...v,
            organization: v.organization || ngoList[idx % ngoList.length]
          };
        }),
        resource_distribution: finData.resource_distribution,
        feature_importance: priData.feature_importance,
        reasoning_summary: finData.reasoning_summary,
        confidence: finData.confidence
      };

      setResult(res);
      addLog(`MISSION DOSSIER READY. CONFIDENCE ${(res.confidence * 100).toFixed(1)}%`);
      
      setChatHistory([{
        role: "assistant",
        content: `Dossier compiled for ${res.location}. Severity characterized as ${res.severity}. Strategic deployment includes ${res.volunteer_count} operatives across ${[...new Set(res.volunteer_plan.map(v => v.organization))].join(', ')}. How shall we proceed?`
      }]);

    } catch (err: any) {
      console.error(err);
      if (err.message === "QUOTA_EXHAUSTED" || isQuotaError(err)) {
        setError("RESOURCE_EXHAUSTED: AI Quota limit reached. Please check your Gemini API plan.");
        setIsQuotaExceeded(true);
      } else {
        setError("PIPELINE_TERMINATED: NODE_ERROR");
      }
      addLog("!!! CRITICAL SYSTEM FAILURE !!!");
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, runAgent, addLog, updateStep]);

  const handleChat = async () => {
    if (!chatInput.trim() || !result || isChatLoading) return;
    
    const userMsg = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...chatHistory.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
          { role: "user", parts: [{ text: userMsg }] }
        ],
        config: {
          systemInstruction: `You are the AidFlow Mission Advisor. User Context: ${JSON.stringify(result)}. Use this context to answer questions about the crisis, NGOs, and volunteers. Be technical, concise, and helpful.`
        }
      });
      
      setChatHistory(prev => [...prev, { role: "assistant", content: response.text || "COMM_LINK_ERROR" }]);
    } catch (err: any) {
      console.error(err);
      if (isQuotaError(err)) {
        setChatHistory(prev => [...prev, { role: "assistant", content: "ERROR: NEURAL_LINK_LIMIT_EXCEEDED. AI quota has been exhausted. Please retry later or upgrade your plan." }]);
        setIsQuotaExceeded(true);
      } else {
        setChatHistory(prev => [...prev, { role: "assistant", content: "ERROR: NEURAL_LINK_FAILED" }]);
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    if (scrollChatRef.current) {
      scrollChatRef.current.scrollTop = scrollChatRef.current.scrollHeight;
    }
  }, [chatHistory]);

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
    <div className="flex flex-col h-screen overflow-hidden bg-theme-bg text-theme-text-main relative select-none">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
      <div className="radar-sweep" />
      <div className="scanline" />

      <div className="flex flex-1 overflow-hidden">
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
          {isQuotaExceeded && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-start gap-4 mb-4"
            >
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
              <div className="space-y-1">
                <p className="mono text-[10px] font-black text-red-500 uppercase tracking-widest">AI_QUOTA_EXHAUSTED</p>
                <p className="text-[10px] text-theme-text-dim leading-relaxed">
                  The mission advisor's neural link has reached its throughput limit. Please check your Gemini API plan and billing at <a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noopener noreferrer" className="text-red-400 underline underline-offset-2">ai.google.dev</a>.
                </p>
              </div>
            </motion.div>
          )}

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
      <main className="flex-1 p-8 flex flex-col gap-6 relative overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(255,61,61,0.05),transparent_40%)]">
         {/* HUD Corner Accents */}
         <div className="absolute top-0 left-0 w-32 h-32 border-t border-l border-theme-border/30 pointer-events-none m-4 rounded-tl-3xl" />
         <div className="absolute top-0 right-0 w-32 h-32 border-t border-r border-theme-border/30 pointer-events-none m-4 rounded-tr-3xl" />
         <div className="absolute bottom-0 left-0 w-32 h-32 border-b border-l border-theme-border/30 pointer-events-none m-4 rounded-bl-3xl" />
         <div className="absolute bottom-0 right-0 w-32 h-32 border-b border-r border-theme-border/30 pointer-events-none m-4 rounded-br-3xl" />
         
         {/* Navigation Tabs and HUD Control */}
         <div className="flex items-center justify-between gap-6 z-50">
            <nav className="flex items-center gap-1 bg-theme-surface/40 p-1 border border-theme-border rounded-xl w-fit">
               {[
                 { id: "situation", label: "Situation", icon: LayoutDashboard },
                 { id: "analysis", label: "AI Analysis", icon: Brain },
                 { id: "volunteers", label: "Personnel", icon: Users },
                 { id: "resources", label: "Resources", icon: Truck },
                 { id: "heatmap", label: "Heatmap", icon: Globe2 },
                 { id: "chat", label: "AI Advisor", icon: Bot },
                 { id: "pipeline", label: "Logistics", icon: Workflow },
                 { id: "download", label: "Export", icon: DownloadCloud },
               ].map((tab) => (
                 <button
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as TabType)}
                   className={cn(
                     "flex items-center gap-2 px-4 py-2 rounded-lg mono text-[10px] font-black uppercase tracking-widest transition-all",
                     activeTab === tab.id 
                       ? "bg-theme-accent text-white shadow-[0_0_15px_rgba(255,61,61,0.3)]" 
                       : "text-theme-text-dim hover:text-theme-text-main hover:bg-white/5"
                   )}
                 >
                   <tab.icon className="w-3 h-3" />
                   {tab.label}
                 </button>
               ))}
            </nav>

            <div className="flex items-center gap-4 bg-theme-surface border border-theme-border rounded-xl px-4 py-2 hover:border-theme-accent/50 transition-colors group cursor-help shrink-0 shadow-xl">
               <div className="flex -space-x-2">
                  {["AI", "LLM", "AGI", "OP"].map((lbl, i) => <div key={i} className="w-5 h-5 rounded-full border border-theme-surface bg-theme-border flex items-center justify-center mono text-[7px] font-black text-theme-accent">{lbl}</div>)}
               </div>
               <div className="flex flex-col">
                  <span className="mono text-[8px] text-theme-accent font-black uppercase tracking-widest leading-none">Agents_Monitoring_Feed</span>
                  <span className="mono text-[7px] text-theme-text-dim uppercase tracking-tighter mt-0.5 whitespace-nowrap">Autonomous Intelligence Engine Active</span>
               </div>
               <div className="w-2 h-2 rounded-full bg-theme-success animate-pulse shadow-[0_0_10px_#22C55E]" />
            </div>
         </div>

         <div className="flex-1 h-full">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
               className="h-full"
             >
                {activeTab === "situation" && (
                  <div className="grid grid-cols-12 gap-6 pb-32">
                    {/* Top Banner Analysis */}
                    <section className={cn(
                      "col-span-12 h-32 bg-theme-surface/50 border border-theme-border rounded-2xl p-6 flex items-center gap-12 transition-all glow-card group",
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

                    <div className="col-span-8 space-y-6">
                      <div className="relative h-72 rounded-2xl overflow-hidden border border-theme-border group shadow-[0_0_30px_rgba(255,61,61,0.15)]">
                        {result ? (
                          <div className="relative h-full w-full">
                            <TacticalMap lat={result.lat} lng={result.lng} type={result.need_type} location={result.location} />
                            {/* Scanning HUD Overlay */}
                            <div className="absolute inset-0 pointer-events-none border-[20px] border-transparent">
                               <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-theme-accent/50" />
                               <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-theme-accent/50" />
                               <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-theme-accent/50" />
                               <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-theme-accent/50" />
                               
                               {/* Scanning Line */}
                               <motion.div 
                                 animate={{ top: ["0%", "100%", "0%"] }}
                                 transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                 className="absolute left-0 right-0 h-[1px] bg-theme-accent/30 shadow-[0_0_10px_rgba(255,61,61,0.5)] z-20"
                               />

                               {/* Grid Overlay */}
                               <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />
                            </div>
                          </div>
                        ) : (
                          <>
                            <img 
                              src={`https://picsum.photos/seed/${result?.need_type || 'emergency'}/1200/600?grayscale&blur=2`} 
                              className="w-full h-full object-cover opacity-50 transition-transform duration-700 group-hover:scale-110" 
                              referrerPolicy="no-referrer"
                              alt="Disaster Viz"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center mono text-[10px] uppercase tracking-widest text-theme-text-dim">
                              Awaiting Satellite Uplink...
                            </div>
                          </>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
                        <div className="absolute bottom-6 left-6 right-6 pointer-events-none flex justify-between items-end">
                          <div>
                            <span className="px-2 py-1 bg-theme-accent text-white mono text-[10px] font-bold uppercase rounded mb-2 inline-block shadow-[0_0_10px_rgba(255,61,61,0.5)]">Satellite_Live_Relay</span>
                            <h3 className="text-xl font-bold text-white mb-1">{result?.location || "Target Acquisition..."}</h3>
                            <div className="flex gap-4 mono text-[9px] text-theme-text-dim">
                               <span>LAT: {result?.lat?.toFixed(4) || "0.0000"}</span>
                               <span>LNG: {result?.lng?.toFixed(4) || "0.0000"}</span>
                               <span>ALT: 420km</span>
                            </div>
                          </div>
                          <div className="text-right">
                             <div className="mono text-[8px] text-theme-accent font-black uppercase mb-1 flex items-center justify-end gap-1">
                               <div className="w-1.5 h-1.5 rounded-full bg-theme-accent animate-ping" />
                               Neural_Link_Stable
                             </div>
                             <div className="px-3 py-1 bg-black/60 border border-white/20 rounded-full mono text-[9px] text-white">
                               RES: 0.15m/px
                             </div>
                          </div>
                        </div>
                      </div>

                       {/* Multispectral Imagery Gallery */}
                       <div className="grid grid-cols-4 gap-4">
                          {[
                            { name: "Optical_RGB", filter: "contrast-125 brightness-110", label: "Ground Truth" },
                            { name: "Infrared_NDVI", filter: "sepia contrast-150 saturate-200 hue-rotate-180", label: "Veg Stress" },
                            { name: "Thermal_Anomaly", filter: "invert contrast-200 saturate-0 brightness-150", label: "Heat Signatures" },
                            { name: "Atmospheric_WV", filter: "hue-rotate-180 brightness-75 contrast-120 saturate-200", label: "Humidity Delta" }
                          ].map((spec, i) => (
                           <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-theme-border group cursor-crosshair">
                              <img 
                                src={`https://picsum.photos/seed/${result?.location || 'wayanad'}-${spec.name}/400/225`} 
                                className={cn("w-full h-full object-cover transition-transform duration-500 group-hover:scale-110", spec.filter)}
                                referrerPolicy="no-referrer"
                                alt={spec.name}
                              />
                               <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
                               <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded mono text-[8px] text-white font-bold tracking-tighter border border-white/10 uppercase">
                                 {spec.name}
                               </div>
                               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 pointer-events-none">
                                  <div className="flex flex-col items-center gap-1">
                                    <Maximize2 className="w-5 h-5 text-theme-accent" />
                                    <span className="mono text-[8px] text-white uppercase font-black tracking-widest">Spectral Scan</span>
                                  </div>
                               </div>
                           </div>
                         ))}
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                         <div className="bg-theme-surface/50 border border-theme-border rounded-2xl p-6 glow-card">
                            <div className="flex items-center gap-2 mb-4">
                              <Info className="w-4 h-4 text-theme-accent" />
                              <span className="mono text-[10px] font-bold uppercase tracking-widest text-theme-text-dim">Operational_Context</span>
                            </div>
                            <p className="text-sm text-theme-text-main leading-relaxed italic border-l-2 border-theme-accent pl-4 py-1 bg-white/5 rounded-r-lg">
                              {result?.cleaned_input || "Waiting for signal modulation..."}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                               {["Logistics_Validated", "Humanitarian_Priority", "Uplink_Secure", "Intel_Sync"].map((tag, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-theme-accent/10 border border-theme-accent/20 rounded mono text-[7px] text-theme-accent uppercase font-black">{tag}</span>
                               ))}
                            </div>
                         </div>
                         <div className="bg-theme-surface/50 border border-theme-border rounded-2xl p-6 glow-card flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-theme-border/10 transition-all active:scale-[0.98]">
                            <div className="w-20 h-20 rounded-full border border-theme-border flex items-center justify-center mb-4 relative overflow-hidden">
                               <div className="absolute inset-0 bg-theme-accent/5 translate-y-full group-hover:translate-y-0 transition-transform duration-1000" />
                               <MapIcon className="w-10 h-10 text-theme-accent opacity-50 group-hover:scale-110 group-hover:opacity-100 transition-all z-10" />
                               <motion.div 
                                 animate={{ rotate: 360 }} 
                                 transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                                 className="absolute inset-0 border-t-2 border-theme-accent rounded-full"
                               />
                               <div className="absolute -top-1 -right-1 w-5 h-5 bg-theme-accent rounded-full flex items-center justify-center text-[10px] text-white font-black animate-bounce shadow-lg">!</div>
                            </div>
                            <span className="mono text-[10px] font-black uppercase text-theme-text-main group-hover:text-theme-accent transition-colors">{result?.location || "No Sector Lock"}</span>
                            <span className="mono text-[8px] text-theme-text-dim uppercase mt-1 tracking-tighter bg-theme-border/20 px-2 py-0.5 rounded-full">GEOSPATIAL::Deep_Sector_Scan</span>
                         </div>
                      </div>
          {/* Interactive Anomalies Feed */}
          <div className="col-span-12 mb-10">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <Search className="w-3.5 h-3.5 text-theme-accent" />
                   <span className="mono text-[10px] font-black uppercase tracking-[0.2em] text-theme-text-main">Anomaly_Stream::Spectral_Intelligence</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-theme-accent animate-pulse" />
                   <span className="mono text-[8px] text-theme-text-dim uppercase tracking-tighter">Live_Deep_Scan_Active</span>
                </div>
             </div>
             <div className="bg-black/40 border border-theme-border rounded-2xl p-5 flex gap-5 overflow-x-auto scrollbar-hide ring-1 ring-white/5 shadow-2xl">
                {[
                  { type: "Thermal", loc: "S-Sector", stat: "Elevated", val: "42.8°C", color: "text-orange-500" },
                  { type: "Structural", loc: "N-Bridge", stat: "Critical", val: "Fracture Detected", color: "text-red-500" },
                  { type: "Population", loc: "City_Center", stat: "Congested", val: "94% Density", color: "text-yellow-500" },
                  { type: "Bio-Hazard", loc: "W-Coast", stat: "Pending", val: "Awaiting Data", color: "text-purple-500" },
                  { type: "Acoustic", loc: "Valley_E", stat: "Normal", val: "Ambient Noise", color: "text-blue-500" }
                ].map((anomaly, i) => (
                   <div key={i} className="min-w-[240px] p-5 bg-theme-surface border border-theme-border rounded-xl flex items-center gap-4 hover:border-theme-accent hover:shadow-[0_0_25px_rgba(255,61,61,0.15)] transition-all cursor-crosshair group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-theme-accent/5 rounded-bl-[40px] translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
                      <div className="w-12 h-12 rounded-xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center text-theme-accent shrink-0 relative overflow-hidden">
                         <Zap className="w-6 h-6 group-hover:scale-110 transition-transform z-10" />
                         <motion.div 
                           animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
                           transition={{ repeat: Infinity, duration: 2 }}
                           className="absolute inset-0 bg-theme-accent rounded-full"
                         />
                      </div>
                      <div className="flex flex-col flex-1">
                         <div className="flex items-start justify-between">
                            <span className="mono text-[8px] text-theme-text-dim uppercase leading-none mb-1.5">{anomaly.type}</span>
                            <div className="w-1 h-1 rounded-full bg-theme-accent animate-ping" />
                         </div>
                         <span className="mono text-[11px] font-black text-white uppercase tracking-tight mb-2">{anomaly.loc}</span>
                         <div className="flex items-center justify-between mt-auto">
                            <span className={cn(
                               "mono text-[7px] font-black uppercase px-2 py-0.5 rounded-sm", 
                               anomaly.stat === 'Critical' ? 'bg-theme-accent text-white' : 'bg-theme-border/60 text-theme-text-dim'
                            )}>
                               {anomaly.stat}
                            </span>
                            <span className={cn("mono text-[9px] font-bold tracking-tighter", anomaly.color || "text-theme-accent")}>
                               {anomaly.val}
                            </span>
                         </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                   </div>
                ))}
             </div>
          </div>

                       <div className="bg-theme-surface/50 border border-theme-border rounded-2xl p-6 glow-card">
                          <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-4 h-4 text-theme-accent" />
                            <span className="mono text-[10px] font-bold uppercase tracking-widest text-theme-text-dim">Vital_Signs</span>
                          </div>
                          {[
                            { label: "Deployment Urgency", value: result?.urgency || "---", icon: Clock },
                            { label: "Criticality Level", value: result?.severity || "---", icon: AlertTriangle },
                            { label: "Confidence Index", value: result ? `${(result.confidence * 100).toFixed(1)}%` : "---" , icon: ShieldCheck },
                            { label: "Matching Confidence", value: result ? "High" : "---", icon: Brain }
                          ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between py-3 border-b border-theme-border last:border-0">
                               <div className="flex items-center gap-3">
                                  <item.icon className="w-4 h-4 text-theme-text-dim" />
                                  <span className="text-xs text-theme-text-dim">{item.label}</span>
                               </div>
                               <span className="text-xs font-bold text-theme-text-main mono uppercase">{item.value}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === "analysis" && (
                  <div className="grid grid-cols-12 gap-6 pb-32">
                     <div className="col-span-4 space-y-6">
                        <div className="bg-theme-surface/50 border border-theme-border rounded-2xl p-6 glow-card flex flex-col items-center">
                           <span className="mono text-[10px] text-theme-text-dim font-bold uppercase tracking-widest self-start mb-4">Priority_Index_Visual</span>
                           <div className="h-48 w-full">
                             <PriorityGauge score={result?.priority_score || 0} />
                           </div>
                        </div>
                        <div className="bg-theme-surface/50 border border-theme-border rounded-2xl p-6 glow-card flex flex-col">
                           <span className="mono text-[10px] text-theme-text-dim font-bold uppercase tracking-widest mb-4">Feature_Weight_Analysis</span>
                           <div className="h-48 w-full">
                             {result?.feature_importance && <ImportanceChart data={result.feature_importance} />}
                           </div>
                        </div>
                     </div>

                     <div className="col-span-8 bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card flex flex-col">
                        <div className="flex items-center gap-3 mb-8">
                           <Brain className="w-6 h-6 text-theme-accent" />
                           <div>
                             <h3 className="text-lg font-black uppercase tracking-tight">AI Master Reasoning</h3>
                             <p className="mono text-[9px] text-theme-text-dim">Neural_Link_Status: CALIBRATED</p>
                           </div>
                        </div>

                        <div className="flex-1 space-y-6 overflow-y-auto pr-4 scrollbar-hide">
                           <div className="bg-black/40 border border-theme-border p-6 rounded-2xl relative overflow-hidden group">
                              <div className="absolute top-0 left-0 w-1 h-full bg-theme-accent" />
                              <p className="text-base text-theme-text-main italic leading-relaxed">
                                "{result?.reasoning_summary || "Initiate pipeline to generate strategic reasoning matrix..."}"
                              </p>
                              <div className="absolute bottom-2 right-4 flex gap-1 opacity-20 invisible group-hover:visible">
                                 {[...Array(5)].map((_, i) => <div key={i} className="w-1 h-3 bg-theme-accent" />)}
                              </div>
                           </div>

                           <div className="grid grid-cols-3 gap-6">
                              {[
                                { label: "Heuristic Score", value: result?.priority_score || 0, icon: Zap, sub: "Crisis intensity" },
                                { label: "Logical Confidence", value: result ? `${(result.confidence * 100).toFixed(0)}%` : "0%", icon: ShieldCheck, sub: "Match accuracy" },
                                { label: "Data Integrity", value: "Verified", icon: Database, sub: "Checksum PASS" }
                              ].map((item, i) => (
                                <div key={i} className="bg-white/5 border border-theme-border p-4 rounded-xl flex flex-col gap-2">
                                   <item.icon className="w-5 h-5 text-theme-accent" />
                                   <div className="flex flex-col">
                                      <span className="text-xl font-black mono">{item.value}</span>
                                      <span className="mono text-[9px] text-theme-text-dim uppercase tracking-widest">{item.label}</span>
                                      <span className="text-[9px] text-theme-text-dim italic mt-1 opacity-60 tracking-tighter">{item.sub}</span>
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
                )}

                {activeTab === "volunteers" && (
                   <div className="bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card flex flex-col h-full overflow-hidden">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <Users className="w-6 h-6 text-theme-accent" />
                          <div>
                            <h3 className="text-lg font-black uppercase tracking-tight">Personnel Matrix</h3>
                            <p className="mono text-[9px] text-theme-text-dim">Operational_Units: {result?.volunteer_plan?.length || 0} READY</p>
                          </div>
                        </div>
                        <div className="flex border border-theme-border rounded-lg p-1 bg-black/40">
                           <button className="px-3 py-1 bg-theme-accent text-white rounded mono text-[9px] font-black uppercase shadow-inner">All_Units</button>
                           <button className="px-3 py-1 text-theme-text-dim rounded mono text-[9px] font-black uppercase">Medical_Only</button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto scrollbar-hide">
                         <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-theme-border bg-black/30 text-theme-text-dim mono text-[9px] uppercase tracking-[0.2em]">
                                <th className="px-6 py-4 text-left font-bold">Personnel_Name</th>
                                <th className="px-6 py-4 text-left font-bold">NGO_Nexus</th>
                                <th className="px-6 py-4 text-left font-bold">Specialization</th>
                                <th className="px-6 py-4 text-left font-bold">Directive</th>
                                <th className="px-6 py-4 text-center font-bold">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-theme-border/50">
                               {(result?.volunteer_plan || [...Array(4)]).map((v, i) => (
                                 <tr key={i} className="group hover:bg-white/[0.04] transition-all cursor-pointer">
                                   <td className="px-6 py-5">
                                      <div className="flex items-center gap-4">
                                         <div className="w-10 h-10 rounded-xl bg-theme-border flex items-center justify-center mono text-[12px] font-black group-hover:bg-theme-accent group-hover:text-white transition-all shadow-inner">
                                           {v?.name?.charAt(0) || "?"}
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="font-black text-sm tracking-tight">{v?.name || "Awaiting_Match..."}</span>
                                            <span className="mono text-[9px] text-theme-text-dim uppercase tracking-widest">{v ? `Strength: ${v.strength}` : "---"}</span>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="px-6 py-5">
                                      <div className="flex items-center gap-2">
                                         <span className="px-3 py-1 rounded bg-black/60 border border-theme-accent/20 text-theme-accent mono text-[10px] font-black uppercase">
                                            {v?.organization ? `🏥 ${v.organization}` : "---"}
                                         </span>
                                      </div>
                                   </td>
                                   <td className="px-6 py-5">
                                      <span className="mono text-[11px] text-theme-text-main font-bold">{v?.role || "---"}</span>
                                   </td>
                                   <td className="px-6 py-5 max-w-xs">
                                      <p className="text-[11px] text-theme-text-dim leading-relaxed line-clamp-2">
                                         {v?.assigned_task || "Pipeline synchronization pending..."}
                                      </p>
                                   </td>
                                   <td className="px-6 py-5 text-center">
                                      <div className={cn(
                                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mono text-[9px] font-black uppercase transition-all",
                                        v ? "bg-theme-success/10 border-theme-success/30 text-theme-success" : "bg-white/5 border-theme-border text-theme-text-dim"
                                      )}>
                                         <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", v ? "bg-theme-success" : "bg-theme-text-dim")} />
                                         {v ? "Ready" : "Idle"}
                                      </div>
                                   </td>
                                 </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                   </div>
                )}

                {activeTab === "resources" && (
                   <div className="grid grid-cols-12 gap-6 pb-24 overflow-y-auto pr-2 scrollbar-hide">
                     <div className="col-span-12 grid grid-cols-4 gap-6">
                        {[
                          { label: "Medical Supply", color: "#EF4444", value: result?.resource_distribution?.medical_team || 0, icon: Stethoscope },
                          { label: "Food Rations", color: "#F59E0B", value: result?.resource_distribution?.food_supply_team || 0, icon: Utensils },
                          { label: "Rescue Units", color: "#10B981", value: result?.resource_distribution?.rescue_team || 0, icon: Shield },
                          { label: "Logistics Hubs", color: "#3B82F6", value: result?.resource_distribution?.logistics_team || 0, icon: Truck }
                        ].map((stat, i) => (
                           <div key={i} className="bg-theme-surface/30 border border-theme-border p-6 rounded-2xl flex items-center justify-between glow-card group">
                              <div>
                                 <span className="mono text-[10px] text-theme-text-dim uppercase font-bold tracking-widest">{stat.label}</span>
                                 <div className="text-3xl font-black mt-1 group-hover:text-theme-accent transition-colors">{stat.value}%</div>
                              </div>
                              <div className="w-14 h-14 rounded-full flex items-center justify-center border border-theme-border relative">
                                 <stat.icon className="w-6 h-6 text-theme-text-dim group-hover:text-theme-accent transition-all" />
                                 <svg className="absolute inset-0 w-full h-full -rotate-90">
                                   <circle cx="28" cy="28" r="24" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                                   <circle 
                                     cx="28" cy="28" r="24" fill="transparent" stroke={stat.color} strokeWidth="4" 
                                     strokeDasharray={150.8}
                                     strokeDashoffset={150.8 - (150.8 * stat.value) / 100}
                                     className="transition-all duration-1000"
                                   />
                                 </svg>
                              </div>
                           </div>
                        ))}
                     </div>
                     
                      <div className="col-span-8 bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card">
                          <div className="flex items-center justify-between mb-8">
                             <div className="flex items-center gap-3">
                                <TrendingUp className="w-6 h-6 text-theme-accent" />
                                <div>
                                   <h3 className="text-lg font-black uppercase tracking-tight">Supply Chain Forecast</h3>
                                   <p className="mono text-[9px] text-theme-text-dim">Logistics_Projection: T+72H_WINDOW</p>
                                </div>
                             </div>
                             <div className="px-3 py-1 bg-black/40 border border-white/10 rounded-lg mono text-[9px] text-theme-accent font-black">AI_PREDICTOR_V4</div>
                          </div>
                         <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                               <BarChart data={[
                                 { name: 'Med', val: result?.resource_distribution?.medical_team || 0 },
                                 { name: 'Food', val: result?.resource_distribution?.food_supply_team || 0 },
                                 { name: 'Rescue', val: result?.resource_distribution?.rescue_team || 0 },
                                 { name: 'Log', val: result?.resource_distribution?.logistics_team || 0 }
                               ]}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#8E9299', fontSize: 10, fontWeight: 'bold'}} />
                                  <YAxis hide />
                                  <Tooltip 
                                    contentStyle={{backgroundColor: '#151619', border: '1px solid #2A2C32', borderRadius: '8px', fontSize: '10px'}}
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                  />
                                  <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                                     { [0,1,2,3].map((entry, index) => (
                                       <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#FF3D3D' : '#FF3D3D80'} />
                                     ))}
                                  </Bar>
                               </BarChart>
                            </ResponsiveContainer>
                         </div>
                     </div>

                      <div className="col-span-4 bg-theme-surface/50 border border-theme-border rounded-2xl p-6 glow-card flex flex-col">
                          <div className="flex items-center gap-2 mb-6">
                             <Maximize2 className="w-4 h-4 text-theme-accent" />
                             <span className="mono text-[10px] text-theme-text-dim uppercase font-bold tracking-widest">Resource_Scatter_Matrix</span>
                          </div>
                          <div className="h-64 w-full">
                             <TacticalScatterPlot seed={result?.location} />
                          </div>
                          <p className="mono text-[8px] text-theme-text-dim mt-4 uppercase leading-relaxed font-bold">
                             Spatial mapping of supply density vs mobilization distance. Multi-factor AI analysis active.
                          </p>
                      </div>

                      <div className="col-span-12 grid grid-cols-4 gap-6">
                         <div className="col-span-2 bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card">
                            <div className="flex items-center gap-3 mb-6">
                               <Cpu className="w-5 h-5 text-theme-accent" />
                               <span className="mono text-[10px] text-theme-text-dim uppercase font-bold tracking-widest">Neural_Aura_Logistics</span>
                            </div>
                            <div className="h-64 w-full">
                               <NeuralMeshVisualizer />
                            </div>
                         </div>
                         <div className="col-span-1 bg-theme-surface/50 border border-theme-border rounded-2xl overflow-hidden glow-card group relative">
                            <img 
                              src="https://picsum.photos/seed/logistics/600/800?grayscale" 
                              className="w-full h-full object-cover opacity-50 transition-transform duration-700 group-hover:scale-110" 
                              referrerPolicy="no-referrer"
                              alt="Logistics Sat"
                            />
                            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black to-transparent">
                               <span className="mono text-[8px] text-white font-black uppercase tracking-widest border-b border-theme-accent pb-1">UAV_Feed::Sector_Red</span>
                            </div>
                         </div>
                         <div className="col-span-1 bg-theme-surface/50 border border-theme-border rounded-2xl overflow-hidden glow-card group relative">
                            <img 
                              src="https://picsum.photos/seed/satellite/600/800?blur=1" 
                              className="w-full h-full object-cover opacity-40 transition-transform duration-700 group-hover:scale-110" 
                              referrerPolicy="no-referrer"
                              alt="Sat Vis"
                            />
                            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black to-transparent">
                               <span className="mono text-[8px] text-white font-black uppercase tracking-widest border-b border-theme-accent pb-1">Sat_Link::Vector_Sync</span>
                            </div>
                         </div>
                      </div>

                      <div className="col-span-4 bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card">
                          <span className="mono text-[10px] text-theme-text-dim uppercase font-bold tracking-widest mb-6 block border-l-2 border-theme-accent pl-2">ML_Sentiment_Analysis</span>
                          <div className="space-y-4">
                             {[
                               { label: "Community Urgency", val: 88 },
                               { label: "Infrastructure Load", val: 42 },
                               { label: "Transit Integrity", val: 65 }
                             ].map((m, i) => (
                               <div key={i} className="space-y-1">
                                  <div className="flex justify-between mono text-[8px] uppercase font-bold">
                                     <span className="text-theme-text-dim">{m.label}</span>
                                     <span className="text-theme-accent">{m.val}%</span>
                                  </div>
                                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                     <motion.div 
                                       initial={{ width: 0 }}
                                       animate={{ width: `${m.val}%` }}
                                       className="h-full bg-theme-accent"
                                     />
                                  </div>
                               </div>
                             ))}
                          </div>
                      </div>

                      <div className="col-span-8 bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card group relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                             <Settings className="w-24 h-24 animate-spin-slow rotate-45" />
                          </div>
                          <div className="flex items-center gap-3 mb-6">
                             <Layers className="w-5 h-5 text-theme-accent" />
                             <span className="mono text-[10px] text-theme-text-dim uppercase font-bold tracking-widest">Synthetic_Projection_Sync</span>
                          </div>
                          <div className="h-48 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={[
                                  { time: 'T-24', load: 30, capacity: 50 },
                                  { time: 'T-12', load: 45, capacity: 55 },
                                  { time: 'T-0', load: 70, capacity: 60 },
                                  { time: 'T+12', load: 85, capacity: 75 },
                                  { time: 'T+24', load: 95, capacity: 85 },
                                ]}>
                                   <defs>
                                      <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="5%" stopColor="#FF3D3D" stopOpacity={0.3}/>
                                         <stop offset="95%" stopColor="#FF3D3D" stopOpacity={0}/>
                                      </linearGradient>
                                   </defs>
                                   <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                   <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#71717A', fontSize: 8}} />
                                   <YAxis hide />
                                   <Tooltip contentStyle={{backgroundColor: '#0C0C0E', border: '1px solid #1F1F23', borderRadius: '8px', fontSize: '10px'}} />
                                   <Area type="monotone" dataKey="load" stroke="#FF3D3D" fillOpacity={1} fill="url(#colorLoad)" />
                                   <Line type="monotone" dataKey="capacity" stroke="#3B82F6" strokeDasharray="5 5" dot={false} />
                                </AreaChart>
                             </ResponsiveContainer>
                          </div>
                          <p className="mono text-[9px] text-theme-text-dim mt-4 uppercase tracking-tighter">
                             Predicted workload shift based on incoming sensor reports. Blue-dash indicates emergency overhead limit.
                          </p>
                      </div>

                      <div className="col-span-12 grid grid-cols-3 gap-6">
                         <div className="col-span-1 bg-theme-surface/50 border border-theme-border rounded-2xl p-6 glow-card">
                             <div className="flex items-center gap-2 mb-6">
                                <BarChart2 className="w-4 h-4 text-theme-accent" />
                                <span className="mono text-[10px] text-theme-text-dim uppercase font-bold tracking-widest">Sector_Load_Balance</span>
                             </div>
                             <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                   <BarChart data={[
                                      { name: 'SEC_A', active: 4000, standBy: 2400 },
                                      { name: 'SEC_B', active: 3000, standBy: 1398 },
                                      { name: 'SEC_C', active: 2000, standBy: 3800 },
                                      { name: 'SEC_D', active: 2780, standBy: 3908 },
                                   ]} layout="vertical">
                                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                                      <XAxis type="number" hide />
                                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#71717A', fontSize: 8}} />
                                      <Tooltip contentStyle={{backgroundColor: '#0C0C0E', border: 'none', borderRadius: '4px'}} />
                                      <Bar dataKey="active" stackId="a" fill="#FF3D3D" radius={[0, 0, 0, 0]} />
                                      <Bar dataKey="standBy" stackId="a" fill="#FF3D3D33" radius={[0, 4, 4, 0]} />
                                   </BarChart>
                                </ResponsiveContainer>
                             </div>
                             <div className="mt-4 flex gap-4">
                                <div className="flex items-center gap-1">
                                   <div className="w-2 h-2 bg-theme-accent rounded-sm" />
                                   <span className="mono text-[7px] text-theme-text-dim uppercase">Active_Deployment</span>
                                </div>
                                <div className="flex items-center gap-1">
                                   <div className="w-2 h-2 bg-theme-accent/20 rounded-sm" />
                                   <span className="mono text-[7px] text-theme-text-dim uppercase">Standby_Reserve</span>
                                </div>
                             </div>
                         </div>

                         <div className="col-span-2 bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card">
                             <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                   <Activity className="w-5 h-5 text-theme-accent" />
                                   <span className="mono text-[10px] text-theme-text-dim uppercase font-bold tracking-widest">Global_Efficiency_Index</span>
                                </div>
                                <div className="px-2 py-1 border border-theme-accent/20 rounded mono text-[8px] text-theme-accent">REAL_TIME_STREAM</div>
                             </div>
                             <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                   <BarChart data={[
                                      { name: 'W1', efficiency: 85, latency: 20 },
                                      { name: 'W2', efficiency: 72, latency: 45 },
                                      { name: 'W3', efficiency: 91, latency: 15 },
                                      { name: 'W4', efficiency: 64, latency: 60 },
                                      { name: 'W5', efficiency: 88, latency: 30 },
                                      { name: 'W6', efficiency: 95, latency: 10 },
                                   ]}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717A', fontSize: 8}} />
                                      <YAxis hide />
                                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#0C0C0E', border: '1px solid #ffffff10'}} />
                                      <Legend iconType="circle" wrapperStyle={{fontSize: '8px', textTransform: 'uppercase', fontFamily: 'monospace', paddingTop: '20px'}} />
                                      <Bar name="Processing_Efficiency" dataKey="efficiency" fill="#FF3D3D" radius={[4, 4, 0, 0]} />
                                      <Bar name="Network_Latency" dataKey="latency" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                   </BarChart>
                                </ResponsiveContainer>
                             </div>
                         </div>
                      </div>
                  </div>
                )}

                {activeTab === "heatmap" && (
                  <div className="h-full flex flex-col bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card">
                     <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                           <Globe2 className="w-6 h-6 text-theme-accent" />
                           <div>
                              <h3 className="text-lg font-black uppercase tracking-tight">Regional Heatmap Matrix</h3>
                              <p className="mono text-[9px] text-theme-text-dim">Spectral_Overlay: ACTIVE</p>
                           </div>
                        </div>
                     </div>
                     <div className="flex-1 w-full bg-black/40 rounded-xl border border-theme-border min-h-[400px]">
                        {result && <HeatmapOverlay lat={result.lat} lng={result.lng} />}
                     </div>
                  </div>
                )}

                {activeTab === "chat" && (
                  <div className="h-full flex flex-col bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card overflow-hidden">
                     <div className="flex items-center gap-3 mb-8">
                        <Bot className="w-6 h-6 text-theme-accent" />
                        <div>
                           <h3 className="text-lg font-black uppercase tracking-tight">Mission Advisor AI</h3>
                           <p className="mono text-[9px] text-theme-text-dim">Secure_Comms_Band: ENCRYPTED</p>
                        </div>
                     </div>
                     
                     <div ref={scrollChatRef} className="flex-1 overflow-y-auto space-y-4 mb-6 pr-4 scrollbar-hide">
                        {chatHistory.length === 0 && (
                           <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                              <MessageSquare className="w-12 h-12 mb-4" />
                              <p className="mono text-[10px] uppercase tracking-widest">Awaiting initial query...</p>
                           </div>
                        )}
                        {chatHistory.map((msg, i) => (
                           <div key={i} className={cn("flex flex-col gap-2 max-w-[80%]", msg.role === "user" ? "ml-auto items-end" : "items-start")}>
                              <div className="flex items-center gap-2">
                                 <span className="mono text-[9px] font-black uppercase tracking-widest text-theme-text-dim">{msg.role}</span>
                              </div>
                              <div className={cn(
                                 "px-4 py-3 rounded-2xl text-[13px] leading-relaxed",
                                 msg.role === "user" ? "bg-theme-accent text-white" : "bg-white/5 border border-theme-border text-theme-text-main"
                              )}>
                                 {msg.content}
                              </div>
                           </div>
                        ))}
                        {isChatLoading && (
                           <div className="flex items-start gap-2 max-w-[80%]">
                              <div className="bg-white/5 border border-theme-border p-3 rounded-2xl">
                                 <Loader2 className="w-4 h-4 animate-spin text-theme-accent" />
                              </div>
                           </div>
                        )}
                     </div>

                     <div className="flex gap-4 p-2 bg-black/40 border border-theme-border rounded-2xl">
                        <input
                           value={chatInput}
                           onChange={(e) => setChatInput(e.target.value)}
                           onKeyDown={(e) => e.key === "Enter" && handleChat()}
                           placeholder="Type tactical query for AI Advisor..."
                           className="flex-1 bg-transparent border-none focus:outline-none p-3 text-sm mono"
                        />
                        <button 
                           onClick={handleChat}
                           disabled={isChatLoading || !chatInput.trim()}
                           className="w-12 h-12 bg-theme-accent text-white rounded-xl flex items-center justify-center hover:shadow-[0_0_20px_rgba(255,61,61,0.4)] transition-all disabled:opacity-20"
                        >
                           <Send className="w-5 h-5" />
                        </button>
                     </div>
                  </div>
                )}
                {activeTab === "pipeline" && (
                  <div className="h-full flex flex-col bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card overflow-hidden relative">
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                       <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--theme-accent)_0,_transparent_70%)]" />
                    </div>
                    
                    <div className="flex items-center gap-3 mb-12 relative z-10">
                       <Workflow className="w-6 h-6 text-theme-accent" />
                       <div>
                         <h3 className="text-lg font-black uppercase tracking-tight">AI Agent Pipeline Topology</h3>
                         <p className="mono text-[9px] text-theme-text-dim">Network_Sync: {loading ? "TRANSMITTING" : "STABLE"}</p>
                       </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center relative z-10">
                       <div className="flex items-center gap-12 w-full max-w-4xl px-8">
                          {steps.map((step, idx) => (
                             <React.Fragment key={idx}>
                                <div className="flex flex-col items-center gap-4 flex-1">
                                   <div className={cn(
                                     "w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 relative bg-black/60",
                                     step.status === "completed" ? "border-theme-success text-theme-success shadow-[0_0_20px_rgba(34,197,94,0.3)]" :
                                     step.status === "running" ? "border-theme-accent text-theme-accent animate-pulse shadow-[0_0_30px_rgba(255,61,61,0.4)]" :
                                     "border-theme-border text-theme-text-dim opacity-40"
                                   )}>
                                      {step.status === "completed" ? <CheckCircle2 className="w-8 h-8" /> : 
                                       step.status === "running" ? <Loader2 className="w-8 h-8 animate-spin" /> :
                                       <Cpu className="w-8 h-8 opacity-40" />}
                                      
                                      {step.status === "running" && (
                                        <div className="absolute -inset-2 border border-theme-accent rounded-2xl animate-ping opacity-20" />
                                      )}
                                   </div>
                                   <div className="flex flex-col items-center">
                                      <span className={cn(
                                        "mono text-[10px] font-black uppercase tracking-tighter",
                                        step.status !== "idle" ? "text-theme-text-main" : "text-theme-text-dim"
                                      )}>{step.label}</span>
                                      {step.latency && <span className="mono text-[8px] text-theme-success mt-1">{step.latency}ms</span>}
                                   </div>
                                </div>
                                {idx < steps.length - 1 && (
                                  <div className="h-0.5 flex-1 bg-theme-border relative mb-6">
                                     {steps[idx].status === "completed" && (
                                       <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} className="h-full bg-theme-success" />
                                     )}
                                     {steps[idx].status === "running" && (
                                       <motion.div animate={{ x: ["-100%", "100%"] }} transition={{ repeat: Infinity, duration: 2 }} className="h-full w-4 bg-theme-accent blur-sm" />
                                     )}
                                  </div>
                                )}
                             </React.Fragment>
                          ))}
                       </div>
                       
                       <div className="mt-20 w-fit">
                          <StatusTerminal logs={logs} />
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === "report" && (
                   <div className="flex flex-col h-full bg-theme-surface/50 border border-theme-border rounded-2xl p-8 glow-card overflow-hidden">
                      <div className="flex items-center justify-between mb-8">
                         <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6 text-theme-accent" />
                            <div>
                               <h3 className="text-lg font-black uppercase tracking-tight">Mission Dossier Output</h3>
                               <p className="mono text-[9px] text-theme-text-dim">Format: MACHINE_STRICT_JSON</p>
                            </div>
                         </div>
                         <div className="flex gap-2">
                            <button onClick={downloadPDF} disabled={!result} className="px-4 py-2 bg-theme-accent text-white rounded-lg mono text-[10px] font-black uppercase flex items-center gap-2 hover:shadow-[0_0_20px_rgba(255,61,61,0.4)] transition-all">
                               <Download className="w-3 h-3" /> Dossier.PDF
                            </button>
                         </div>
                      </div>

                      <div className="flex-1 bg-black/60 border border-theme-border rounded-2xl overflow-hidden p-6 relative font-mono text-[12px] text-theme-text-main/80 overflow-y-auto scrollbar-hide">
                         <div className="absolute top-4 right-6 mono text-[10px] text-theme-accent animate-pulse">LIVE_VIEW_MODE</div>
                         <pre className="whitespace-pre-wrap">
                            {result ? JSON.stringify(result, null, 2) : "// Await mission results for JSON schema enrichment..."}
                         </pre>
                      </div>
                   </div>
                )}

                {activeTab === "download" && (
                   <div className="h-full flex flex-col items-center justify-center bg-theme-surface/50 border border-theme-border rounded-2xl p-12 glow-card text-center">
                      <div className="w-24 h-24 bg-theme-accent/10 border border-theme-accent/20 rounded-full flex items-center justify-center mb-8 relative">
                         <DownloadCloud className="w-10 h-10 text-theme-accent" />
                         <motion.div 
                           animate={{ scale: [1, 1.2, 1] }} 
                           transition={{ repeat: Infinity, duration: 4 }} 
                           className="absolute -inset-4 border border-theme-accent/10 rounded-full" 
                         />
                      </div>
                      <h2 className="text-3xl font-black uppercase tracking-tight mb-4">Export Command Center</h2>
                      <p className="text-theme-text-dim max-w-md mb-12">
                         Generate authenticated disaster response dossiers for field personnel. These reports contain all AI-generated strategic matchings and resource matrices.
                      </p>

                      <div className="flex flex-col gap-4 w-full max-w-sm">
                         <button 
                           onClick={downloadPDF}
                           disabled={!result}
                           className="w-full px-8 py-4 bg-theme-accent text-white rounded-xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(255,61,61,0.5)] transition-all disabled:opacity-20"
                         >
                            <FileText className="w-5 h-5" />
                            Download Mission Report (.PDF)
                         </button>
                         <button 
                           onClick={() => {
                             if (!result) return;
                             const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
                             const downloadAnchorNode = document.createElement('a');
                             downloadAnchorNode.setAttribute("href",     dataStr);
                             downloadAnchorNode.setAttribute("download", `aidflow_intel_${result.location}.json`);
                             document.body.appendChild(downloadAnchorNode);
                             downloadAnchorNode.click();
                             downloadAnchorNode.remove();
                           }}
                           disabled={!result}
                           className="w-full px-8 py-4 bg-theme-surface border border-theme-border text-theme-text-main rounded-xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white/5 transition-all disabled:opacity-20"
                         >
                            <Database className="w-5 h-5" />
                            Download Data Stream (.JSON)
                         </button>
                      </div>
                   </div>
                )}
             </motion.div>
           </AnimatePresence>
         </div>

       </main>
      </div>

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
      {/* Global Data Stream Marquee */}
      <footer className="h-8 bg-black border-t border-theme-border flex items-center overflow-hidden mono text-[9px] relative z-50 shrink-0">
         <div className="bg-theme-accent px-4 h-full flex items-center text-white font-black uppercase tracking-tighter whitespace-nowrap border-r border-theme-border shadow-[5px_0_15px_rgba(255,61,61,0.3)]">
            Live_Intel_Stream
         </div>
         <div className="flex-1 flex items-center whitespace-nowrap overflow-hidden">
            <motion.div 
               animate={{ x: [0, -1500] }}
               transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
               className="flex gap-12 text-theme-text-dim/60 font-bold"
            >
               {[...Array(8)].map((_, i) => (
                  <span key={i} className="flex gap-12 items-center">
                     <span>| UPLINK_STABLE_PORT_8080 | SIGNAL_STRENGTH: 98.4% | LATENCY: 12.8ms | SECTOR_LOCK: {result?.location || "STANDBY"} | AI_KERNAL_STATUS: NOMINAL |</span>
                     <span className="text-theme-accent brightness-125">SIGNAL_LOCK_ACQUIRED [{(result?.confidence || 0) * 100}%]</span>
                     <span>| SCANNING_FOR_LIFE_SIGNATURES... | NGO_HIVE: {result?.volunteer_plan?.[0]?.organization || "READY"} | TIMESTAMP: {new Date().toISOString()} |</span>
                  </span>
               ))}
            </motion.div>
         </div>
         <div className="bg-white/5 px-4 h-full flex items-center text-theme-text-dim border-l border-theme-border font-black text-[8px] uppercase tracking-tighter">
            Aidflow_v2.0_Secure_Relay
         </div>
      </footer>
    </div>
  );
}
