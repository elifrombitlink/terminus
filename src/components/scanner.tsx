type ScannerProps = {
  /** Short label under the dial, e.g. the operating node. */
  node?: string;
  /** Left readout cap. */
  left?: string;
  /** Right readout cap. */
  right?: string;
};

// Constellation-style scanner dial: a ticked bearing ring around a wireframe
// planet with a slow scan sweep. Decorative telemetry, mapped to Terminus.
export function Scanner({
  node = "TERM-01",
  left = "RDY",
  right = "HOLD",
}: ScannerProps) {
  const ticks = Array.from({ length: 60 }, (_, index) => {
    const major = index % 5 === 0;
    const angle = (index / 60) * Math.PI * 2;
    const outer = 112;
    const inner = major ? 98 : 104;
    const cx = 120;
    const cy = 120;
    return (
      <line
        key={index}
        className={major ? "dial-tick major" : "dial-tick"}
        x1={cx + Math.sin(angle) * outer}
        y1={cy - Math.cos(angle) * outer}
        x2={cx + Math.sin(angle) * inner}
        y2={cy - Math.cos(angle) * inner}
      />
    );
  });

  return (
    <div className="scanner" aria-hidden="true">
      <svg viewBox="0 0 240 240" className="scanner-dial" role="presentation">
        <circle className="dial-ring" cx="120" cy="120" r="112" />
        <circle className="dial-ring-inner" cx="120" cy="120" r="90" />
        {ticks}
        <g className="dial-planet">
          <circle cx="120" cy="120" r="58" />
          <ellipse cx="120" cy="120" rx="58" ry="20" />
          <ellipse cx="120" cy="120" rx="58" ry="42" />
          <ellipse cx="120" cy="120" rx="30" ry="58" />
          <path d="M64 108 q56 -22 112 0" />
          <path d="M66 134 q54 20 108 0" />
        </g>
        <line className="dial-sweep" x1="120" y1="120" x2="120" y2="30" />
        <path className="dial-north" d="M120 8 l7 13 h-14 z" />
      </svg>
      <span className="scanner-cap left">{left}</span>
      <span className="scanner-cap right">{right}</span>
      <span className="scanner-node">{node}</span>
    </div>
  );
}
