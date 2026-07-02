export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo" aria-label="ASOpulse">
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M2 17h7l2.7-11 4.5 21 3.3-14 2.2 4H30" />
        <circle cx="12" cy="6" r="2.4" />
      </svg>
      {compact ? null : (
        <span>
          ASO<strong>pulse</strong>
        </span>
      )}
    </div>
  );
}
