import schematicUrl from '@hardware/schematic.svg'

/** No-WebGL fallback for the node scene: the block schematic (HARDWARE_3D §6 tier `none`). */
export function SchematicFallback() {
  return (
    <figure className="w-full h-full flex flex-col items-center justify-center gap-3 p-6">
      <img src={schematicUrl} alt="Sentinel Node block schematic" className="max-h-[70vh] w-auto hairline rounded-md" />
      <figcaption className="font-mono text-2xs text-ink-3">WebGL unavailable. Block schematic shown in place of the 3D model.</figcaption>
    </figure>
  )
}

/** No-WebGL fallback for the mesh scene. */
export function StaticMapFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <p className="font-mono text-2xs text-ink-3 text-center max-w-[40ch]">
        WebGL unavailable. The hop log beside this panel carries the live mesh traffic.
      </p>
    </div>
  )
}
