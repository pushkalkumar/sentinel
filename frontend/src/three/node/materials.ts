// Material set for the node model (DESIGN_V2 §5). Module singletons: never `new` a material inside render.
import * as THREE from 'three'
import { cellTexture, espTexture, meshBump, pcbTexture, solarTexture } from './textures'

/** Dusty teal: the rim light and the status LED at rest. The only teal in the scene. */
export const SIGNAL = '#7F9FA0'
export const LED_DEFAULT = SIGNAL

const physical = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p)
const standard = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)

export const MATERIALS = {
  /** Enclosure and lid: satin polycarbonate with a light clearcoat. */
  enclosure: physical({ color: '#242220', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  /** Brushed aluminium: ESP32 can, SMA, cell terminals, screws. */
  aluminium: physical({ color: '#B9B7B2', metalness: 1, roughness: 0.35, anisotropy: 0.6, anisotropyRotation: Math.PI / 2 }),
  /** Stainless mesh on the MQ-2. */
  steelMesh: physical({ color: '#A9A7A2', metalness: 1, roughness: 0.6, bumpMap: meshBump ?? undefined, bumpScale: 0.004 }),
  /** Bare board colour for PCB edges and undersides. */
  pcb: standard({ color: '#151716', roughness: 0.7 }),
  /** Main board top with traces and silkscreen. */
  pcbTop: standard({ color: '#ffffff', map: pcbTexture ?? undefined, roughness: 0.62 }),
  /** Module substrates (LoRa, power, breakouts). */
  module: standard({ color: '#121513', roughness: 0.65 }),
  /** ESP32 substrate with the meander antenna. */
  espTop: standard({ color: '#ffffff', map: espTexture ?? undefined, roughness: 0.65 }),
  cellWrap: standard({ color: '#ffffff', map: cellTexture ?? undefined, roughness: 0.5 }),
  solar: physical({ color: '#ffffff', map: solarTexture ?? undefined, metalness: 0.5, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  copper: standard({ color: '#B87333', metalness: 1, roughness: 0.3 }),
  /** Matte black nylon: connectors, holders, buzzer, button bezel. */
  plastic: standard({ color: '#1A1918', roughness: 0.8 }),
  /** Cream nylon: JST housings and pin headers. */
  nylon: standard({ color: '#D8D2C4', roughness: 0.7 }),
  /** Frosted polycarbonate light pipe and dome. */
  frosted: physical({ color: '#EDE8E0', roughness: 0.38, transmission: 0.85, thickness: 0.02, ior: 1.45, emissive: new THREE.Color(LED_DEFAULT), emissiveIntensity: 0.18 }),
  /** The LED die: the one thing bright enough for bloom. */
  ledDie: standard({ color: '#EDE8E0', roughness: 0.4, emissive: new THREE.Color(LED_DEFAULT), emissiveIntensity: 2.2 }),
  ledDome: physical({ color: '#EDE8E0', roughness: 0.55, transmission: 0.6, thickness: 0.05, emissive: new THREE.Color(LED_DEFAULT), emissiveIntensity: 0.35 }),
  /** Recesses and vent slots read as shadowed holes. */
  cavity: standard({ color: '#0B0A09', roughness: 1 }),
  /** Rubber gasket in the lid channel. */
  gasket: standard({ color: '#2A2724', roughness: 0.95 }),
  /** Soft-touch button cap. */
  buttonCap: physical({ color: '#D9CFC0', roughness: 0.55, clearcoat: 0.2 }),
} as const

export type MaterialKey = keyof typeof MATERIALS

/** Set the LED colour from the demo's current band (hex). */
export function setLedColor(hex: string) {
  MATERIALS.ledDie.emissive.set(hex)
  MATERIALS.ledDome.emissive.set(hex)
  MATERIALS.frosted.emissive.set(hex)
}
