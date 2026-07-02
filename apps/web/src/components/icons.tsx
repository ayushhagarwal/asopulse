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
    <path
      d="M19 13.7v-3.4l-2-.7a7 7 0 0 0-.7-1.6l.9-1.9-2.4-2.4-1.9.9a7 7 0 0 0-1.6-.7l-.7-2H7.2l-.7 2a7 7 0 0 0-1.6.7L3 3.7.6 6.1 1.5 8a7 7 0 0 0-.7 1.6l-2 .7v3.4l2 .7a7 7 0 0 0 .7 1.6l-.9 1.9L3 20.3l1.9-.9a7 7 0 0 0 1.6.7l.7 2h3.4l.7-2a7 7 0 0 0 1.6-.7l1.9.9 2.4-2.4-.9-1.9a7 7 0 0 0 .7-1.6z"
      transform="translate(2) scale(.83)"
    />
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
export const CommandIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9 6.5V5a2.5 2.5 0 1 0-2.5 2.5H18a2.5 2.5 0 1 0-2.5-2.5v14a2.5 2.5 0 1 0 2.5-2.5H6.5A2.5 2.5 0 1 0 9 19z" />
  </IconBase>
);
