/** 인라인 SVG 아이콘 — currentColor, 장식이면 aria-hidden. 이모지는 아이콘으로 쓰지 않는다. */
type P = { title?: string };
const base = (title?: string) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  role: title ? 'img' : undefined,
  'aria-label': title,
});

export const IconHome = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
  </svg>
);
export const IconChart = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />
  </svg>
);
export const IconScan = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <path d="M8 8h3v3H8zM13 13h3v3h-3zM13 8h3M8 13v3h3" />
  </svg>
);
export const IconTarget = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </svg>
);
export const IconTicket = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M4 7a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z" />
    <path d="M9 9.5h6M9 14.5h4" />
  </svg>
);
export const IconSun = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </svg>
);
export const IconMoon = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);
export const IconCalendar = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16M12 13v4M10 15h4" />
  </svg>
);
export const IconImage = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <circle cx="9" cy="9" r="1.6" />
    <path d="m20 15-4.5-4.5L6 20" />
  </svg>
);
export const IconLink = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);
export const IconGrid = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <rect x="14" y="14" width="6" height="6" rx="1" />
  </svg>
);
export const IconClose = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconDownload = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />
  </svg>
);
export const IconUpload = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 20h14" />
  </svg>
);
export const IconTrash = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
  </svg>
);
export const IconPlus = ({ title }: P) => (
  <svg {...base(title)} aria-hidden={title ? undefined : true}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** 로고: 안료로 찍은 둥근 인장 (테마 색을 따름) */
export const Logo = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="var(--accent)" />
    <circle cx="32" cy="32" r="25" fill="none" stroke="var(--accent-ink)" strokeWidth="1.5" />
    <text x="32" y="41" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fontWeight="800" fontSize="24" letterSpacing="-1" textAnchor="middle" fill="var(--accent-ink)">
      45
    </text>
  </svg>
);
