/** Line icons, iOS weight. One place so stroke widths stay consistent. */

type P = { className?: string };
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const ScanIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);

export const ChatIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.4-4.2A7.5 7.5 0 1 1 20 11.5Z" />
  </svg>
);

export const VoiceIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </svg>
);

export const StudyIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.75 1.75 0 0 0-1.75-1.75H5.5A1.5 1.5 0 0 1 4 15.75Z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.75 1.75 0 0 1 1.75-1.75h4.75A1.5 1.5 0 0 0 20 15.75Z" />
  </svg>
);

export const YouIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const CameraIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-2h8.4l1.1 2h2.2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" />
    <circle cx="12" cy="13" r="3.4" />
  </svg>
);

export const ImageIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="m3.5 17 4.8-4.3a1.6 1.6 0 0 1 2.2 0l3.3 3 1.9-1.7a1.6 1.6 0 0 1 2.2 0l2.6 2.4" />
  </svg>
);

export const SendIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="m4 12 16-7.5L15.5 20l-3.6-6.4L4 12Z" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base} strokeWidth={2.6} {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const BackIcon = (p: P) => (
  <svg {...base} strokeWidth={2.1} {...p}>
    <path d="M14.5 5 8 12l6.5 7" />
  </svg>
);

export const PlayIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M8 5.5v13l11-6.5Z" />
  </svg>
);

export const StopIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
  </svg>
);

export const TrashIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5M6.5 6.5l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
  </svg>
);

export const VideoIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="3.5" />
    <path d="M10 9.2v5.6l4.8-2.8Z" />
  </svg>
);

export const CalcIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4" y="2.5" width="16" height="19" rx="3" />
    <path d="M7.5 7h9M8 12h.01M12 12h.01M16 12h.01M8 16.5h.01M12 16.5h.01M16 16.5h.01" />
  </svg>
);

export const GoogleIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...p}>
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.35Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.83V7.5H3.06a10 10 0 0 0 0 9l3.35-2.58Z" />
    <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.98 14.7 2 12 2a10 10 0 0 0-8.94 5.5l3.35 2.59C7.2 7.72 9.4 5.95 12 5.95Z" />
  </svg>
);
