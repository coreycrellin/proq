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

const PRESET_A: Config = {
  duration: 1900,
  retractPercent: 6.5,
  holdFullMs: 2900,
  holdRetractedMs: 1550,
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  strokeWidth: 27,
  logoSize: 128,
  direction: "inward",
};

const PRESET_B: Config = {
  duration: 4400,
  retractPercent: 100,
  holdFullMs: 850,
  holdRetractedMs: 1300,
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  strokeWidth: 27,
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

function LogoAnimation({
  config,
  selected,
  onClick,
  label,
}: {
  config: Config;
  selected: boolean;
  onClick: () => void;
  label: string;
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
  const [configB, setConfigB] = useState<Config>(PRESET_B);
  const [selected, setSelected] = useState<"a" | "b" | null>(null);

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

  const activeConfig = selected === "a" ? configA : configB;
  const activeUpdate = selected === "a" ? updateA : updateB;
  const activeSetConfig = selected === "a" ? setConfigA : setConfigB;

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Config Panel — only visible when a logo is selected */}
      {selected && (
        <ConfigPanel
          config={activeConfig}
          onChange={activeUpdate}
          onExport={() =>
            navigator.clipboard.writeText(
              JSON.stringify(activeConfig, null, 2)
            )
          }
          onReset={() => activeSetConfig(DEFAULT_CONFIG)}
          label={selected === "a" ? "Variant A" : "Variant B"}
        />
      )}

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
          />
        </div>

        <h1 className="text-zinc-400 text-sm font-medium tracking-wide uppercase mt-24 mb-16">
          Proq logotype
        </h1>

        <div className="flex flex-col items-center gap-12">
          {/* Single stroke logotype */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Single stroke</span>
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
      </div>
    </div>
  );
}
