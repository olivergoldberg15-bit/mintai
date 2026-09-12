"use client";

/**
 * Sprig — the mint leaf. Shaded like a real leaf (midrib, veins, gloss,
 * translucent edge) with a face on top, which is what makes him funny rather
 * than cute-by-default.
 */

export type Mood = "idle" | "think" | "happy" | "oops" | "sleep";

export default function Mascot({
  mood = "idle",
  size = 84,
}: {
  mood?: Mood;
  size?: number;
}) {
  const id = `sprig-${mood}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Sprig the mint leaf"
      style={{ overflow: "visible", flex: "none" }}
    >
      <defs>
        <linearGradient id={`${id}-leaf`} x1="22%" y1="6%" x2="82%" y2="96%">
          <stop offset="0%" stopColor="#7FE3C2" />
          <stop offset="46%" stopColor="#3FC79F" />
          <stop offset="100%" stopColor="#169B78" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0%" y1="0%" x2="70%" y2="80%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.62" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-shade`} cx="72%" cy="82%" r="58%">
          <stop offset="0%" stopColor="#0B7259" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#0B7259" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0B7259" floodOpacity="0.26" />
        </filter>
      </defs>

      <ellipse cx="62" cy="110" rx="27" ry="5" fill="#0B7259" opacity="0.13" />

      {/* stem */}
      <path
        d="M60 96c-1-9 .4-16 3-21"
        stroke="#1B8A6B"
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />

      <g filter={`url(#${id}-soft)`}>
        {/* leaf body — asymmetric, with the tip curling right */}
        <path
          d="M63 16c19 6 33 22 33 41 0 21-16 37-36 37-19 0-34-14-34-33 0-22 17-39 37-45Z"
          fill={`url(#${id}-leaf)`}
        />
        <path
          d="M63 16c19 6 33 22 33 41 0 21-16 37-36 37-19 0-34-14-34-33 0-22 17-39 37-45Z"
          fill={`url(#${id}-shade)`}
        />

        {/* serrated edge — small scallops read as "mint" at a glance */}
        <path
          d="M63 16c19 6 33 22 33 41 0 21-16 37-36 37-19 0-34-14-34-33 0-22 17-39 37-45Z"
          fill="none"
          stroke="#0F8A6B"
          strokeWidth="2"
          strokeOpacity="0.5"
          strokeDasharray="5 6"
        />

        {/* midrib + veins */}
        <path
          d="M62 92c-4-18-3-39 4-64"
          stroke="#0F8A6B"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeOpacity="0.55"
          fill="none"
        />
        {[
          "M62 78c8 1 15-3 20-10",
          "M61 66c9 0 17-5 22-13",
          "M62 54c8-1 15-6 19-14",
          "M60 80c-8 0-14-4-18-10",
          "M60 68c-9-1-15-5-18-12",
        ].map((d, i) => (
          <path
            key={i}
            d={d}
            stroke="#0F8A6B"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeOpacity="0.34"
            fill="none"
          />
        ))}

        <path
          d="M63 16c19 6 33 22 33 41 0 21-16 37-36 37-19 0-34-14-34-33 0-22 17-39 37-45Z"
          fill={`url(#${id}-gloss)`}
        />
      </g>

      <Face mood={mood} id={id} />
    </svg>
  );
}

function Face({ mood, id }: { mood: Mood; id: string }) {
  const blush = (
    <>
      <ellipse cx="41" cy="66" rx="6.5" ry="4" fill="#FF8FA8" opacity="0.4" />
      <ellipse cx="79" cy="64" rx="6.5" ry="4" fill="#FF8FA8" opacity="0.4" />
    </>
  );

  // Eye with a highlight — the highlight is what stops him looking dead.
  const eye = (cx: number, cy: number, r = 6.4) => (
    <g key={`${cx}-${cy}`}>
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.12} fill="#0D2B23" />
      <circle cx={cx + r * 0.34} cy={cy - r * 0.42} r={r * 0.36} fill="#fff" />
      <circle cx={cx - r * 0.3} cy={cy + r * 0.4} r={r * 0.17} fill="#fff" opacity="0.65" />
    </g>
  );

  if (mood === "sleep") {
    return (
      <g>
        <path d="M42 58q5.5 5 11 0M69 56q5.5 5 11 0" stroke="#0D2B23" strokeWidth="2.8"
              strokeLinecap="round" fill="none" />
        <path d="M56 73q5 4.5 10 0" stroke="#0D2B23" strokeWidth="2.6"
              strokeLinecap="round" fill="none" />
        <text x="92" y="34" fontSize="15" fontWeight="700" fill="#24B48F" opacity="0.75">z</text>
        <text x="102" y="22" fontSize="11" fontWeight="700" fill="#24B48F" opacity="0.5">z</text>
      </g>
    );
  }

  if (mood === "think") {
    return (
      <g>
        {eye(47, 57)}
        {eye(74, 55, 6.4)}
        {/* one raised brow — the "hmm" */}
        <path d="M40 44q7-5 14-1.5" stroke="#0D2B23" strokeWidth="2.8"
              strokeLinecap="round" fill="none" />
        <path d="M68 42q7-3 14 1" stroke="#0D2B23" strokeWidth="2.8"
              strokeLinecap="round" fill="none" opacity="0.45" />
        {/* mouth pulled to one side */}
        <path d="M53 74q7 2.5 13-2" stroke="#0D2B23" strokeWidth="3"
              strokeLinecap="round" fill="none" />
        <circle cx="102" cy="40" r="4.5" fill="#fff" stroke="#BEEBDD" strokeWidth="1.5" />
        <circle cx="110" cy="31" r="2.6" fill="#fff" stroke="#BEEBDD" strokeWidth="1.3" />
      </g>
    );
  }

  if (mood === "oops") {
    return (
      <g>
        {eye(47, 57, 7)}
        {eye(75, 55, 7)}
        <path d="M39 43q8-4 15 0M67 41q8-4 15 0" stroke="#0D2B23" strokeWidth="2.6"
              strokeLinecap="round" fill="none" opacity="0.5" />
        <ellipse cx="60" cy="76" rx="6" ry="7" fill="#0D2B23" />
        {blush}
      </g>
    );
  }

  if (mood === "happy") {
    return (
      <g>
        {/* closed happy arcs */}
        <path d="M40 58q7-8 14 0" stroke="#0D2B23" strokeWidth="3.4"
              strokeLinecap="round" fill="none" />
        <path d="M68 56q7-8 14 0" stroke="#0D2B23" strokeWidth="3.4"
              strokeLinecap="round" fill="none" />
        <path d="M50 70q10 10 20 -1" stroke="#0D2B23" strokeWidth="3.2"
              strokeLinecap="round" fill="none" />
        <path d="M53.5 72.5q6 5 12 -0.5Z" fill="#FF7E96" opacity="0.85" />
        {blush}
      </g>
    );
  }

  return (
    <g>
      {eye(47, 57)}
      {eye(74, 55)}
      <path d="M52 72q8 6 15 -1" stroke="#0D2B23" strokeWidth="3.1"
            strokeLinecap="round" fill="none" />
      {blush}
    </g>
  );
}
