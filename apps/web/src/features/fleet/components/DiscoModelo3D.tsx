import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type Props = { lado: 'izquierdo' | 'derecho'; activo?: boolean }

/** Modelo sólido del disco Alstom: eje, cubo, pistas y ventilación. */
export function DiscoModelo3D({ lado, activo = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(4.2, 2.7, 5.4)
    camera.lookAt(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.shadowMap.enabled = true
    host.replaceChildren(renderer.domElement)

    const root = new THREE.Group()
    root.rotation.set(-0.12, lado === 'derecho' ? -0.28 : 0.28, 0.08)
    scene.add(root)
    const metal = new THREE.MeshStandardMaterial({ color: '#b8c1ca', metalness: 0.86, roughness: 0.24 })
    const dark = new THREE.MeshStandardMaterial({ color: '#263341', metalness: 0.5, roughness: 0.38 })
    const copper = new THREE.MeshStandardMaterial({ color: activo ? '#34d399' : '#8b6f55', metalness: 0.55, roughness: 0.3 })
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.8, 48), metal)
    axle.rotation.z = Math.PI / 2
    root.add(axle)
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.34, 96), metal)
    disc.rotation.z = Math.PI / 2
    disc.castShadow = true
    root.add(disc)
    for (const x of [-0.28, 0.28]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.12, 20, 72), dark)
      ring.rotation.y = Math.PI / 2
      ring.position.x = x
      root.add(ring)
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.65, 64), copper)
    hub.rotation.z = Math.PI / 2
    root.add(hub)
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.24), dark)
      vent.position.set(0, Math.cos(a) * 1.08, Math.sin(a) * 1.08)
      vent.rotation.x = -a
      root.add(vent)
    }
    const light = new THREE.HemisphereLight('#e8f7ff', '#122033', 2.1)
    scene.add(light)
    const key = new THREE.DirectionalLight('#ffffff', 2.8)
    key.position.set(3, 4, 5)
    key.castShadow = true
    scene.add(key)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64), new THREE.ShadowMaterial({ opacity: 0.22 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.65
    scene.add(floor)
    let raf = 0
    const tick = () => { root.rotation.z += 0.0018; renderer.render(scene, camera); raf = requestAnimationFrame(tick) }
    tick()
    const resize = () => { camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1); camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight) }
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); renderer.dispose(); host.replaceChildren() }
  }, [activo, lado])
  return <div ref={hostRef} className="h-full min-h-[260px] w-full" aria-label={`Modelo 3D del disco Alstom lado ${lado}`} />
}
