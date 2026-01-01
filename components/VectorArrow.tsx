
import React from 'react';

interface VectorArrowProps {
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  color: string;
  label: string;
  scale?: number;
  labelOffset?: number; // New prop to stack labels
}

const VectorArrow: React.FC<VectorArrowProps> = ({ 
  startX, startY, vx, vy, color, label, scale = 1, labelOffset = 0 
}) => {
  const endX = startX + vx * scale;
  const endY = startY - vy * scale; // SVG y is inverted

  // Don't draw tiny vectors
  if (Math.abs(vx * scale) < 2 && Math.abs(vy * scale) < 2) return null;

  // Generate a unique ID for the marker based on the color to avoid collision
  const markerId = `arrowhead-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <g>
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={color} />
        </marker>
      </defs>
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={color}
        strokeWidth="2.5"
        markerEnd={`url(#${markerId})`}
        strokeLinecap="round"
      />
      {label && (
        <text
          x={endX + 8}
          y={endY + (labelOffset * 12)}
          fill={color}
          className="text-[11px] font-bold select-none drop-shadow-sm"
          style={{ paintOrder: 'stroke', stroke: 'rgba(15, 23, 42, 0.8)', strokeWidth: '2px' }}
        >
          {label}
        </text>
      )}
    </g>
  );
};

export default VectorArrow;
