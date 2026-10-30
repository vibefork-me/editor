import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className = "", children }: IconProps & { children: ReactNode }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Files: a tree of folders. */
export function IconFilesPanel(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 2v8.5a1 1 0 0 0 1 1H7M2.5 5H7" />
      <rect x="7" y="3" width="6.5" height="4" rx="1" />
      <rect x="7" y="9.5" width="6.5" height="4" rx="1" />
    </Svg>
  );
}

/** Code: angle brackets. */
export function IconCodePanel(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 4.5-3.5 3.5L5 11.5M11 4.5l3.5 3.5-3.5 3.5M9.25 2.5l-2.5 11" />
    </Svg>
  );
}

/** Journal: a scroll. */
export function IconJournalPanel(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 5.5h5M5.5 8h5M3.5 13.5h8a2 2 0 0 0 2-2v-1h-7v1a1 1 0 0 1-2 0v-8a1.5 1.5 0 0 0-3 0v1.5h3" />
      <path d="M4.5 2h7.5a1.5 1.5 0 0 1 1.5 1.5v7" />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4.5 4.5 7 7m0-7-7 7" />
    </Svg>
  );
}

export function IconFile(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 1.75h5l3 3v9.5H4z" />
      <path d="M9 1.75v3h3" />
    </Svg>
  );
}

export function IconFolder(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M1.75 4.25v8.5h12.5v-7H7.5l-1.5-1.5z" />
    </Svg>
  );
}

/** An idea: a light bulb. */
export function IconLightbulb(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 12.25h4M6.5 14.25h3M5.25 10a4.25 4.25 0 1 1 5.5 0c-.5.45-.75.95-.75 1.5v.75H6v-.75c0-.55-.25-1.05-.75-1.5z" />
    </Svg>
  );
}

/** Links: three joined dots. */
export function IconNetwork(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="3.25" r="1.75" />
      <circle cx="3.25" cy="12.5" r="1.75" />
      <circle cx="12.75" cy="12.5" r="1.75" />
      <path d="M7.1 4.75 4.15 11M8.9 4.75 11.85 11M5 12.5h6" />
    </Svg>
  );
}

/** What happened: a pulse line. */
export function IconActivity(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.25 8h-2.5l-1.75 5.25-4-10.5L4.25 8h-2.5" />
    </Svg>
  );
}

/** Code for developers: angle brackets. */
export function IconCode(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5.5 5.5-2.5 2.5 2.5 2.5M10.5 5.5l2.5 2.5-2.5 2.5" />
    </Svg>
  );
}
