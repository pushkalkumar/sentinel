// Static floor plan for site 2 (Harbor Island DC-4). Two racks at y≈180 and y≈430, dock office bottom-left.
const STROKE = 'var(--color-line)'

function rackTicks(y: number, from: number, to: number, step: number): string {
  const d: string[] = []
  for (let x = from; x <= to; x += step) d.push(`M${x} ${y - 30} V${y + 30}`)
  return d.join(' ')
}

export function FloorplanGround() {
  return (
    <g stroke={STROKE} strokeWidth={0.75} fill="none" aria-hidden data-ground="floorplan">
      {/* outer wall */}
      <rect x={30} y={30} width={940} height={640} />
      {/* sprinkler riser room, north-west corner */}
      <rect x={40} y={40} width={70} height={60} />
      {/* Aisle A rack */}
      <rect x={200} y={150} width={640} height={60} />
      <path d={rackTicks(180, 240, 800, 40)} strokeDasharray="1 3" />
      {/* Aisle B rack */}
      <rect x={260} y={400} width={520} height={60} />
      <path d={rackTicks(430, 300, 740, 40)} strokeDasharray="1 3" />
      {/* dock office */}
      <rect x={60} y={560} width={140} height={100} />
      <rect x={60} y={560} width={140} height={24} />
      {/* dock doors along the south wall */}
      <path d="M260 670 V650 H340 V670 M380 670 V650 H460 V670 M500 670 V650 H580 V670 M620 670 V650 H700 V670 M740 670 V650 H820 V670" />
      {/* truck gate, east */}
      <path d="M970 520 H950 V600 H970" strokeDasharray="4 8" />
      {/* aisle centre lines */}
      <path d="M200 300 H840 M200 550 H840" strokeDasharray="2 10" />
    </g>
  )
}
