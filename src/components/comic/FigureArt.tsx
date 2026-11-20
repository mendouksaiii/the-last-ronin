import { FIGURES, type Figure } from "@/game/data/scenes";
import type { ActorId } from "@/game/types";

// A full-figure ink silhouette of a character, drawn with its feet at the origin.

const INK = "hsl(var(--ink))";
const PAPER = "hsl(var(--paper))";
const SKIN = "hsl(24 18% 46%)";
const TURTLE = "hsl(84 16% 32%)";
const STRAW = "hsl(36 22% 32%)";
const STEEL = "hsl(210 8% 78%)";
const WOOD = "hsl(24 30% 22%)";

function Prop({ f }: { f: Figure }) {
  const stroke = { stroke: INK, strokeWidth: 1.5 };
  switch (f.prop) {
    case "katana":
      return (
        <g>
          <line x1={14} y1={-46} x2={46} y2={-98} stroke={STEEL} strokeWidth={3} strokeLinecap="round" />
          <line x1={12} y1={-42} x2={19} y2={-54} stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <line x1={16} y1={-56} x2={23} y2={-51} stroke={f.accent} strokeWidth={2} />
        </g>
      );
    case "bo":
      return (
        <g strokeLinecap="round">
          <line x1={-20} y1={-6} x2={42} y2={-138} stroke={WOOD} strokeWidth={4} />
          <line x1={38} y1={-130} x2={42} y2={-138} stroke={STEEL} strokeWidth={5} />
          <line x1={-20} y1={-6} x2={-16} y2={-14} stroke={STEEL} strokeWidth={5} />
        </g>
      );
    case "kusari":
      return (
        <g fill="none">
          <path d="M16 -46 Q30 -10 6 -2 Q-18 4 -30 -20" stroke={STEEL} strokeWidth={1.5} strokeDasharray="3 2" />
          <rect x={-35} y={-26} width={9} height={11} fill={STEEL} stroke={INK} strokeWidth={1.2} />
        </g>
      );
    case "nunchaku":
      return (
        <g strokeLinecap="round">
          <line x1={14} y1={-46} x2={22} y2={-70} stroke={WOOD} strokeWidth={4.5} />
          <path d="M22 -70 Q30 -78 36 -74" fill="none" stroke={STEEL} strokeWidth={1.2} />
          <line x1={36} y1={-74} x2={58} y2={-60} stroke={WOOD} strokeWidth={4.5} />
        </g>
      );
    case "crossbow":
      return (
        <g strokeLinecap="round">
          <line x1={8} y1={-52} x2={44} y2={-58} stroke={WOOD} strokeWidth={4} />
          <path d="M40 -72 Q46 -58 40 -44" fill="none" stroke="hsl(0 0% 30%)" strokeWidth={3} />
          <line x1={44} y1={-58} x2={140} y2={-74} stroke="hsl(var(--vermilion-glow))" strokeWidth={0.8} opacity={0.8} />
        </g>
      );
    case "naginata":
      return (
        <g>
          <line x1={24} y1={0} x2={24} y2={-124} stroke={WOOD} strokeWidth={3} />
          <path d="M24 -124 Q40 -140 30 -158 Q20 -142 24 -124 Z" fill={STEEL} {...stroke} />
        </g>
      );
    case "knives":
      return (
        <g stroke={STEEL} strokeWidth={2.5} strokeLinecap="round">
          <line x1={16} y1={-50} x2={30} y2={-66} />
          <line x1={-16} y1={-50} x2={-30} y2={-66} />
        </g>
      );
    case "club":
      return (
        <g strokeLinecap="round">
          <line x1={16} y1={-44} x2={30} y2={-74} stroke={WOOD} strokeWidth={5} />
          <line x1={30} y1={-74} x2={46} y2={-110} stroke="hsl(220 8% 26%)" strokeWidth={14} />
          <circle cx={36} cy={-88} r={2} fill={f.accent} />
          <circle cx={42} cy={-100} r={2} fill={f.accent} />
        </g>
      );
    case "sickle":
      return (
        <g fill="none">
          <line x1={16} y1={-44} x2={30} y2={-70} stroke={WOOD} strokeWidth={3} />
          <path d="M30 -70 Q52 -84 44 -56" stroke={STEEL} strokeWidth={3.5} />
          <path d="M16 -44 Q0 -10 -26 -22" stroke={STEEL} strokeWidth={1.5} strokeDasharray="3 3" />
        </g>
      );
    case "lantern":
      return (
        <g>
          <line x1={14} y1={-56} x2={30} y2={-66} stroke={INK} strokeWidth={2} />
          <circle cx={32} cy={-52} r={22} fill={f.accent} opacity={0.25} />
          <rect x={25} y={-66} width={14} height={20} rx={5} fill={f.accent} {...stroke} />
        </g>
      );
    case "biwa":
      return (
        <g {...stroke}>
          <ellipse cx={6} cy={-30} rx={15} ry={21} transform="rotate(-55 6 -30)" fill={f.accent} />
          <line x1={20} y1={-40} x2={46} y2={-58} stroke={WOOD} strokeWidth={4} />
        </g>
      );
    default:
      return null;
  }
}

function Head({ f }: { f: Figure }) {
  const stroke = { stroke: INK, strokeWidth: 1.5 };
  const face = f.turtle ? TURTLE : SKIN;
  const base = (
    <g {...stroke}>
      <circle cx={2} cy={-88} r={12} fill={face} />
      {f.turtle && <ellipse cx={11} cy={-85} rx={6} ry={5} fill={face} />}
      <line x1={7} y1={-90} x2={12} y2={-90} strokeWidth={2} />
    </g>
  );
  switch (f.head) {
    case "kasa":
      return (
        <g>
          {base}
          <path d="M-26 -90 L2 -112 L30 -90 Q2 -84 -26 -90 Z" fill={STRAW} {...stroke} />
        </g>
      );
    case "band":
      return (
        <g>
          {base}
          <path d="M-10 -94 Q2 -98 14 -93 L14 -88 Q2 -93 -10 -89 Z" fill={f.accent} {...stroke} />
          <path d="M-10 -92 L-28 -84 M-10 -90 L-24 -76" stroke={f.accent} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case "horns":
      return (
        <g>
          {base}
          <path d="M-12 -90 Q2 -108 16 -90 Z" fill="hsl(220 8% 22%)" {...stroke} />
          <path d="M-10 -96 Q-24 -104 -20 -118 M14 -96 Q28 -104 24 -118" fill="none" stroke={f.accent} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    case "bald":
      return (
        <g>
          {base}
          {[-8, -3, 2, 7, 12].map((x) => (
            <circle key={x} cx={x} cy={-72 + Math.abs(x - 2) * 0.3} r={2.5} fill={f.accent} {...stroke} />
          ))}
        </g>
      );
    case "tail":
      return (
        <g>
          {base}
          <path d="M-8 -96 Q-30 -100 -26 -66" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <path d="M-9 -96 Q2 -102 13 -94" fill="none" stroke={f.accent} strokeWidth={3} />
        </g>
      );
    case "mask":
      return (
        <g>
          {base}
          <ellipse cx={5} cy={-88} rx={10} ry={12} fill={PAPER} {...stroke} />
          <path d="M1 -92 L5 -90 M8 -92 L12 -90" stroke={INK} strokeWidth={2} />
          <path d="M2 -82 Q7 -78 12 -83" fill="none" stroke="hsl(var(--vermilion))" strokeWidth={2} />
        </g>
      );
    case "beard":
      return (
        <g>
          {base}
          <path d="M-2 -82 Q6 -50 12 -82 Z" fill={PAPER} {...stroke} />
          <circle cx={-2} cy={-102} r={5} fill={PAPER} {...stroke} />
        </g>
      );
    case "eboshi":
      return (
        <g>
          {base}
          <path d="M-8 -96 L-4 -124 Q4 -130 10 -122 L12 -96 Z" fill={INK} />
        </g>
      );
    case "hood":
      return (
        <g>
          {base}
          <path d="M-14 -78 Q-16 -104 2 -104 Q18 -104 16 -84 L8 -94 Q-2 -96 -6 -78 Z" fill={f.body} {...stroke} />
        </g>
      );
    case "visor":
      return (
        <g>
          <circle cx={2} cy={-88} r={12} fill={f.body} {...stroke} />
          <rect x={-4} y={-92} width={18} height={4} fill="hsl(var(--vermilion-glow))" />
        </g>
      );
    case "shawl":
      return (
        <g>
          {base}
          <path d="M-14 -78 Q-14 -106 4 -104 Q18 -100 14 -92 L6 -98 Q-4 -98 -6 -78 Z" fill={f.body} {...stroke} />
        </g>
      );
  }
}

export function FigureArt({ actor, x, y, scale, flip }: { actor: ActorId; x: number; y: number; scale: number; flip: boolean }) {
  const f = FIGURES[actor];
  const body = f.seated ? "M-26 0 L-14 -72 Q0 -80 14 -72 L28 0 Z" : "M-18 0 L-13 -72 Q0 -80 13 -72 L18 0 Z";
  return (
    <g transform={`translate(${x} ${y}) scale(${(flip ? -1 : 1) * scale * f.w} ${scale * f.h})`}>
      {f.turtle && <ellipse cx={-12} cy={-46} rx={15} ry={27} fill="hsl(30 18% 16%)" stroke={INK} strokeWidth={1.5} />}
      <path d={body} fill={f.body} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <rect x={-15} y={-46} width={30} height={6} fill={f.accent} />
      <Prop f={f} />
      <Head f={f} />
    </g>
  );
}
