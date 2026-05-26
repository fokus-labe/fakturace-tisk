interface CropMarksProps {
  className?: string;
  color?: string;
  size?: number;
  thickness?: number;
}

/**
 * 4 rohové crop marks (tiskárenský brand prvek Fokus tisk).
 * Použít uvnitř relative parent containeru.
 */
export function CropMarks({
  className = "",
  color = "currentColor",
  size = 16,
  thickness = 1,
}: CropMarksProps) {
  const lineStyle = {
    backgroundColor: color,
    position: "absolute" as const,
  };

  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      {/* Top-left */}
      <div
        style={{ ...lineStyle, top: 0, left: 0, width: size, height: thickness }}
      />
      <div
        style={{ ...lineStyle, top: 0, left: 0, width: thickness, height: size }}
      />

      {/* Top-right */}
      <div
        style={{ ...lineStyle, top: 0, right: 0, width: size, height: thickness }}
      />
      <div
        style={{ ...lineStyle, top: 0, right: 0, width: thickness, height: size }}
      />

      {/* Bottom-left */}
      <div
        style={{
          ...lineStyle,
          bottom: 0,
          left: 0,
          width: size,
          height: thickness,
        }}
      />
      <div
        style={{
          ...lineStyle,
          bottom: 0,
          left: 0,
          width: thickness,
          height: size,
        }}
      />

      {/* Bottom-right */}
      <div
        style={{
          ...lineStyle,
          bottom: 0,
          right: 0,
          width: size,
          height: thickness,
        }}
      />
      <div
        style={{
          ...lineStyle,
          bottom: 0,
          right: 0,
          width: thickness,
          height: size,
        }}
      />
    </div>
  );
}
