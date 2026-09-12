// Static footprints for site 1 (CONTRACT §1.2 coordinates). 1px line-faint outlines, no fills, no labels.
const STROKE = 'var(--color-line-faint)'

export function CampusGround() {
  return (
    <g stroke={STROKE} strokeWidth={1} fill="none" aria-hidden data-ground="campus">
      {/* walkways */}
      <path d="M500 160 L500 300 M360 200 L420 200 L420 300 M640 210 L560 210 L540 300 M480 360 L480 490 M280 400 L420 400 M690 400 L540 400 M240 600 L350 600 L350 560" strokeDasharray="1 3" />
      {/* Main Hall (gateway) */}
      <rect x={400} y={80} width={200} height={80} />
      <rect x={470} y={160} width={60} height={16} />
      {/* Library */}
      <rect x={240} y={165} width={120} height={70} />
      <rect x={240} y={235} width={50} height={24} />
      {/* Science Wing */}
      <path d="M640 170 H780 V250 H720 V230 H640 Z" />
      {/* Cafeteria */}
      <rect x={420} y={300} width={120} height={60} />
      {/* Arts Building */}
      <rect x={160} y={365} width={120} height={70} />
      <rect x={280} y={385} width={28} height={30} />
      {/* Gymnasium */}
      <rect x={690} y={355} width={140} height={90} />
      <rect x={830} y={385} width={18} height={30} />
      {/* Athletic Field: track plus infield */}
      <ellipse cx={520} cy={560} rx={170} ry={72} />
      <ellipse cx={520} cy={560} rx={130} ry={44} />
      <line x1={520} y1={516} x2={520} y2={604} />
      {/* South Lot */}
      <rect x={80} y={560} width={160} height={80} />
      <path d="M100 560 V600 M120 560 V600 M140 560 V600 M160 560 V600 M180 560 V600 M200 560 V600 M220 560 V600" />
      <path d="M100 640 V600 M120 640 V600 M140 640 V600 M160 640 V600 M180 640 V600 M200 640 V600 M220 640 V600" strokeDasharray="1 3" />
      {/* site boundary */}
      <rect x={40} y={40} width={920} height={620} strokeDasharray="4 8" />
    </g>
  )
}
