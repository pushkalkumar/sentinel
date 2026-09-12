import type { ComponentType } from 'react'
import type { PartId } from '../parts'
import type { PartMeshProps } from './PartHit'
import { Tray } from './Tray'
import { Lid } from './Lid'
import { Solar } from './Solar'
import { Pcb } from './Pcb'
import { Esp32S3 } from './Esp32S3'
import { Sx1262 } from './Sx1262'
import { Antenna } from './Antenna'
import { Pms5003 } from './Pms5003'
import { Mq2 } from './Mq2'
import { Bme280 } from './Bme280'
import { Cell18650 } from './Cell18650'
import { Power } from './Power'
import { Buzzer } from './Buzzer'
import { Led } from './Led'
import { Button } from './Button'

export type { PartMeshProps } from './PartHit'

export const PART_MESHES: Record<PartId, ComponentType<PartMeshProps>> = {
  tray: Tray, lid: Lid, solar: Solar, pcb: Pcb, esp32s3: Esp32S3, sx1262: Sx1262, antenna: Antenna,
  pms5003: Pms5003, mq2: Mq2, bme280: Bme280, cell18650: Cell18650, power: Power, buzzer: Buzzer, led: Led, button: Button,
}
