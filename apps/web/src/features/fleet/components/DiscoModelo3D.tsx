import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

type Lado = 'izquierdo' | 'derecho'
type Props = { ladoSeleccionado: Lado; color: string; onSeleccionarLado: (lado: Lado) => void }

/** Visor real del GLB de Blender. Arrastrar rota la cámara; clic selecciona una pista. */
export function DiscoModelo3D({ ladoSeleccionado, color, onSeleccionarLado }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onSeleccionarLado)

  useEffect(() => {
    callbackRef.current = onSeleccionarLado
  }, [onSeleccionarLado])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 100)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.domElement.style.cursor = 'grab'
    host.replaceChildren(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.minDistance = 3.3
    controls.maxDistance = 10
    controls.target.set(0, 0, 0)
    // Vista oblicua completa: muestra ambas pistas y el canal ventilado sin
    // recortar el diámetro exterior dentro del visor.
    camera.position.set(3.15, 2.15, 4.85)
    controls.update()

    scene.add(new THREE.HemisphereLight('#e6f6ff', '#071324', 2.4))
    const key = new THREE.DirectionalLight('#ffffff', 3.4)
    key.position.set(4, 5, 5)
    key.castShadow = true
    scene.add(key)
    const rim = new THREE.DirectionalLight('#36d399', 1.7)
    rim.position.set(-4, 1, -3)
    scene.add(rim)

    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.1, 64), new THREE.ShadowMaterial({ opacity: 0.22 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.55
    floor.receiveShadow = true
    scene.add(floor)

    let model: THREE.Group | null = null
    const nombrePista = ladoSeleccionado === 'izquierdo' ? 'Pista izquierda' : 'Pista derecha'
    const selectedMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.2, emissive: color, emissiveIntensity: 0.62 })
    const haloMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.84, side: THREE.DoubleSide, depthWrite: false })
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.49, 0.035, 10, 128), haloMaterial)
    halo.rotation.y = Math.PI / 2
    halo.position.x = ladoSeleccionado === 'izquierdo' ? -0.43 : 0.43
    halo.renderOrder = 3
    scene.add(halo)
    new GLTFLoader().load('/models/alstom_disc.glb', (gltf) => {
      model = gltf.scene
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        child.castShadow = true
        child.receiveShadow = true
        if (child.name.startsWith(nombrePista)) child.material = selectedMaterial
      })
      scene.add(model)
    })

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let pointerStart: { x: number; y: number } | null = null
    let lastSelectionAt = 0
    const onPointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY }
      renderer.domElement.style.cursor = 'grabbing'
    }
    const onPointerUp = (event: MouseEvent) => {
      const moved = pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 7
      pointerStart = null
      renderer.domElement.style.cursor = 'grab'
      if (moved || !model || performance.now() - lastSelectionAt < 120) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const intersections = raycaster.intersectObjects(model.children, true)
      const clicked = intersections.find((hit) => hit.object.name.startsWith('Pista izquierda') || hit.object.name.startsWith('Pista derecha'))
      if (clicked?.object.name.startsWith('Pista izquierda')) callbackRef.current('izquierdo')
      else if (clicked?.object.name.startsWith('Pista derecha')) callbackRef.current('derecho')
      // Los pernos y aletas cubren zonas de la pista. Cuando se pulsa uno de
      // esos detalles, conservamos una selección directa e intuitiva por mitad.
      else callbackRef.current(event.clientX - rect.left < rect.width / 2 ? 'izquierdo' : 'derecho')
      lastSelectionAt = performance.now()
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown, true)
    renderer.domElement.addEventListener('pointerup', onPointerUp, true)
    renderer.domElement.addEventListener('click', onPointerUp, true)

    const resize = () => {
      const width = Math.max(host.clientWidth, 1)
      const height = Math.max(host.clientHeight, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)

    let frame = 0
    const render = () => {
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, true)
      renderer.domElement.removeEventListener('pointerup', onPointerUp, true)
      renderer.domElement.removeEventListener('click', onPointerUp, true)
      controls.dispose()
      selectedMaterial.dispose()
      halo.geometry.dispose()
      haloMaterial.dispose()
      model?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((material) => material !== selectedMaterial && material.dispose())
        }
      })
      renderer.dispose()
      host.replaceChildren()
    }
  }, [color, ladoSeleccionado])

  return <div ref={hostRef} className="h-full min-h-[220px] w-full touch-none" aria-label="Modelo 3D interactivo del disco de freno Alstom. Arrastra para girar y pulsa una pista para seleccionarla." />
}
