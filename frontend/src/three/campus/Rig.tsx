import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { EXTENT } from './geo'
import { AO_WORLD, bakeAOTexture } from './aoPlane'
import { GROUND, KEY_LIGHT, SKY } from './palette'

/** Key sits high to the south-east, so shadows fall away to the north-west and the west faces read darker than the south faces. */
const KEY_POS: [number, number, number] = [30, 42, 24]
const SHADOW_HALF = EXTENT * 0.95
const Y_AO = 0.012

export interface RigProps { fogNear: number; fogFar: number }

function BakedAO() {
  const tex = useMemo(bakeAOTexture, [])
  useEffect(() => () => { tex?.dispose() }, [tex])
  if (!tex) return null
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y_AO, 0]} renderOrder={1}>
      <planeGeometry args={[AO_WORLD, AO_WORLD]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-6} />
    </mesh>
  )
}

function ShadowSetup() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.shadowMap.type = THREE.PCFShadowMap
    gl.shadowMap.needsUpdate = true
  }, [gl])
  return null
}

/** Lights, fog, the baked AO sheet and the post chain. */
export function Rig({ fogNear, fogFar }: RigProps) {
  return (
    <>
      <color attach="background" args={[GROUND]} />
      <fog attach="fog" args={[GROUND, fogNear, fogFar]} />
      <ShadowSetup />
      <hemisphereLight args={[SKY, GROUND, 0.85]} />
      <directionalLight
        position={KEY_POS} intensity={2.4} color={KEY_LIGHT} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.00035} shadow-normalBias={0.05} shadow-radius={3}
        shadow-camera-left={-SHADOW_HALF} shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF} shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={1} shadow-camera-far={150}
      />
      <BakedAO />
      <EffectComposer multisampling={4} enableNormalPass={false}>
        <N8AO aoRadius={1.2} intensity={2.4} distanceFalloff={0.9} quality="medium" />
        <Bloom intensity={0.25} luminanceThreshold={0.9} mipmapBlur />
        <Vignette eskil={false} offset={0.22} darkness={0.62} />
      </EffectComposer>
    </>
  )
}
