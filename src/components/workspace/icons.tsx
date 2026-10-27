import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className = "", children }: IconProps & { children: ReactNode }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Files: a panel on the left. */
export function IconFilesPanel(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="1.5" />
      <path d="M5.75 2.25v11.5" />
    </Svg>
  );
}

/** Code: a panel on the right. */
export function IconCodePanel(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="1.5" />
      <path d="M9.75 2.25v11.5" />
    </Svg>
  );
}

/** Journal: a panel at the bottom. */
export function IconJournalPanel(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="1.5" />
      <path d="M1.75 9.75h12.5" />
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
