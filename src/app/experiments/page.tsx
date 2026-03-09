"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const LOGO_PATH =
  "M36.3813 253V16H219.618V173.41H89.6223V69.6509H165.507V121.235H128.533";
const STROKE_COLOR = "#E4BD89";
const STROKE_WIDTH = 27;

interface Config {
  duration: number;
  retractPercent: number;
  holdFullMs: number;
  holdRetractedMs: number;
  easing: string;
  strokeWidth: number;
  logoSize: number;
  direction: "inward" | "outward";
  startRetracted: boolean;
}

const DEFAULT_CONFIG: Config = {
  duration: 2000,
  retractPercent: 100,
  holdFullMs: 0,
  holdRetractedMs: 0,
  easing: "ease-in-out",
  strokeWidth: STROKE_WIDTH,
  logoSize: 128,
  direction: "inward",
  startRetracted: false,
};

const PRESET_A: Config = {
  duration: 4400,
  retractPercent: 100,
  holdFullMs: 850,
  holdRetractedMs: 1300,
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  strokeWidth: 27,
  logoSize: 128,
  direction: "inward",
  startRetracted: false,
};


const PRESET_C: Config = {
  duration: 8000,
  retractPercent: 100,
  holdFullMs: 2350,
  holdRetractedMs: 1300,
  easing: "linear",
  strokeWidth: 27,
  logoSize: 128,
  direction: "outward",
  startRetracted: true,
};

const EASING_OPTIONS = [
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "cubic-bezier(0.4, 0, 0.2, 1)",
  "cubic-bezier(0.22, 1, 0.36, 1)",
  "cubic-bezier(0.65, 0, 0.35, 1)",
];

const EASING_LABELS: Record<string, string> = {
  "linear": "Linear",
  "ease": "Ease",
  "ease-in": "Ease In",
  "ease-out": "Ease Out",
  "ease-in-out": "Ease In-Out",
  "cubic-bezier(0.4, 0, 0.2, 1)": "Material (ease-out)",
  "cubic-bezier(0.22, 1, 0.36, 1)": "Expo Out",
  "cubic-bezier(0.65, 0, 0.35, 1)": "Circ In-Out",
};

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="w-16 bg-zinc-800 text-zinc-400 text-xs font-mono text-right rounded px-1.5 py-0.5 border border-zinc-700 focus:outline-none focus:border-zinc-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-500/80 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer"
      />
    </div>
  );
}

const LOGOTYPE_SINGLE_PATH =
  "M145.152 165.235H182.126V113.651H106.241V217.41H236.237V60H53V271.749H289.5V233V60H472.737V217.41H342.741V113.651H418.626V165.235H391.5V271.749H527V60H710.237V217.41H580.241V165.235V113.651H656.126V165.235V271.749H947.5V60.0001H764.5V217.41H894.328V113.651H818.541V165.235H855.467";

const LOGOTYPE_SINGLE_PATH_2 =
  "M145.152 165.235H182.126V113.651H106.241V217.41H236.237V60H53V271.749H289.5V233V60H472.737V217.41H342.741V113.651H418.626V165.235H391.5V271.749H527V60H688.111V217.41H580.241V165.235V113.651H634V165.235V271.749H925.374V60.0001H742.374V217.41H872.202V113.651H796.415V165.235H833.342";

const LOGOTYPE_SEPARATE_PATH =
  "M55 317.501V80.5006H238.237V237.911H108.241V134.152H184.126V185.736H147.152M291.5 253.501V80.5006H474.737V237.911H344.741V134.152H420.626V185.736H383.652M949.5 317.501V80.5007H766.5V237.911H896.328V134.152H820.541V185.736H857.467M529 237.911V80.5006H712.237V237.911H529ZM582.241 134.152H658.126V185.736H582.241V134.152Z";

function LogoAnimation({
  config,
  selected,
  onClick,
  label,
  svgPath = LOGO_PATH,
  viewBox = "0 0 256 256",
  aspectRatio,
}: {
  config: Config;
  selected: boolean;
  onClick: () => void;
  label: string;
  svgPath?: string;
  viewBox?: string;
  aspectRatio?: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const animRef = useRef<Animation | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    const totalLength = path.getTotalLength();
    path.style.strokeDasharray = `${totalLength}`;
    path.style.strokeDashoffset = "0";

    if (animRef.current) animRef.current.cancel();

    const retractOffset = totalLength * (config.retractPercent / 100);
    const sign = config.direction === "inward" ? -1 : 1;
    const target = `${sign * retractOffset}`;

    const totalTime =
      config.duration + config.holdFullMs + config.holdRetractedMs;
    const animDuration = config.duration / 2;
    const holdFullFrac = config.holdFullMs / totalTime;
    const retractFrac = animDuration / totalTime;
    const holdRetractedFrac = config.holdRetractedMs / totalTime;

    const t1 = holdFullFrac;
    const t2 = t1 + retractFrac;
    const t3 = t2 + holdRetractedFrac;

    // When startRetracted, the resting state is retracted and it extends out then back
    const from = config.startRetracted ? target : "0";
    const to = config.startRetracted ? "0" : target;
    const holdFirstFrac = config.startRetracted ? config.holdRetractedMs / totalTime : config.holdFullMs / totalTime;
    const holdSecondFrac = config.startRetracted ? config.holdFullMs / totalTime : config.holdRetractedMs / totalTime;

    const s1 = holdFirstFrac;
    const s2 = s1 + retractFrac;
    const s3 = s2 + holdSecondFrac;

    const keyframes: Keyframe[] = [
      { strokeDashoffset: from, offset: 0, easing: config.easing },
      ...(holdFirstFrac > 0
        ? [{ strokeDashoffset: from, offset: s1, easing: config.easing }]
        : []),
      { strokeDashoffset: to, offset: s2, easing: config.easing },
      ...(holdSecondFrac > 0
        ? [{ strokeDashoffset: to, offset: s3, easing: config.easing }]
        : []),
      { strokeDashoffset: from, offset: 1 },
    ];

    const animation = path.animate(keyframes, {
      duration: totalTime,
      iterations: Infinity,
    });

    animRef.current = animation;
    return () => animation.cancel();
  }, [config]);

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center gap-4 cursor-pointer rounded-xl p-6 transition-all ${
        selected
          ? "ring-1 ring-amber-500/40 bg-zinc-900/50"
          : "hover:bg-zinc-900/30"
      }`}
    >
      <span className="text-zinc-500 text-xs uppercase tracking-wider">
        {label}
      </span>
      <svg
        width={aspectRatio ? config.logoSize * aspectRatio : config.logoSize}
        height={config.logoSize}
        viewBox={viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          ref={pathRef}
          d={svgPath}
          stroke={STROKE_COLOR}
          strokeWidth={config.strokeWidth}
        />
      </svg>
    </div>
  );
}

const ALL_GLITCH_COLORS: { color: string; label: string; key: string }[] = [
  { color: "#E4BD89", label: "Bronze", key: "bronze" },
  { color: "#5b83b0", label: "Lazuli", key: "lazuli" },
  { color: "#6a9a58", label: "Emerald", key: "emerald" },
  { color: "#b35a5a", label: "Crimson", key: "crimson" },
  { color: "#c9a84c", label: "Gold", key: "gold" },
  { color: "#ffffff", label: "White", key: "white" },
];

interface GlitchConfig extends Config {
  glitchRate: number; // ms between color changes
  glitchJitterX: number; // max horizontal jitter px
  glitchJitterY: number; // max vertical jitter px
  glitchOpacityMin: number; // min opacity during glitch (0-100)
  glitchOpacityMax: number; // max opacity during glitch (0-100)
  glitchColors: string[]; // which colors to cycle through
  glitchOnlyDuringHold: boolean; // glitch only during hold-at-full
}

const DEFAULT_GLITCH_CONFIG: GlitchConfig = {
  duration: 8000,
  retractPercent: 100,
  holdFullMs: 2350,
  holdRetractedMs: 1300,
  easing: "linear",
  strokeWidth: 27,
  logoSize: 128,
  direction: "outward",
  startRetracted: true,
  glitchRate: 84,
  glitchJitterX: 9,
  glitchJitterY: 9.5,
  glitchOpacityMin: 2,
  glitchOpacityMax: 19,
  glitchColors: ALL_GLITCH_COLORS.map((c) => c.color),
  glitchOnlyDuringHold: false,
};

function GlitchAnimation({
  config,
  selected,
  onClick,
  label,
  svgPath = LOGO_PATH,
  viewBox = "0 0 256 256",
  aspectRatio,
}: {
  config: GlitchConfig;
  selected: boolean;
  onClick: () => void;
  label: string;
  svgPath?: string;
  viewBox?: string;
  aspectRatio?: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<Animation | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    const svg = svgRef.current;
    if (!path || !svg) return;

    const totalLength = path.getTotalLength();
    path.style.strokeDasharray = `${totalLength}`;
    path.style.strokeDashoffset = "0";

    if (animRef.current) animRef.current.cancel();

    const retractOffset = totalLength * (config.retractPercent / 100);
    const sign = config.direction === "inward" ? -1 : 1;
    const target = `${sign * retractOffset}`;

    const totalTime =
      config.duration + config.holdFullMs + config.holdRetractedMs;
    const animDuration = config.duration / 2;
    const retractFrac = animDuration / totalTime;

    const from = config.startRetracted ? target : "0";
    const to = config.startRetracted ? "0" : target;
    const holdFirstFrac = config.startRetracted
      ? config.holdRetractedMs / totalTime
      : config.holdFullMs / totalTime;
    const holdSecondFrac = config.startRetracted
      ? config.holdFullMs / totalTime
      : config.holdRetractedMs / totalTime;

    const s1 = holdFirstFrac;
    const s2 = s1 + retractFrac;
    const s3 = s2 + holdSecondFrac;

    let glitchStart: number, glitchEnd: number;
    if (config.startRetracted) {
      glitchStart = s2;
      glitchEnd = s3;
    } else {
      glitchStart = 0;
      glitchEnd = s1;
    }

    const keyframes: Keyframe[] = [
      { strokeDashoffset: from, offset: 0, easing: config.easing },
      ...(holdFirstFrac > 0
        ? [{ strokeDashoffset: from, offset: s1, easing: config.easing }]
        : []),
      { strokeDashoffset: to, offset: s2, easing: config.easing },
      ...(holdSecondFrac > 0
        ? [{ strokeDashoffset: to, offset: s3, easing: config.easing }]
        : []),
      { strokeDashoffset: from, offset: 1 },
    ];

    const animation = path.animate(keyframes, {
      duration: totalTime,
      iterations: Infinity,
    });

    animRef.current = animation;

    const colors = config.glitchColors.length > 0 ? config.glitchColors : [STROKE_COLOR];

    const glitchInterval = setInterval(() => {
      const anim = animRef.current;
      if (!anim || anim.currentTime == null) return;

      const progress =
        ((anim.currentTime as number) % totalTime) / totalTime;

      const inHold = glitchEnd > glitchStart
        ? progress >= glitchStart && progress <= glitchEnd
        : progress >= glitchStart || progress <= glitchEnd;

      if (!config.glitchOnlyDuringHold || inHold) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        path.style.stroke = color;
        const jx = (Math.random() - 0.5) * config.glitchJitterX * 2;
        const jy = (Math.random() - 0.5) * config.glitchJitterY * 2;
        svg.style.transform = `translate(${jx}px, ${jy}px)`;
        const oMin = config.glitchOpacityMin / 100;
        const oMax = config.glitchOpacityMax / 100;
        const opacity = oMin + Math.random() * (oMax - oMin);
        svg.style.opacity = `${opacity}`;
      } else {
        path.style.stroke = STROKE_COLOR;
        svg.style.transform = "";
        svg.style.opacity = "1";
      }
    }, config.glitchRate);

    return () => {
      clearInterval(glitchInterval);
      animation.cancel();
    };
  }, [config]);

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center gap-4 cursor-pointer rounded-xl p-6 transition-all ${
        selected
          ? "ring-1 ring-amber-500/40 bg-zinc-900/50"
          : "hover:bg-zinc-900/30"
      }`}
    >
      <span className="text-zinc-500 text-xs uppercase tracking-wider">
        {label}
      </span>
      <svg
        ref={svgRef}
        width={aspectRatio ? config.logoSize * aspectRatio : config.logoSize}
        height={config.logoSize}
        viewBox={viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          ref={pathRef}
          d={svgPath}
          stroke={STROKE_COLOR}
          strokeWidth={config.strokeWidth}
        />
      </svg>
    </div>
  );
}

function GlitchConfigPanel({
  config,
  onChange,
  onExport,
  onReset,
  label,
  inline = false,
}: {
  config: GlitchConfig;
  onChange: <K extends keyof GlitchConfig>(key: K, value: GlitchConfig[K]) => void;
  onExport: () => void;
  onReset: () => void;
  label: string;
  inline?: boolean;
}) {
  return (
    <div className={inline
      ? "w-full border border-zinc-800 rounded-lg p-5 flex flex-col gap-5"
      : "w-72 border-r border-zinc-800 p-5 flex flex-col gap-5 overflow-y-auto shrink-0"
    }>
      <h2 className="text-zinc-300 text-xs font-semibold uppercase tracking-wider">
        {label} Config
      </h2>

      {/* --- Animation controls --- */}
      <div className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">Animation</div>

      <Slider label="Duration" value={config.duration} onChange={(v) => onChange("duration", v)} min={200} max={8000} step={100} unit="ms" />
      <Slider label="Retract %" value={config.retractPercent} onChange={(v) => onChange("retractPercent", v)} min={1} max={100} step={0.5} unit="%" />
      <Slider label="Hold at full" value={config.holdFullMs} onChange={(v) => onChange("holdFullMs", v)} min={0} max={5000} step={50} unit="ms" />
      <Slider label="Hold at retracted" value={config.holdRetractedMs} onChange={(v) => onChange("holdRetractedMs", v)} min={0} max={5000} step={50} unit="ms" />

      <div className="flex flex-col gap-1">
        <span className="text-zinc-400 text-xs">Easing</span>
        <select value={config.easing} onChange={(e) => onChange("easing", e.target.value)} className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 focus:outline-none focus:border-zinc-500">
          {EASING_OPTIONS.map((e) => (
            <option key={e} value={e}>{EASING_LABELS[e] || e}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-zinc-400 text-xs">Direction</span>
        <select value={config.direction} onChange={(e) => onChange("direction", e.target.value as "inward" | "outward")} className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 focus:outline-none focus:border-zinc-500">
          <option value="inward">Shrink from center</option>
          <option value="outward">Shrink from outside</option>
        </select>
      </div>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-zinc-400 text-xs">Start retracted</span>
        <button onClick={() => onChange("startRetracted", !config.startRetracted)} className={`w-8 h-4 rounded-full transition-colors relative ${config.startRetracted ? "bg-amber-500/80" : "bg-zinc-700"}`}>
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${config.startRetracted ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </label>

      <Slider label="Stroke width" value={config.strokeWidth} onChange={(v) => onChange("strokeWidth", v)} min={5} max={50} step={1} />
      <Slider label="Logo size" value={config.logoSize} onChange={(v) => onChange("logoSize", v)} min={32} max={512} step={8} unit="px" />

      {/* --- Glitch controls --- */}
      <div className="text-zinc-500 text-[10px] uppercase tracking-widest mt-3 pt-3 border-t border-zinc-800">Glitch</div>

      <Slider label="Glitch rate" value={config.glitchRate} onChange={(v) => onChange("glitchRate", v)} min={16} max={500} step={1} unit="ms" />
      <Slider label="Jitter X" value={config.glitchJitterX} onChange={(v) => onChange("glitchJitterX", v)} min={0} max={30} step={0.5} unit="px" />
      <Slider label="Jitter Y" value={config.glitchJitterY} onChange={(v) => onChange("glitchJitterY", v)} min={0} max={30} step={0.5} unit="px" />
      <Slider label="Opacity min" value={config.glitchOpacityMin} onChange={(v) => onChange("glitchOpacityMin", v)} min={0} max={100} step={1} unit="%" />
      <Slider label="Opacity max" value={config.glitchOpacityMax} onChange={(v) => onChange("glitchOpacityMax", v)} min={0} max={100} step={1} unit="%" />

      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-zinc-400 text-xs">Only during hold</span>
        <button onClick={() => onChange("glitchOnlyDuringHold", !config.glitchOnlyDuringHold)} className={`w-8 h-4 rounded-full transition-colors relative ${config.glitchOnlyDuringHold ? "bg-amber-500/80" : "bg-zinc-700"}`}>
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${config.glitchOnlyDuringHold ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </label>

      {/* --- Color picker --- */}
      <div className="text-zinc-500 text-[10px] uppercase tracking-widest mt-3 pt-3 border-t border-zinc-800">Colors</div>

      <div className="flex flex-col gap-2">
        {ALL_GLITCH_COLORS.map(({ color, label: colorLabel, key }) => {
          const active = config.glitchColors.includes(color);
          return (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <button
                onClick={() => {
                  const next = active
                    ? config.glitchColors.filter((c) => c !== color)
                    : [...config.glitchColors, color];
                  onChange("glitchColors", next);
                }}
                className={`w-4 h-4 rounded border transition-colors ${active ? "border-transparent" : "border-zinc-600 bg-zinc-800"}`}
                style={active ? { backgroundColor: color } : undefined}
              />
              <span className="text-zinc-400 text-xs">{colorLabel}</span>
              <span className="text-zinc-600 text-[10px] font-mono ml-auto">{color}</span>
            </label>
          );
        })}
      </div>

      <div className="mt-auto pt-4 border-t border-zinc-800 flex flex-col gap-2">
        <button onClick={onExport} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded px-3 py-2 transition-colors">
          Copy config to clipboard
        </button>
        <button onClick={onReset} className="w-full text-zinc-500 hover:text-zinc-400 text-xs rounded px-3 py-2 transition-colors">
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function ConfigPanel({
  config,
  onChange,
  onExport,
  onReset,
  label,
}: {
  config: Config;
  onChange: <K extends keyof Config>(key: K, value: Config[K]) => void;
  onExport: () => void;
  onReset: () => void;
  label: string;
}) {
  return (
    <div className="w-72 border-r border-zinc-800 p-5 flex flex-col gap-5 overflow-y-auto shrink-0">
      <h2 className="text-zinc-300 text-xs font-semibold uppercase tracking-wider">
        {label} Config
      </h2>

      <Slider
        label="Duration"
        value={config.duration}
        onChange={(v) => onChange("duration", v)}
        min={200}
        max={8000}
        step={100}
        unit="ms"
      />

      <Slider
        label="Retract %"
        value={config.retractPercent}
        onChange={(v) => onChange("retractPercent", v)}
        min={1}
        max={100}
        step={0.5}
        unit="%"
      />

      <Slider
        label="Hold at full"
        value={config.holdFullMs}
        onChange={(v) => onChange("holdFullMs", v)}
        min={0}
        max={3000}
        step={50}
        unit="ms"
      />

      <Slider
        label="Hold at retracted"
        value={config.holdRetractedMs}
        onChange={(v) => onChange("holdRetractedMs", v)}
        min={0}
        max={3000}
        step={50}
        unit="ms"
      />

      <div className="flex flex-col gap-1">
        <span className="text-zinc-400 text-xs">Easing</span>
        <select
          value={config.easing}
          onChange={(e) => onChange("easing", e.target.value)}
          className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 focus:outline-none focus:border-zinc-500"
        >
          {EASING_OPTIONS.map((e) => (
            <option key={e} value={e}>
              {EASING_LABELS[e] || e}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-zinc-400 text-xs">Direction</span>
        <select
          value={config.direction}
          onChange={(e) =>
            onChange("direction", e.target.value as "inward" | "outward")
          }
          className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 focus:outline-none focus:border-zinc-500"
        >
          <option value="inward">Shrink from center</option>
          <option value="outward">Shrink from outside</option>
        </select>
      </div>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-zinc-400 text-xs">Start retracted</span>
        <button
          onClick={() => onChange("startRetracted", !config.startRetracted)}
          className={`w-8 h-4 rounded-full transition-colors relative ${
            config.startRetracted ? "bg-amber-500/80" : "bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
              config.startRetracted ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </label>

      <Slider
        label="Stroke width"
        value={config.strokeWidth}
        onChange={(v) => onChange("strokeWidth", v)}
        min={5}
        max={50}
        step={1}
      />

      <Slider
        label="Logo size"
        value={config.logoSize}
        onChange={(v) => onChange("logoSize", v)}
        min={32}
        max={512}
        step={8}
        unit="px"
      />

      <div className="mt-auto pt-4 border-t border-zinc-800 flex flex-col gap-2">
        <button
          onClick={onExport}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded px-3 py-2 transition-colors"
        >
          Copy config to clipboard
        </button>
        <button
          onClick={onReset}
          className="w-full text-zinc-500 hover:text-zinc-400 text-xs rounded px-3 py-2 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

export default function ExperimentsPage() {
  const [configA, setConfigA] = useState<Config>(PRESET_A);
  const [configB, setConfigB] = useState<Config>(PRESET_C);
  const [configC, setConfigC] = useState<Config>(PRESET_C);
  const [configD, setConfigD] = useState<GlitchConfig>(DEFAULT_GLITCH_CONFIG);
  const [configD2, setConfigD2] = useState<Config>(PRESET_C);
  const [selected, setSelected] = useState<"a" | "b" | "c" | "d2" | null>(null);
  const [showGlitchConfig, setShowGlitchConfig] = useState(false);

  const updateA = useCallback(
    <K extends keyof Config>(key: K, value: Config[K]) => {
      setConfigA((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateB = useCallback(
    <K extends keyof Config>(key: K, value: Config[K]) => {
      setConfigB((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateC = useCallback(
    <K extends keyof Config>(key: K, value: Config[K]) => {
      setConfigC((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateD2 = useCallback(
    <K extends keyof Config>(key: K, value: Config[K]) => {
      setConfigD2((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateD = useCallback(
    <K extends keyof GlitchConfig>(key: K, value: GlitchConfig[K]) => {
      setConfigD((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const configs = { a: configA, b: configB, c: configC, d2: configD2 };
  const updates = { a: updateA, b: updateB, c: updateC, d2: updateD2 };
  const setConfigs = { a: setConfigA, b: setConfigB, c: setConfigC, d2: setConfigD2 };
  const labels = { a: "Variant A", b: "Variant B", c: "Variant C", d2: "Variant D" };

  const activeConfig = selected ? configs[selected] : configA;
  const activeUpdate = selected ? updates[selected] : updateA;
  const activeSetConfig = selected ? setConfigs[selected] : setConfigA;
  const activeLabel = selected ? labels[selected] : "";

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Config Panel — only visible when a logo is selected */}
      {selected ? (
        <ConfigPanel
          config={activeConfig}
          onChange={activeUpdate}
          onExport={() =>
            navigator.clipboard.writeText(
              JSON.stringify(activeConfig, null, 2)
            )
          }
          onReset={() => activeSetConfig(DEFAULT_CONFIG)}
          label={activeLabel}
        />
      ) : null}

      {/* Preview area */}
      <div className="flex-1 flex flex-col items-center overflow-y-auto py-16">
        <h1 className="text-zinc-400 text-sm font-medium tracking-wide uppercase mb-16">
          Proq logo loader
        </h1>

        <div className="flex items-center gap-16">
          <LogoAnimation
            config={configA}
            selected={selected === "a"}
            onClick={() => setSelected(selected === "a" ? null : "a")}
            label="A"
          />
          <LogoAnimation
            config={configB}
            selected={selected === "b"}
            onClick={() => setSelected(selected === "b" ? null : "b")}
            label="B"
            svgPath={LOGOTYPE_SINGLE_PATH_2}
            viewBox="0 0 1001 372"
            aspectRatio={1001 / 372}
          />
        </div>

        <div className="flex items-center gap-16 mt-12">
          <LogoAnimation
            config={configC}
            selected={selected === "c"}
            onClick={() => setSelected(selected === "c" ? null : "c")}
            label="C"
            svgPath={LOGOTYPE_SINGLE_PATH}
            viewBox="0 0 1001 372"
            aspectRatio={1001 / 372}
          />
          <LogoAnimation
            config={configD2}
            selected={selected === "d2"}
            onClick={() => setSelected(selected === "d2" ? null : "d2")}
            label="D"
            svgPath={LOGOTYPE_SEPARATE_PATH}
            viewBox="0 0 1001 372"
            aspectRatio={1001 / 372}
          />
        </div>

        <h1 className="text-zinc-400 text-sm font-medium tracking-wide uppercase mt-24 mb-16">
          Proq logotype
        </h1>

        <div className="flex flex-col items-center gap-12">
          {/* Single stroke logotype v2 */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Single stroke v2</span>
            <svg
              width="500"
              height="186"
              viewBox="0 0 1001 372"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M145.152 165.235H182.126V113.651H106.241V217.41H236.237V60H53V271.749H289.5V233V60H472.737V217.41H342.741V113.651H418.626V165.235H391.5V271.749H527V60H688.111V217.41H580.241V165.235V113.651H634V165.235V271.749H925.374V60.0001H742.374V217.41H872.202V113.651H796.415V165.235H833.342"
                stroke="#E4BD89"
                strokeWidth="27"
              />
            </svg>
          </div>

          {/* Single stroke logotype v1 */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Single stroke v1</span>
            <svg
              width="500"
              height="186"
              viewBox="0 0 1001 372"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M145.152 165.235H182.126V113.651H106.241V217.41H236.237V60H53V271.749H289.5V233V60H472.737V217.41H342.741V113.651H418.626V165.235H391.5V271.749H527V60H710.237V217.41H580.241V165.235V113.651H656.126V165.235V271.749H947.5V60.0001H764.5V217.41H894.328V113.651H818.541V165.235H855.467"
                stroke="#E4BD89"
                strokeWidth="27"
              />
            </svg>
          </div>

          {/* Separate strokes logotype */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Separate strokes</span>
            <svg
              width="500"
              height="186"
              viewBox="0 0 1001 372"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M55 317.501V80.5006H238.237V237.911H108.241V134.152H184.126V185.736H147.152M291.5 253.501V80.5006H474.737V237.911H344.741V134.152H420.626V185.736H383.652M949.5 317.501V80.5007H766.5V237.911H896.328V134.152H820.541V185.736H857.467M529 237.911V80.5006H712.237V237.911H529ZM582.241 134.152H658.126V185.736H582.241V134.152Z"
                stroke="#E4BD89"
                strokeWidth="27"
              />
            </svg>
          </div>
        </div>

        {/* Glitch loader section */}
        <h1 className="text-zinc-400 text-sm font-medium tracking-wide uppercase mt-24 mb-16">
          Proq glitch loader
        </h1>

        <div className="flex flex-col items-center gap-6 w-full max-w-4xl">
          <GlitchAnimation
            config={configD}
            selected={false}
            onClick={() => setShowGlitchConfig(!showGlitchConfig)}
            label="Glitch"
            svgPath={LOGOTYPE_SINGLE_PATH_2}
            viewBox="0 0 1001 372"
            aspectRatio={1001 / 372}
          />

          {showGlitchConfig && (
            <GlitchConfigPanel
              config={configD}
              onChange={updateD}
              onExport={() =>
                navigator.clipboard.writeText(
                  JSON.stringify(configD, null, 2)
                )
              }
              onReset={() => setConfigD(DEFAULT_GLITCH_CONFIG)}
              label="Glitch"
              inline
            />
          )}
        </div>
      </div>
    </div>
  );
}
