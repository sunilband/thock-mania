/**
 * Thock Mania mark — a single mechanical keycap emitting sound waves (the
 * "thock"). Reads --primary / --kb-dark / --kb-light live so it re-tints with
 * the active keyboard theme, exactly like the rest of the UI.
 */
export function ThockManiaLogo({
  className,
  size = 22,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      {/* Soft drop shadow under the keycap */}
      <rect
        fill="black"
        fillOpacity="0.08"
        height="19"
        rx="4.5"
        width="18"
        x="3"
        y="11"
      />
      {/* Keycap body / skirt */}
      <rect
        height="19"
        rx="4.5"
        style={{ fill: "var(--kb-dark, var(--muted))" }}
        width="18"
        x="3"
        y="9"
      />
      {/* Keycap top face — the accent pop */}
      <rect
        height="13"
        rx="3"
        style={{ fill: "var(--primary)" }}
        width="13"
        x="5.5"
        y="6.5"
      />
      {/* Specular highlight across the top face */}
      <rect
        fill="white"
        fillOpacity="0.3"
        height="2.5"
        rx="1.25"
        width="10"
        x="7"
        y="8"
      />
      {/* Sound waves — the "thock" radiating to the right */}
      <path
        d="M22.5 11.5 Q26 16 22.5 20.5"
        strokeLinecap="round"
        strokeWidth="2.1"
        style={{ stroke: "var(--primary)" }}
      />
      <path
        d="M25.5 8.5 Q31 16 25.5 23.5"
        strokeLinecap="round"
        strokeOpacity="0.55"
        strokeWidth="2.1"
        style={{ stroke: "var(--primary)" }}
      />
    </svg>
  );
}
