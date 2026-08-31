import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

type Props = { lado: 'izquierdo' | 'derecho'; color?: string }

/** Visor del activo GLB modelado en Blender para los discos Alstom. */
export function DiscoModelo3D({ lado, color = '#34d399' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
    camera.position.set(4.8, 2.7, 5.3)
    camera.lookAt(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.shadowMap.enabled = true
    host.replaceChildren(renderer.domElement)

    const root = new THREE.Group()
    root.rotation.set(-0.25, lado === 'derecho' ? -0.42 : 0.42, 0.04)
    scene.add(root)
    const light = new THREE.HemisphereLight('#e8f7ff', '#122033', 2.1)
    scene.add(light)
    const key = new THREE.DirectionalLight('#ffffff', 2.8)
    key.position.set(3, 4, 5)
    key.castShadow = true
    scene.add(key)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.9, 64), new THREE.ShadowMaterial({ opacity: 0.24 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.65
    scene.add(floor)
    let model: THREE.Object3D | null = null
    const loader = new GLTFLoader()
    loader.load('/models/alstom_disc.glb', (gltf) => {
      model = gltf.scene
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        child.castShadow = true
        child.receiveShadow = true
        if (child.name === `Pista ${lado}`) {
          const selected = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.2, emissive: color, emissiveIntensity: 0.18 })
          child.material = selected
        }
      })
      root.add(model)
    })
    let raf = 0
    const tick = () => {
      root.rotation.z += 0.0014
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()
    const resize = () => { camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1); camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight) }
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      model?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer.dispose()
      host.replaceChildren()
    }
  }, [color, lado])
  return <div ref={hostRef} className="h-full min-h-[220px] w-full" aria-label={`Modelo 3D del disco Alstom lado ${lado}`} />
}
