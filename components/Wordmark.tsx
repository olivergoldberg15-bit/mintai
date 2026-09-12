"use client";

/**
 * tutor mint — "tutor" in black, "mint" in green, and the dot of the i
 * replaced by a mint leaf.
 *
 * The i is the dotless Turkish ı (U+0131), so the leaf is the only dot on it.
 * Everything is sized in em, so the mark scales from a 16px header to a
 * splash screen without the leaf drifting off the stem.
 */
export default function Wordmark({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`wordmark ${className}`}
      style={{ fontSize: size }}
      role="img"
      aria-label="tutor mint"
    >
      <span className="wm-tutor" aria-hidden="true">tutor</span>
      <span className="wm-mint" aria-hidden="true">
        m
        <span className="wm-i">
          {"ı"}
          <Leaf />
        </span>
        nt
      </span>
    </span>
  );
}

function Leaf() {
  return (
    <svg className="wm-leaf" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* leaf body */}
      <path
        d="M12.4 1.8c5.6 1.9 9.2 6.3 9.2 11.1 0 5.2-4.2 8.9-9.4 8.9-5 0-8.8-3.5-8.8-8.4 0-5.6 4.3-9.9 9-11.6Z"
        fill="currentColor"
      />
      {/* midrib, knocked out so it reads as a leaf at small sizes */}
      <path
        d="M12.2 20.4c-1.1-4.6-.8-10.2 1.1-16.6"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}
