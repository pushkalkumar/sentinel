// Part registry. Geometry is authored in millimetres; `mm()` converts to scene units (1 unit = 40 mm, DESIGN_V2 §5).
// Costs are spec §4.1's 1k column, split where the BOM lumps parts.
export type Vec3 = readonly [number, number, number]

export const MM = 1 / 40
export const mm = (v: number) => v * MM
export const mm3 = (v: Vec3): Vec3 => [v[0] * MM, v[1] * MM, v[2] * MM]

export type PartId =
  | 'solar' | 'lid' | 'led' | 'antenna' | 'pms5003' | 'mq2' | 'bme280'
  | 'esp32s3' | 'sx1262' | 'cell18650' | 'power' | 'buzzer' | 'button'
  | 'pcb' | 'tray'

export interface Part {
  id: PartId
  /** Order in the rail list; 0 = structural (pcb, tray), listed last and labelled only on hover. */
  index: number
  name: string
  spec: string
  role: string
  cost1k: number
  costNote?: string
  /** Rest position in mm; y is the part's local origin height above the tray floor. */
  rest: Vec3
  /** Vertical lift at full explode, in scene units. The tray stays on the ground, everything else rises. */
  lift: number
  /** 0..0.3 cascade delay: the top of the stack opens first. */
  delay: number
  /** Leader-line anchor in the part's local mm space. */
  anchor: Vec3
  bus?: string
}

/** Enclosure envelope, mm. */
export const BOX = { w: 142, d: 92, trayH: 50, lidH: 12, wall: 2.2, floor: 3, cornerR: 5 } as const
export const PCB_MM = { w: 130, d: 80, t: 1.6, y: 25 } as const
const TOP = PCB_MM.y + PCB_MM.t

export const PART_REGISTRY: readonly Part[] = [
  {
    id: 'solar', index: 1, name: '6 V 2 W solar panel',
    spec: '120 × 70 mm mono cell, 6 V, 2 W peak',
    role: 'Keeps an outdoor node alive indefinitely in Seattle summer and fall. Indoor nodes skip it and run on USB.',
    cost1k: 2.60,
    rest: [0, BOX.trayH + BOX.lidH - 1, 0], lift: 2.8, delay: 0.0, anchor: [-60, 3, -20],
  },
  {
    id: 'lid', index: 2, name: 'IP65 lid',
    spec: 'Polycarbonate, 142 × 92 × 12 mm, gasketed, 4 captive screws',
    role: 'Weather seal. The LED dome and the panel sit on it; everything else lives below.',
    cost1k: 2.20, costNote: 'includes tray and wall mount',
    rest: [0, BOX.trayH, 0], lift: 2.4, delay: 0.04, anchor: [71, 6, 10],
  },
  {
    id: 'antenna', index: 3, name: '915 MHz helical antenna',
    spec: 'Spring helical, 22 mm, 2 dBi, on an SMA jack',
    role: 'The mesh radio\'s antenna. Vertical inside the lid so the box has no external stub to snap off.',
    cost1k: 0.90, bus: 'RF',
    rest: [-37, TOP + 7.5, 12], lift: 1.8, delay: 0.10, anchor: [-3, 20, 0],
  },
  {
    id: 'pms5003', index: 4, name: 'PMS5003 particulate sensor',
    spec: 'Laser scattering, PM1 / PM2.5 / PM10, 50 × 38 × 21 mm, 5 V fan',
    role: 'The smoke sensor. Fan runs 30 s every 5 min in normal mode, continuously during an alert.',
    cost1k: 9.00, bus: 'UART2 · GPIO16/17 · SET GPIO4',
    rest: [47, TOP, -12], lift: 1.8, delay: 0.10, anchor: [19, 18, -10],
  },
  {
    id: 'mq2', index: 5, name: 'MQ-2 gas sensor',
    spec: 'Tin-oxide heater, ø 18 × 17 mm, 150 mA when hot, 20 s warm-up',
    role: 'Combustible gas and smoke confirmation. Cheap and unselective; the spec says so. Duty-cycled 10 s per minute.',
    cost1k: 0.60, bus: 'ADC · GPIO34 via 2:1 divider',
    rest: [47, TOP, 28], lift: 1.8, delay: 0.12, anchor: [8, 14, 4],
  },
  {
    id: 'bme280', index: 6, name: 'BME280 temp / RH / pressure',
    spec: '2.5 × 2.5 mm LGA on a 10 × 12 mm breakout, I²C 0x76',
    role: 'Heat rise is what separates a fire from smoke rolling in from outside. Read every 60 s.',
    cost1k: 0.90, bus: 'I²C · SDA GPIO21 · SCL GPIO22',
    rest: [20, TOP, 31], lift: 1.8, delay: 0.12, anchor: [5, 3, 6],
  },
  {
    id: 'esp32s3', index: 7, name: 'ESP32-S3-WROOM-1',
    spec: 'Dual-core 240 MHz, WiFi AP + BLE, 8 MB flash, 18 × 25.5 mm',
    role: 'Runs the captive portal, the local alert rules, and the mesh queue. The whole product is this chip.',
    cost1k: 3.20,
    rest: [-45, TOP, -22], lift: 1.52, delay: 0.14, anchor: [-9, 3, -8],
  },
  {
    id: 'sx1262', index: 8, name: 'SX1262 LoRa module',
    spec: '915 MHz, +22 dBm, SF9 / BW125, SPI, 24 × 14 mm with SMA',
    role: 'Node-to-node relay. 300 to 600 m through buildings, 1 to 2 km with line of sight, further by hopping.',
    cost1k: 3.90, bus: 'SPI · NSS 5 · DIO1 26 · RST 14 · BUSY 27',
    rest: [-45, TOP, 12], lift: 1.52, delay: 0.14, anchor: [-12, 2, 4],
  },
  {
    id: 'cell18650', index: 9, name: '18650 Li-ion cell + holder',
    spec: '3400 mAh, 3.6 V nominal, ø 18 × 65 mm',
    role: '3 days in normal mode with no sun; 12 to 18 h in full disaster mode with the AP and sensors on.',
    cost1k: 2.80,
    rest: [-22, BOX.floor, 18], lift: 0.6, delay: 0.22, anchor: [-30, 12, 8],
  },
  {
    id: 'power', index: 10, name: 'Charger + protection + 5 V boost',
    spec: 'TP4056, DW01 + FS8205, MT3608, P-MOSFET rail switch, USB-C in',
    role: 'Solar or USB in, protected battery out, 3.3 V for logic, switched 5 V for the fan and heater.',
    cost1k: 0.80, bus: '5V_EN GPIO33 · VBAT sense GPIO35',
    rest: [-6, TOP, -24], lift: 1.52, delay: 0.14, anchor: [0, 6, -14],
  },
  {
    id: 'buzzer', index: 11, name: 'Piezo buzzer',
    spec: 'ø 12 mm, 85 dB at 10 cm, PWM driven',
    role: 'Local alarm. Fires from the node\'s own rules even with no backend and no neighbours.',
    cost1k: 0.10, bus: 'PWM · GPIO25',
    rest: [2, TOP, 6], lift: 1.52, delay: 0.16, anchor: [6, 4, 0],
  },
  {
    id: 'led', index: 12, name: 'WS2812 status LED + light pipe',
    spec: 'One addressable RGB pixel under a frosted dome',
    role: 'Green, amber, red at a glance. Red plus buzzer is the local alarm.',
    cost1k: 0.10, bus: 'GPIO2',
    rest: [-6, TOP, 32], lift: 1.52, delay: 0.16, anchor: [-3, 26, 0],
  },
  {
    id: 'button', index: 13, name: '"I\'m here" button',
    spec: 'Sealed 16 mm dome, front wall, debounced in firmware',
    role: 'Muster-point check-in and wake-from-sleep. Pressing it also brings the WiFi AP fully up.',
    cost1k: 0.10, bus: 'GPIO0, pull-down',
    rest: [-42, 24, BOX.d / 2], lift: 0, delay: 0.0, anchor: [-8, 0, 4],
  },
  {
    id: 'pcb', index: 0, name: 'Main PCB',
    spec: '130 × 80 mm, 2-layer, passives, connectors, MOSFETs',
    role: 'Carries everything. Counted as "PCB, passives, connectors" in the BOM.',
    cost1k: 1.10,
    rest: [0, PCB_MM.y, 0], lift: 1.3, delay: 0.2, anchor: [62, 0, 30],
  },
  {
    id: 'tray', index: 0, name: 'IP65 enclosure tray',
    spec: 'Vented sensor chamber on the right, sealed electronics bay on the left',
    role: 'Wall mount. Vent slots feed the PMS5003 intake; a low rib keeps the fan out of the radio bay.',
    cost1k: 0, costNote: 'counted with the lid',
    rest: [0, 0, 0], lift: 0, delay: 0.0, anchor: [-71, 30, 20],
  },
]

export const ASSEMBLY_COST_1K = 2.50
export const BOM_TOTAL_1K = PART_REGISTRY.reduce((s, p) => s + p.cost1k, 0) + ASSEMBLY_COST_1K

export const PART_BY_ID: Record<PartId, Part> = Object.fromEntries(PART_REGISTRY.map((p) => [p.id, p])) as Record<PartId, Part>

/** Parts that carry a label and a rail row, in rail order. */
export const NUMBERED_PARTS: readonly Part[] = [...PART_REGISTRY].filter((p) => p.index > 0).sort((a, b) => a.index - b.index)

export const isPartId = (v: string | null | undefined): v is PartId => !!v && v in PART_BY_ID

/** Camera framing: the target rises and the camera backs off as the stack opens. */
export const FRAME = {
  /** Rest view direction: front-right, about 24° above the horizon (unnormalised). */
  dir: [3.2, 1.9, 3.6] as Vec3,
  targetY: { rest: 0.78, exploded: 2.2 },
  distance: { rest: 9.6, exploded: 11.4 },
  /** Stage aspect the distances were tuned for. */
  aspect: 4 / 3,
} as const
