import { ChevronRight } from 'lucide-react'

/** spec §3.2, ESP32 DevKit numbering; S3 remap pending (see schematic footnote). */
const PINS: [string, string, string, string][] = [
  ['PMS5003', 'TX → RX', 'GPIO16 (UART2 RX)', '5 V supply, 3.3 V logic OK'],
  ['PMS5003', 'RX ← TX', 'GPIO17 (UART2 TX)', 'for sleep/wake commands'],
  ['PMS5003', 'SET', 'GPIO4', 'duty-cycle the fan to save power'],
  ['BME280', 'SDA', 'GPIO21', 'I2C addr 0x76'],
  ['BME280', 'SCL', 'GPIO22', ''],
  ['MQ-2', 'AOUT', 'GPIO34 (ADC1_CH6)', '5 V heater, 20 s warm-up; divider to 3.3 V'],
  ['SX1262', 'MOSI', 'GPIO23', ''],
  ['SX1262', 'MISO', 'GPIO19', ''],
  ['SX1262', 'SCK', 'GPIO18', ''],
  ['SX1262', 'NSS', 'GPIO5', ''],
  ['SX1262', 'DIO1', 'GPIO26', 'IRQ'],
  ['SX1262', 'RST', 'GPIO14', ''],
  ['SX1262', 'BUSY', 'GPIO27', ''],
  ['Button', 'IN', 'GPIO0', 'pull-down, debounced in firmware'],
  ['RGB LED', 'DIN', 'GPIO2', 'WS2812, one pixel'],
  ['Buzzer', 'OUT', 'GPIO25', 'PWM'],
  ['Battery sense', 'ADC', 'GPIO35', '2:1 divider'],
]

/** Collapsed by default; a quiet disclosure, not a panel. */
export function PinMap() {
  return (
    <details className="group">
      <summary className="h-10 flex items-center gap-3 cursor-pointer list-none select-none">
        <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3 transition-transform duration-[120ms] group-open:rotate-90" />
        <span className="text-base text-ink">Pin map</span>
        <span className="text-sm text-ink-3">ESP32 DevKit numbering, S3 remap pending</span>
      </summary>
      <div className="overflow-x-auto pt-4 pl-7">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              {['Peripheral', 'Signal', 'ESP32 pin', 'Notes'].map((h) => (
                <th key={h} className="text-xs font-normal text-ink-3 text-left px-3 h-9">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PINS.map((p, i) => (
              <tr key={i} className="hover:bg-raised">
                <td className="px-3 h-9 border-t border-line text-ink">{p[0]}</td>
                <td className="px-3 h-9 border-t border-line font-mono text-xs text-ink-2">{p[1]}</td>
                <td className="px-3 h-9 border-t border-line font-mono text-xs text-ink tabular-nums">{p[2]}</td>
                <td className="px-3 h-9 border-t border-line text-ink-3">{p[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
