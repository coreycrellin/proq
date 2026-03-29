'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlayIcon, PauseIcon, RotateCcwIcon } from 'lucide-react';

interface CymaticTabProps {
  className?: string;
}

// Precomputed mode pairs sorted by n² + m², used to map frequency → pattern
const MODE_PAIRS: [number, number][] = [];
for (let n = 1; n <= 12; n++) {
  for (let m = n; m <= 12; m++) {
    MODE_PAIRS.push([n, m]);
  }
}
MODE_PAIRS.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2));

// Base frequency for mode (1,1)
const F0 = 80;

function getModeForFrequency(freq: number): { n: number; m: number; blend: number; nNext: number; mNext: number } {
  const target = (2 * freq) / F0;

  let bestIdx = 0;
  for (let i = 0; i < MODE_PAIRS.length; i++) {
    const val = MODE_PAIRS[i][0] ** 2 + MODE_PAIRS[i][1] ** 2;
    if (val <= target) bestIdx = i;
    else break;
  }

  const [n, m] = MODE_PAIRS[bestIdx];
  const nextIdx = Math.min(bestIdx + 1, MODE_PAIRS.length - 1);
  const [nNext, mNext] = MODE_PAIRS[nextIdx];

  const currentVal = n ** 2 + m ** 2;
  const nextVal = nNext ** 2 + mNext ** 2;
  const blend = nextVal === currentVal ? 0 : Math.min(1, Math.max(0, (target - currentVal) / (nextVal - currentVal)));

  return { n, m, blend, nNext, mNext };
}

function renderChladni(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  freq: number,
  time: number,
  sign: number,
) {
  const { n, m, blend, nNext, mNext } = getModeForFrequency(freq);
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Precompute cos tables for current and next mode
  const cosNx = new Float32Array(width);
  const cosMx = new Float32Array(width);
  const cosNNextX = new Float32Array(width);
  const cosMNextX = new Float32Array(width);
  for (let px = 0; px < width; px++) {
    const x = px / width;
    cosNx[px] = Math.cos(n * Math.PI * x);
    cosMx[px] = Math.cos(m * Math.PI * x);
    cosNNextX[px] = Math.cos(nNext * Math.PI * x);
    cosMNextX[px] = Math.cos(mNext * Math.PI * x);
  }

  const cosNy = new Float32Array(height);
  const cosMy = new Float32Array(height);
  const cosNNextY = new Float32Array(height);
  const cosMNextY = new Float32Array(height);
  for (let py = 0; py < height; py++) {
    const y = py / height;
    cosNy[py] = Math.cos(n * Math.PI * y);
    cosMy[py] = Math.cos(m * Math.PI * y);
    cosNNextY[py] = Math.cos(nNext * Math.PI * y);
    cosMNextY[py] = Math.cos(mNext * Math.PI * y);
  }

  // Breathing animation
  const breathe = Math.cos(time * 2);
  const breatheScale = 0.92 + 0.08 * breathe;

  // Sharpness: higher k = thinner nodal lines
  const k = 18;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Current mode amplitude
      const a1 = cosNx[px] * cosMy[py] + sign * cosMx[px] * cosNy[py];
      // Next mode amplitude
      const a2 = cosNNextX[px] * cosMNextY[py] + sign * cosMNextX[px] * cosNNextY[py];

      // Blend between modes
      const amplitude = ((1 - blend) * a1 + blend * a2) * breatheScale;

      // Particles accumulate where amplitude ≈ 0
      const intensity = Math.exp(-k * amplitude * amplitude);

      // Warm off-white color for "sand"
      const idx = (py * width + px) * 4;
      data[idx] = Math.floor(intensity * 245);     // R
      data[idx + 1] = Math.floor(intensity * 230); // G
      data[idx + 2] = Math.floor(intensity * 208); // B
      data[idx + 3] = 255;                          // A
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export default function CymaticTab({ className }: CymaticTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [frequency, setFrequency] = useState(345);
  const [sign, setSign] = useState(1);
  const [animate, setAnimate] = useState(true);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);

  const CANVAS_SIZE = 512;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now() / 1000;
    if (lastFrameRef.current > 0 && animate) {
      timeRef.current += now - lastFrameRef.current;
    }
    lastFrameRef.current = now;

    renderChladni(ctx, CANVAS_SIZE, CANVAS_SIZE, frequency, timeRef.current, sign);
    animFrameRef.current = requestAnimationFrame(draw);
  }, [frequency, sign, animate]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  const { n, m } = getModeForFrequency(frequency);

  return (
    <div className={`flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-auto ${className || ''}`}>
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-zinc-100">Cymatic Visualizer</h2>
        <p className="text-sm text-zinc-400">Chladni plate pattern simulation</p>
      </div>

      <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-zinc-700/50">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="block bg-zinc-950"
          style={{ width: 480, height: 480 }}
        />
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm font-mono text-zinc-200">
          {frequency} Hz
        </div>
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-400">
          mode ({n}, {m})
        </div>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Frequency slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-300">Frequency</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={frequency}
                onChange={(e) => setFrequency(Math.max(80, Math.min(8000, Number(e.target.value) || 80)))}
                className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 text-right font-mono"
              />
              <span className="text-xs text-zinc-500">Hz</span>
            </div>
          </div>
          <input
            type="range"
            min={80}
            max={8000}
            step={1}
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>80 Hz</span>
            <span>8000 Hz</span>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAnimate(!animate)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm text-zinc-300 transition-colors"
          >
            {animate ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            {animate ? 'Pause' : 'Animate'}
          </button>
          <button
            onClick={() => setSign(s => s === 1 ? -1 : 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm text-zinc-300 transition-colors"
          >
            <RotateCcwIcon size={14} />
            Flip ({sign === 1 ? '+' : '-'})
          </button>

          {/* Preset frequencies */}
          <div className="flex gap-1.5 ml-auto">
            {[345, 1033, 1820, 3240, 4444, 5907].map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  frequency === f
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
