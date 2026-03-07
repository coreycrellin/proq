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
        <span className="text-zinc-500 font-mono">
          {value}
          {unit}
        </span>
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

export default function ExperimentsPage() {
  const pathRef = useRef<SVGPathElement>(null);
  const animRef = useRef<Animation | null>(null);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

  const update = useCallback(
    <K extends keyof Config>(key: K, value: Config[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

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

    // Build keyframes with hold times
    const totalTime =
      config.duration + config.holdFullMs + config.holdRetractedMs;
    const animDuration = config.duration / 2;
    const holdFullFrac = config.holdFullMs / totalTime;
    const retractFrac = animDuration / totalTime;
    const holdRetractedFrac = config.holdRetractedMs / totalTime;
    const extendFrac = animDuration / totalTime;

    // offset positions along 0..1
    const t1 = holdFullFrac;
    const t2 = t1 + retractFrac;
    const t3 = t2 + holdRetractedFrac;
    const _t4 = t3 + extendFrac; // should be ~1

    const keyframes: Keyframe[] = [
      { strokeDashoffset: "0", offset: 0, easing: config.easing },
      ...(config.holdFullMs > 0
        ? [{ strokeDashoffset: "0", offset: t1, easing: config.easing }]
        : []),
      { strokeDashoffset: target, offset: t2, easing: config.easing },
      ...(config.holdRetractedMs > 0
        ? [{ strokeDashoffset: target, offset: t3, easing: config.easing }]
        : []),
      { strokeDashoffset: "0", offset: 1 },
    ];

    const animation = path.animate(keyframes, {
      duration: totalTime,
      iterations: Infinity,
    });

    animRef.current = animation;
    return () => animation.cancel();
  }, [config]);

  const exportConfig = () => {
    const output = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(output);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Controls Panel */}
      <div className="w-72 border-r border-zinc-800 p-5 flex flex-col gap-5 overflow-y-auto shrink-0">
        <h2 className="text-zinc-300 text-xs font-semibold uppercase tracking-wider">
          Animation Config
        </h2>

        <Slider
          label="Duration"
          value={config.duration}
          onChange={(v) => update("duration", v)}
          min={200}
          max={8000}
          step={100}
          unit="ms"
        />

        <Slider
          label="Retract %"
          value={config.retractPercent}
          onChange={(v) => update("retractPercent", v)}
          min={10}
          max={100}
          step={1}
          unit="%"
        />

        <Slider
          label="Hold at full"
          value={config.holdFullMs}
          onChange={(v) => update("holdFullMs", v)}
          min={0}
          max={3000}
          step={50}
          unit="ms"
        />

        <Slider
          label="Hold at retracted"
          value={config.holdRetractedMs}
          onChange={(v) => update("holdRetractedMs", v)}
          min={0}
          max={3000}
          step={50}
          unit="ms"
        />

        <div className="flex flex-col gap-1">
          <span className="text-zinc-400 text-xs">Easing</span>
          <select
            value={config.easing}
            onChange={(e) => update("easing", e.target.value)}
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
              update("direction", e.target.value as "inward" | "outward")
            }
            className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          >
            <option value="inward">Shrink from center</option>
            <option value="outward">Shrink from outside</option>
          </select>
        </div>

        <Slider
          label="Stroke width"
          value={config.strokeWidth}
          onChange={(v) => update("strokeWidth", v)}
          min={5}
          max={50}
          step={1}
        />

        <Slider
          label="Logo size"
          value={config.logoSize}
          onChange={(v) => update("logoSize", v)}
          min={32}
          max={512}
          step={8}
          unit="px"
        />

        <div className="mt-auto pt-4 border-t border-zinc-800 flex flex-col gap-2">
          <button
            onClick={exportConfig}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded px-3 py-2 transition-colors"
          >
            Copy config to clipboard
          </button>
          <button
            onClick={() => setConfig(DEFAULT_CONFIG)}
            className="w-full text-zinc-500 hover:text-zinc-400 text-xs rounded px-3 py-2 transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 className="text-zinc-400 text-sm font-medium tracking-wide uppercase mb-16">
          Proq logo loader
        </h1>

        <svg
          width={config.logoSize}
          height={config.logoSize}
          viewBox="0 0 256 256"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            ref={pathRef}
            d={LOGO_PATH}
            stroke={STROKE_COLOR}
            strokeWidth={config.strokeWidth}
          />
        </svg>
      </div>
    </div>
  );
}
