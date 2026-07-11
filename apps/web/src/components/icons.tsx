import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 20, children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true" {...props}>
      <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

export const PulseIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2.5 12h4l2-6.6 3.2 13.2 2.4-8.6 1.7 2h5.7" />
  </IconBase>
);
export const SearchIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="10.8" cy="10.8" r="6.6" />
    <path d="m16 16 4.2 4.2" />
  </IconBase>
);
export const BookmarkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6.5 3.5h11v17l-5.5-3.6-5.5 3.6z" />
  </IconBase>
);
export const SettingsIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4A2 2 0 0 0 4 9.9l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" />
  </IconBase>
);
export const ChevronDownIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
  </IconBase>
);
export const ArrowUpIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m5 15 5-5 3.2 3.2L19 7.4" />
    <path d="M14.5 7.4H19v4.5" />
  </IconBase>
);
export const ArrowDownIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m5 9 5 5 3.2-3.2 5.8 5.8" />
    <path d="M14.5 16.6H19v-4.5" />
  </IconBase>
);
export const StarIcon = ({ fill = "none", ...props }: IconProps) => (
  <IconBase {...props}>
    <path
      fill={fill}
      d="m12 3.2 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9L6.6 20l1-6.1-4.4-4.3 6.1-.9z"
    />
  </IconBase>
);
export const DownloadIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 3v12" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4 20h16" />
  </IconBase>
);
export const PlusIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 5v14M5 12h14" />
  </IconBase>
);
export const MenuIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </IconBase>
);
export const CloseIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </IconBase>
);
export const CheckIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m5 12.5 4.3 4.3L19 7" />
  </IconBase>
);
export const RefreshIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M19.5 8.5V4.8l-2 2A8 8 0 1 0 19 16" />
    <path d="M19.5 4.8h-3.7" />
  </IconBase>
);
export const CalendarIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z" />
    <path d="M7.5 2.5v4M16.5 2.5v4M3.5 9h17" />
  </IconBase>
);
export const CommandIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9 6.5V5a2.5 2.5 0 1 0-2.5 2.5H18a2.5 2.5 0 1 0-2.5-2.5v14a2.5 2.5 0 1 0 2.5-2.5H6.5A2.5 2.5 0 1 0 9 19z" />
  </IconBase>
);
