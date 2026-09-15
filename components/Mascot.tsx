"use client";

/**
 * Sprig — the mint leaf.
 *
 * He only appears on screens that would otherwise be blank: before your first
 * photo, on sign-in, on an empty to-do list, and on the quiz result, where his
 * reaction is the point. Once there is real content on screen he gets out of
 * the way, which is the difference between a mascot and decoration.
 *
 * The blade is generated rather than hand-drawn, because a hand-drawn path
 * kept coming out as a circle. `half()` is the botany: an ovate leaf is widest
 * just below the middle and tapers to a point at both ends, so the silhouette
 * reads as mint at a glance instead of as a green blob. The margin, the
 * midrib and the side veins all derive from that one function, so they cannot
 * drift out of agreement with the outline.
 *
 * Everything below runs once at module load and is a constant thereafter, so
 * rendering him costs a React element and nothing else. The maths is
 * deterministic, so the server and the client produce identical paths and
 * hydration stays quiet.
 */

export type Mood = "idle" | "think" | "happy" | "oops" | "sleep";

const CX = 60;         // the midrib
const TIP_Y = 12;
const BASE_Y = 104;
const MAX_HALF = 35;   // half-width at the widest point

/** Half-width of the blade at t, where t is 0 at the tip and 1 at the base. */
function half(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  // The 1.35 exponent moves the widest point down to roughly 60% of the way
  // to the base — ovate rather than elliptical. The 0.9 fills the shoulders
  // out slightly so it does not read as a lens.
  return MAX_HALF * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.35)), 0.9);
}

const yAt = (t: number) => TIP_Y + (BASE_Y - TIP_Y) * t;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Quadratic through the midpoints: every sampled point becomes a control
 *  point, which is what rounds the teeth into mint's crenate margin. */
function smooth(pts: [number, number][]): string {
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    d += `Q${r1(px)},${r1(py)} ${r1((px + x) / 2)},${r1((py + y) / 2)}`;
  }
  return `${d}Z`;
}

const BLADE = (() => {
  const STEPS = 34;
  const TOOTH = 2.7;
  const pts: [number, number][] = [];
  const side = (i: number, sign: 1 | -1) => {
    const t = i / STEPS;
    // Teeth fade to nothing at the tip and where the blade meets the stem,
    // which is where a real leaf's margin goes smooth.
    const fade = Math.min(1, Math.sin(Math.PI * t) * 1.7);
    const bump = i % 2 === 0 ? 0 : TOOTH * fade;
    pts.push([CX + sign * (half(t) + bump), yAt(t)]);
  };
  for (let i = 0; i <= STEPS; i++) side(i, 1);
  for (let i = STEPS - 1; i > 0; i--) side(i, -1);
  return smooth(pts);
})();

const MIDRIB = `M${CX},${BASE_Y - 2} Q${CX - 1.6},60 ${CX},${TIP_Y + 6}`;

/** Pinnate venation: each pair leaves the midrib and sweeps up toward the
 *  margin, stopping short of it the way real veins do. */
const VEINS = ([0.8, 0.68, 0.56, 0.44, 0.32] as const).flatMap((t) => {
  const y = yAt(t);
  const endY = yAt(t - 0.15);
  const reach = half(t) * 0.72;
  return ([1, -1] as const).map(
    (s) =>
      `M${CX},${r1(y)} Q${r1(CX + s * reach * 0.52)},${r1(y - 2.5)} ` +
      `${r1(CX + s * reach)},${r1(endY)}`,
  );
});

export default function Mascot({
  mood = "idle",
  size = 88,
}: {
  mood?: Mood;
  size?: number;
}) {
  // Gradient ids must be unique per mood, or two Sprigs on one page share a
  // single <defs> and the second renders unpainted.
  const id = `sprig-${mood}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 124"
      role="img"
      aria-label="Sprig the mint leaf"
      className="sprig"
      style={{ overflow: "visible", flex: "none" }}
    >
      <defs>
        <linearGradient id={`${id}-blade`} x1="18%" y1="4%" x2="84%" y2="98%">
          <stop offset="0%" stopColor="#8DE9CB" />
          <stop offset="44%" stopColor="#3EC59D" />
          <stop offset="100%" stopColor="#12876A" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="12%" y1="2%" x2="72%" y2="76%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-shade`} cx="76%" cy="86%" r="62%">
          <stop offset="0%" stopColor="#06563F" stopOpacity="0.36" />
          <stop offset="100%" stopColor="#06563F" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-lift`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="4.5" floodColor="#0B6B52" floodOpacity="0.28" />
        </filter>
      </defs>

      {/* He hovers a little, so the contact shadow is detached on purpose. */}
      <ellipse cx={CX} cy="119" rx="24" ry="4" fill="#0B6B52" opacity="0.13" />

      <path
        d={`M${CX},${BASE_Y - 4} q-1.5,7 1,13`}
        stroke="#17916F"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />

      <g filter={`url(#${id}-lift)`}>
        <path d={BLADE} fill={`url(#${id}-blade)`} />
        <path d={BLADE} fill={`url(#${id}-shade)`} />

        <path
          d={MIDRIB}
          stroke="#0C7B5E"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeOpacity="0.5"
          fill="none"
        />
        {VEINS.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke="#0C7B5E"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="0.3"
            fill="none"
          />
        ))}

        <path d={BLADE} fill={`url(#${id}-gloss)`} />
      </g>

      <Face mood={mood} />
    </svg>
  );
}

/** Eyes sit above the widest part of the blade, where there is room for them.
 *  The white catchlight is what stops him looking dead. */
function eye(cx: number, cy: number, r = 6) {
  return (
    <g
      key={`${cx}-${cy}`}
      className="sprig-eye"
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.1} fill="#0B2B22" />
      <circle cx={cx + r * 0.33} cy={cy - r * 0.42} r={r * 0.35} fill="#fff" />
      <circle cx={cx - r * 0.3} cy={cy + r * 0.38} r={r * 0.16} fill="#fff" opacity="0.6" />
    </g>
  );
}

const INK = "#0B2B22";

function Face({ mood }: { mood: Mood }) {
  if (mood === "sleep") {
    return (
      <g>
        <path
          d="M42 55q6 5.5 12 0M66 55q6 5.5 12 0"
          stroke={INK}
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M55 72q5 4 10 0" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <text x="90" y="34" fontSize="14" fontWeight="700" fill="#1FA582" opacity="0.7">z</text>
        <text x="100" y="22" fontSize="10" fontWeight="700" fill="#1FA582" opacity="0.45">z</text>
      </g>
    );
  }

  if (mood === "think") {
    return (
      <g>
        {eye(48, 55)}
        {eye(72, 55)}
        {/* One brow up, one flat — the whole "hmm" lives here. */}
        <path d="M41 42q7-5 14-1.5" stroke={INK} strokeWidth="2.7" strokeLinecap="round" fill="none" />
        <path d="M65 40.5q7-2.5 14 1" stroke={INK} strokeWidth="2.7" strokeLinecap="round"
              fill="none" opacity="0.45" />
        {/* Mouth pulled off to one side. */}
        <path d="M53 73q7 2.5 13-2" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="99" cy="42" r="4.5" fill="#fff" stroke="#BCE9DB" strokeWidth="1.5" />
        <circle cx="107" cy="33" r="2.6" fill="#fff" stroke="#BCE9DB" strokeWidth="1.3" />
      </g>
    );
  }

  if (mood === "oops") {
    return (
      <g>
        {eye(48, 55, 6.8)}
        {eye(72, 55, 6.8)}
        <path
          d="M40 41q8-4 15 0M65 41q8-4 15 0"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
        <ellipse cx={CX} cy="75" rx="5.5" ry="6.5" fill={INK} />
      </g>
    );
  }

  if (mood === "happy") {
    return (
      <g>
        {/* Eyes squeezed shut — a real grin closes them. */}
        <path d="M41 56q7-8 14 0" stroke={INK} strokeWidth="3.3" strokeLinecap="round" fill="none" />
        <path d="M65 56q7-8 14 0" stroke={INK} strokeWidth="3.3" strokeLinecap="round" fill="none" />
        <path d="M50 70q10 10 20-1" stroke={INK} strokeWidth="3.1" strokeLinecap="round" fill="none" />
        <path d="M53.5 72.5q6 5 12-0.5Z" fill="#FF7E96" opacity="0.8" />
      </g>
    );
  }

  return (
    <g>
      {eye(48, 55)}
      {eye(72, 55)}
      <path d="M52 71q8 6 15-1" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>
  );
}
