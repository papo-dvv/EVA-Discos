import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicOnlyRoute } from './auth/PublicOnlyRoute'
import { RequireAuth } from './auth/RequireAuth'
import { MainLayout } from './components/MainLayout'
import { DevComponentes } from './pages/dev/DevComponentes'
import { CambiarPasswordObligatorio } from './pages/CambiarPasswordObligatorio'
import { Galeria } from './pages/Galeria'
import { Inicio } from './pages/Inicio'
import { Login } from './pages/Login'
import { MedicionesConfirmadas } from './pages/MedicionesConfirmadas'
import { MigracionPreview } from './pages/MigracionPreview'
import { MigracionUpload } from './pages/MigracionUpload'
import { NuevasMediciones } from './pages/NuevasMediciones'
import { Proyeccion } from './pages/Proyeccion'
import { TasaDesgaste } from './pages/TasaDesgaste'
import { Trazabilidad } from './pages/Trazabilidad'

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/cambiar-password"
        element={
          <RequireAuth requireNotForzado={false}>
            <CambiarPasswordObligatorio />
          </RequireAuth>
        }
      />
      {/* Catálogo de estilo — fuera del shell a propósito: tiene su propio
          nav (NavGaleria) y fondo de portada (bg-aura/bg-cuadricula), no es
          un módulo real; meterlo en MainLayout duplicaría la navegación. */}
      <Route
        path="/design-system"
        element={
          <RequireAuth>
            <Galeria />
          </RequireAuth>
        }
      />
      {/* RUTA TEMPORAL DE DESARROLLO — eliminar tras periodo de pruebas de UI.
          Fuera del shell a propósito, igual que /design-system: compara
          variantes de fondo animado en aislamiento, cosa que ya no tiene
          sentido dentro de MainLayout (que ahora fija el fondo). No se
          enlaza desde Inicio ni desde ningún menú. */}
      <Route
        path="/dev/componentes"
        element={
          <RequireAuth>
            <DevComponentes />
          </RequireAuth>
        }
      />

      {/* Shell persistente (sidebar + topbar, ver MainLayout) — todas las
          rutas autenticadas de acá abajo son SOLO el contenido, sin su
          propio PantallaFondo (ver styles.md, fondo de engranajes ahora
          vive en MainLayout). */}
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Inicio />} />
        <Route path="/mediciones" element={<MedicionesConfirmadas />} />
        <Route path="/tasa-desgaste" element={<TasaDesgaste />} />
        <Route path="/trazabilidad" element={<Trazabilidad />} />
        <Route path="/proyeccion" element={<Proyeccion />} />
        <Route path="/migracion" element={<MigracionUpload />} />
        <Route path="/migracion/:fileId" element={<MigracionPreview />} />
        <Route path="/nuevas-mediciones" element={<NuevasMediciones />} />
        <Route path="/nuevas-mediciones/:fichaId" element={<NuevasMediciones />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
