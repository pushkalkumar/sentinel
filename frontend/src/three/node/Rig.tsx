import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { SIGNAL } from './materials'
import { groundTexture } from './textures'

const KEY: [number, number, number] = [3, 4, 2]

/**
 * Studio rig (DESIGN_V2 §5): an offline environment built from three light panels, one shadow-casting key,
 * a faint ambient, contact shadows and a soft radial pool. No HDR files, nothing fetched.
 */
export function Rig() {
  return (
    <>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={KEY} scale={[4, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.1} position={[-4, 2, 1]} scale={[6, 4, 1]} color="#EDE8E0" target={[0, 0, 0]} />
        {/* Low front fill so the wall facing the camera keeps its form. */}
        <Lightformer form="rect" intensity={0.5} position={[1, 0.6, 5]} scale={[5, 2, 1]} color="#EDE8E0" target={[0, 0.5, 0]} />
        <Lightformer form="ring" intensity={2} position={[0, 3, -5]} scale={[3, 3, 1]} color={SIGNAL} target={[0, 0, 0]} />
        {/* A dim floor card so undersides are not pitch black in reflections. */}
        <Lightformer form="rect" intensity={0.15} position={[0, -4, 0]} scale={[8, 8, 1]} color="#EDE8E0" target={[0, 0, 0]} />
      </Environment>
      <ambientLight intensity={0.2} />
      <directionalLight
        position={KEY} intensity={1.2} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={5} shadow-camera-bottom={-3} shadow-camera-near={0.5} shadow-camera-far={14}
      />
      <ContactShadows position={[0, 0.003, 0]} opacity={0.55} scale={7} blur={2.8} far={2.5} resolution={1024} color="#000000" frames={Infinity} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshBasicMaterial map={groundTexture ?? undefined} color={groundTexture ? '#ffffff' : '#0B0A09'} toneMapped={false} />
      </mesh>
    </>
  )
}
