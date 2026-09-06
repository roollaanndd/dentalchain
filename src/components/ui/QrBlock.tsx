import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * Renders a QR code as inline SVG.
 *
 * SVG rather than canvas so it stays crisp when a resident zooms in at the
 * gate, prints fine, and needs no ref/effect dance to appear. The encoder is
 * `qrcode-generator` — a hand-rolled Reed-Solomon implementation is exactly
 * the kind of thing that looks right and scans wrong.
 *
 * Type 0 lets the library pick the smallest version that fits; correction
 * level M survives a smudged phone screen without inflating the module count.
 */
export function QrBlock({
  value,
  size = 180,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    const parts: string[] = [];
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          // One path command per dark module; the browser merges them into a
          // single fill, which is far cheaper than one <rect> per module.
          parts.push(`M${col} ${row}h1v1h-1z`);
        }
      }
    }
    return { d: parts.join(''), count };
  }, [value]);

  // 2-module quiet zone keeps scanners happy without wasting space.
  const quiet = 2;
  const extent = path.count + quiet * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-quiet} ${-quiet} ${extent} ${extent}`}
      className={className}
      role="img"
      aria-label={`Kode QR: ${value}`}
      shapeRendering="crispEdges"
    >
      <rect x={-quiet} y={-quiet} width={extent} height={extent} fill="#ffffff" />
      <path d={path.d} fill="var(--color-wine-900, #3A0E20)" />
    </svg>
  );
}
