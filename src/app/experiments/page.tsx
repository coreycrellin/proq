"use client";

import { useEffect, useRef } from "react";

const LOGO_PATH =
  "M36.3813 253V16H219.618V173.41H89.6223V69.6509H165.507V121.235H128.533";
const STROKE_COLOR = "#E4BD89";
const STROKE_WIDTH = 27;

export default function ExperimentsPage() {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    const totalLength = path.getTotalLength();

    // Set up the dash pattern: full length dash, full length gap
    path.style.strokeDasharray = `${totalLength}`;
    path.style.strokeDashoffset = "0";

    // Create the animation
    const animation = path.animate(
      [
        { strokeDashoffset: "0" },
        { strokeDashoffset: `${-totalLength * 0.75}` },
        { strokeDashoffset: "0" },
      ],
      {
        duration: 2000,
        easing: "ease-in-out",
        iterations: Infinity,
      }
    );

    return () => animation.cancel();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center pt-16">
      <h1 className="text-zinc-400 text-sm font-medium tracking-wide uppercase mb-16">
        Proq logo loader
      </h1>

      <div className="flex flex-col items-center gap-8">
        <svg
          width="128"
          height="128"
          viewBox="0 0 256 256"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            ref={pathRef}
            d={LOGO_PATH}
            stroke={STROKE_COLOR}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="square"
          />
        </svg>
      </div>
    </div>
  );
}
