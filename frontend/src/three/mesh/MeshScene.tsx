import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { DeviceTier } from '@/store/hardware'
import { FrameloopController } from '../shared/FrameloopController'
import { StaticMapFallback } from '../shared/Fallbacks'
import { CampusOutline } from './CampusOutline'
import { Links } from './Links'
import { Pillars } from './Pillars'
import { Pulses } from './Pulses'

interface Props { inView: boolean; tier: DeviceTier; reducedMotion: boolean }

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[26, 26]} />
      <meshStandardMaterial color="#100F0E" roughness={1} />
    </mesh>
  )
}

export function MeshScene({ inView, tier, reducedMotion }: Props) {
  const full = tier === 'full'
  const continuous = full && !reducedMotion
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={full ? 'demand' : 'never'}
      camera={{ fov: 32, position: [0, 17, 19], near: 0.5, far: 120 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      fallback={<StaticMapFallback />}
      style={{ touchAction: full ? 'none' : 'pan-y' }}
    >
      <FrameloopController inView={inView} tier={tier} continuous={continuous} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} color="#EDE8E0" />
      <Ground />
      <CampusOutline />
      <Links continuous={continuous} />
      <Pillars continuous={continuous} labels={full} />
      <Pulses enabled={full && !reducedMotion} />
      {full && (
        <OrbitControls
          makeDefault enablePan={false} minDistance={12} maxDistance={30}
          minPolarAngle={0.35} maxPolarAngle={1.25} enableDamping dampingFactor={0.08}
          autoRotate={continuous} autoRotateSpeed={0.35}
        />
      )}
    </Canvas>
  )
}
