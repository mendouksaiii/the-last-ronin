import { useId } from "react";
import { SCENES } from "@/game/data/scenes";
import type { ActorId, SceneId } from "@/game/types";
import { FigureArt } from "./FigureArt";

// The drawn background of a comic panel, with its cast standing in front.

const INK = "hsl(var(--ink))";
const PAPER = "hsl(var(--paper))";
const RED = "hsl(var(--vermilion))";

const NEON = "hsl(var(--vermilion-glow))";
const EMBER = "hsl(var(--gold))";

/** A ragged skyline of towers along the horizon, some broken, with a few lit windows. */
function Skyline({ fill, base, seed, broken = 0.3 }: { fill: string; base: number; seed: number; broken?: number }) {
  const towers = Array.from({ length: 14 }, (_, i) => {
    const r = (k: number) => ((Math.sin((i + 1) * 12.9898 + seed * 78.233 + k) * 43758.5453) % 1 + 1) % 1;
    const w = 20 + r(1) * 26;
    const h = 40 + r(2) * 120;
    return { x: i * 30 - 10 + r(3) * 8, w, h, cut: r(4) < broken, lit: Math.floor(r(5) * 4) };
  });
  return (
    <g>
      {towers.map((t, i) => (
        <g key={i}>
          <path
            d={t.cut ? `M${t.x} ${base} V${base - t.h} L${t.x + t.w * 0.4} ${base - t.h + 14} L${t.x + t.w * 0.7} ${base - t.h - 8} L${t.x + t.w} ${base - t.h + 20} V${base} Z` : `M${t.x} ${base} V${base - t.h} H${t.x + t.w} V${base} Z`}
            fill={fill}
          />
          {Array.from({ length: t.lit }, (_, k) => (
            <rect key={k} x={t.x + 4 + ((k * 7) % (t.w - 8))} y={base - t.h + 14 + k * 17} width={3} height={4} fill={k % 3 === 0 ? EMBER : NEON} opacity={0.8} />
          ))}
        </g>
      ))}
    </g>
  );
}

/** Slanting rain streaks over the whole panel. */
function Rain({ n = 60, color = PAPER, opacity = 0.18 }: { n?: number; color?: string; opacity?: number }) {
  return (
    <g stroke={color} strokeWidth={0.8} opacity={opacity}>
      {Array.from({ length: n }, (_, i) => {
        const x = (i * 67) % 420;
        const y = (i * 41) % 240;
        return <line key={i} x1={x} y1={y} x2={x - 4} y2={y + 16} />;
      })}
    </g>
  );
}

function Sign({ x, y, w, text }: { x: number; y: number; w: number; text: string }) {
  return (
    <g>
      <rect x={x - 4} y={y - 4} width={w + 8} height={22} fill={NEON} opacity={0.15} />
      <rect x={x} y={y} width={w} height={14} fill="none" stroke={NEON} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + 11} textAnchor="middle" fontSize={10} fontWeight={700} fill={NEON} fontFamily="Bebas Neue, Impact, sans-serif">
        {text}
      </text>
    </g>
  );
}

function Motif({ scene }: { scene: SceneId }) {
  const s = SCENES[scene];
  switch (s.motif) {
    case "reeds":
      return (
        <g>
          <Skyline fill={s.far} base={190} seed={1} />
          <rect x={0} y={190} width={400} height={50} fill="hsl(200 10% 6%)" />
          {[196, 206, 220].map((y) => (
            <line key={y} x1={0} y1={y} x2={400} y2={y} stroke={NEON} strokeWidth={0.8} opacity={0.25} strokeDasharray="30 12" />
          ))}
          {Array.from({ length: 18 }, (_, i) => (
            <line key={i} x1={i * 23 + 4} y1={240} x2={i * 23 + ((i * 7) % 11) - 2} y2={196 - ((i * 13) % 20)} stroke="hsl(60 10% 26%)" strokeWidth={2} />
          ))}
          <Rain />
        </g>
      );
    case "peaks":
      return (
        <g>
          <Skyline fill={s.far} base={214} seed={2} broken={0.15} />
          <path d="M160 214 V110 L200 50 L240 110 V214 Z" fill="hsl(210 8% 9%)" />
          <circle cx={200} cy={100} r={9} fill="none" stroke={EMBER} strokeWidth={2} />
          {Array.from({ length: 50 }, (_, i) => (
            <circle key={i} cx={(i * 53) % 400} cy={(i * 37) % 210} r={1.2} fill={PAPER} opacity={0.5} />
          ))}
        </g>
      );
    case "waves":
      return (
        <g>
          <Skyline fill={s.far} base={150} seed={3} />
          {[[30, 112], [70, 124], [300, 118], [340, 108]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width={36} height={150 - y} fill={i % 2 ? "hsl(352 40% 18%)" : "hsl(200 10% 14%)"} stroke={INK} />
          ))}
          <path d="M240 150 L232 92 L290 108 L300 150 Z" fill={INK} />
          <rect x={0} y={150} width={400} height={90} fill="hsl(200 12% 5%)" />
          {[164, 184, 204].map((y, i) => (
            <path
              key={y}
              d={`M0 ${y} ${Array.from({ length: 9 }, (_, k) => `Q${k * 50 + 12 + i * 8} ${y - 6} ${k * 50 + 25 + i * 8} ${y} T${k * 50 + 50 + i * 8} ${y}`).join(" ")}`}
              fill="none"
              stroke={NEON}
              strokeWidth={1}
              opacity={0.3}
            />
          ))}
          <Rain />
        </g>
      );
    case "roofs":
      return (
        <g>
          <Skyline fill={s.far} base={214} seed={4} broken={0.1} />
          <Sign x={30} y={96} w={56} text="HOTEL" />
          <Sign x={170} y={70} w={40} text="BAR" />
          <Sign x={290} y={110} w={70} text="NOODLES" />
          <Sign x={110} y={140} w={36} text="24H" />
          <Rain n={70} color={NEON} opacity={0.15} />
        </g>
      );
    case "volcano":
      return (
        <g>
          <Skyline fill={s.far} base={214} seed={5} broken={0.7} />
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1={150 + i * 14} y1={214} x2={146 + i * 15} y2={60 + (i % 3) * 20} stroke="hsl(15 10% 12%)" strokeWidth={3} />
          ))}
          <ellipse cx={200} cy={46} rx={80} ry={18} fill="hsl(15 10% 16%)" opacity={0.8} />
          {Array.from({ length: 30 }, (_, i) => (
            <circle key={i} cx={(i * 67) % 400} cy={(i * 41) % 200} r={1.5} fill={EMBER} />
          ))}
        </g>
      );
    case "fire":
    case "castle":
      return (
        <g>
          <Skyline fill={s.far} base={214} seed={6} broken={0.2} />
          <path d="M170 214 V60 L186 40 H214 L230 60 V214 Z" fill="hsl(350 15% 5%)" />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x={186} y={66 + i * 20} width={28} height={4} fill={s.motif === "fire" ? EMBER : "hsl(30 60% 50%)"} opacity={0.7} />
          ))}
          {s.motif === "fire" && (
            <g>
              <path d="M160 120 Q150 80 174 66 Q168 94 190 80 Q186 50 210 30 Q214 62 236 74 Q250 60 246 90 Q272 98 260 126 Z" fill="hsl(14 90% 46%)" opacity={0.8} />
              {Array.from({ length: 26 }, (_, i) => (
                <circle key={i} cx={(i * 59) % 400} cy={(i * 43) % 170} r={1.6} fill={EMBER} />
              ))}
              {[30, 62, 96, 310, 344, 378].map((x, i) => (
                <circle key={x} cx={x} cy={222 + (i % 2) * 8} r={5} fill={RED} stroke={INK} strokeWidth={1} />
              ))}
            </g>
          )}
          {s.motif === "castle" && <Rain n={40} />}
        </g>
      );
    case "torii":
      return (
        <g>
          <Skyline fill={s.far} base={214} seed={7} />
          <g fill={RED} stroke={INK} strokeWidth={2}>
            <rect x={138} y={96} width={12} height={130} />
            <rect x={250} y={96} width={12} height={130} />
            <path d="M116 84 Q200 70 284 84 L280 98 Q200 86 120 98 Z" />
            <rect x={130} y={112} width={140} height={9} />
          </g>
          <Rain n={50} />
        </g>
      );
    case "grave":
      return (
        <g>
          <Skyline fill={s.far} base={200} seed={8} broken={0.5} />
          <rect x={0} y={196} width={400} height={44} fill="hsl(20 10% 12%)" />
          <path d="M296 240 Q300 170 286 120 M292 170 Q320 150 336 120 M290 150 Q270 130 262 104" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          {[[282, 112], [300, 96], [334, 116], [262, 100], [318, 136], [274, 132], [344, 100], [250, 122]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={9} fill={RED} stroke={INK} strokeWidth={1} />
          ))}
          <path d="M92 226 V172 Q92 156 106 156 Q120 156 120 172 V226 Z" fill="hsl(30 6% 40%)" stroke={INK} strokeWidth={2} />
          <rect x={82} y={222} width={48} height={8} fill="hsl(30 6% 30%)" stroke={INK} strokeWidth={2} />
        </g>
      );
  }
}

interface Props {
  scene: SceneId;
  actors?: ActorId[];
}

export function SceneArt({ scene, actors = [] }: Props) {
  const id = useId();
  const s = SCENES[scene];
  const n = actors.length;
  const scale = n > 3 ? 0.78 : 1;
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={`${scene} scene`}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.sky[0]} />
          <stop offset="1" stopColor={s.sky[1]} />
        </linearGradient>
        <pattern id={`${id}-dots`} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="0.8" fill={INK} opacity="0.2" />
        </pattern>
      </defs>
      <rect width="400" height="240" fill={`url(#${id}-sky)`} />
      <circle cx={s.sunAt[0]} cy={s.sunAt[1]} r={s.sunAt[2]} fill={s.sun} />
      <Motif scene={scene} />
      <rect x={0} y={214} width={400} height={26} fill={s.land} />
      {actors.map((a, i) => {
        const x = (400 * (i + 1)) / (n + 1);
        return <FigureArt key={`${a}-${i}`} actor={a} x={x} y={232} scale={scale} flip={n > 1 && x > 200} />;
      })}
      <rect width="400" height="240" fill={`url(#${id}-dots)`} />
    </svg>
  );
}
