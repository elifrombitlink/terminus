// Label-vector insignia: barcodes, hazard-stripe dividers, registration marks.
// Deterministic so a given seed always renders the same bars — no layout churn.

function seedFrom(value: string): () => number {
  let seed = 0;
  for (let i = 0; i < value.length; i += 1) {
    seed = (seed * 31 + value.charCodeAt(i)) >>> 0;
  }
  if (seed === 0) seed = 0x1a2b3c;
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

type BarcodeProps = {
  /** Seed + printed code under the bars. */
  value?: string;
  /** Number of bars — longer strips for footers, short for label caps. */
  bars?: number;
  /** Bar height in px. */
  height?: number;
  /** Hide the printed code line. */
  code?: boolean;
  className?: string;
};

// A Code128-flavoured barcode. Not scannable — decorative telemetry.
export function Barcode({
  value = "RAAVH74-MCK",
  bars = 44,
  height = 22,
  code = true,
  className,
}: BarcodeProps) {
  const rand = seedFrom(value);
  const strokes = Array.from({ length: bars }, () => ({
    width: 1 + Math.floor(rand() * 3),
    gap: 1 + Math.floor(rand() * 3),
  }));

  return (
    <div
      className={`barcode${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <div className="barcode-bars" style={{ height }}>
        {strokes.map((stroke, index) => (
          <span
            key={index}
            style={{ width: stroke.width, marginRight: stroke.gap }}
          />
        ))}
      </div>
      {code && <span className="barcode-code">{value}</span>}
    </div>
  );
}

type HazardBarProps = {
  /** Optional stamp set into the stripe run. */
  label?: string;
  className?: string;
};

// The ////////// divider — diagonal hazard stripes flanking an optional stamp.
export function HazardBar({ label, className }: HazardBarProps) {
  return (
    <div
      className={`hazard-bar${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <span className="hazard-stripes" />
      {label && <span className="hazard-stamp">{label}</span>}
      <span className="hazard-stripes" />
    </div>
  );
}

// Tight cluster of registration / control marks, e.g. © ⊕ ⊗ ⌗.
export function RegMarks({ marks = "⊕ ⊗ ⌖ ©" }: { marks?: string }) {
  return (
    <span className="reg-marks" aria-hidden="true">
      {marks}
    </span>
  );
}
