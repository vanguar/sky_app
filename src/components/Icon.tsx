/** Minimal original line icons (24×24, stroke = currentColor). */
const PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  search: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20',
  settings:
    'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 2.8l1.6 2.3 2.7-.7.7 2.7 2.3 1.6-1.2 2.4 1.2 2.4-2.3 1.6-.7 2.7-2.7-.7L12 21.2l-1.6-2.3-2.7.7-.7-2.7-2.3-1.6 1.2-2.4-1.2-2.4 2.3-1.6.7-2.7 2.7.7z',
  close: 'M6 6l12 12M18 6 6 18',
  layers: 'M12 4 3 9l9 5 9-5-9-5zM3 14l9 5 9-5',
  phone:
    'M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3zM11 18h2',
  compass: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  pin: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  arrow: 'M12 4l7 8h-4.5v8h-5v-8H5z',
  cube: 'M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9',
  target: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v6M12 7.5v.5',
  back: 'M15 5l-7 7 7 7',
  globe:
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  stop: 'M7 7h10v10H7z',
  cloud: 'M7 18.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.8 4.35 4.35 0 0 0 7 18.5z',
  meteor: 'M3 3l10.5 10.5M8.5 3.5l6 6M3.5 8.5l6 6M17 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  tonight: 'M16 15.8A7 7 0 0 1 8.2 5a7.2 7.2 0 1 0 9.8 9.8zM18 3v4M16 5h4',
  radiant: 'M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
