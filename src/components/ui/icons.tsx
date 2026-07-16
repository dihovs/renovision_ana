type IconProps = { className?: string };

const base = "h-7 w-7";

export function IconHammer({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M14.5 6.5 18 3l3 3-3.5 3.5M14.5 6.5 3 18l3 3L17.5 10M14.5 6.5l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconDroplet({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3s7 7.5 7 12a7 7 0 1 1-14 0c0-4.5 7-12 7-12Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconKitchen({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 4v6" strokeLinecap="round" />
      <circle cx="14" cy="15" r="2.4" />
    </svg>
  );
}

export function IconBuilding({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 7h1M8 11h1M8 15h1M15 7h1M15 11h1M15 15h1M10 21v-4h4v4" strokeLinecap="round" />
    </svg>
  );
}

export function IconShield({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3 4.5 5.5V11c0 5 3.2 8.4 7.5 10 4.3-1.6 7.5-5 7.5-10V5.5L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconHome({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 11 12 4l8 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClipboard({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="6" y="4" width="12" height="17" rx="1.5" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <path d="M9 11h6M9 15h6" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheckCircle({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCalendar({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9h16M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

export function IconTiles({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1" />
    </svg>
  );
}

export function IconStairs({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 20h4v-4h4v-4h4V8h4V4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20V4" strokeLinecap="round" />
    </svg>
  );
}

export function IconBrush({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M20 3s-7 5.5-9.5 8L13 13.5C15.5 11 20 3 20 3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 12.5c-1.8.3-2.6 1.4-3 2.9-.4 1.6-1 2.6-3 3.1 1.3 1.6 4.2 2.1 6 .8 1.4-1 1.9-2.6 1.5-4.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMapPin({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
  );
}

export function IconFlag({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 3v18" strokeLinecap="round" />
      <path d="M6 4h11l-2.5 4L17 12H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
