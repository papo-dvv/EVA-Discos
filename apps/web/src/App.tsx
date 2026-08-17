import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicOnlyRoute } from './auth/PublicOnlyRoute'
import { RequireAuth } from './auth/RequireAuth'
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
import { Reperfilado } from './pages/Reperfilado'
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
      <Route
        path="/"
        element={
          <RequireAuth>
            <Inicio />
          </RequireAuth>
        }
      />
      <Route
        path="/design-system"
        element={
          <RequireAuth>
            <Galeria />
          </RequireAuth>
        }
      />
      {/* RUTA TEMPORAL DE DESARROLLO — eliminar tras periodo de pruebas de UI.
          Protegida por login (cualquier rol autenticado), a propósito fuera
          del nav principal — no se enlaza desde Inicio ni desde ningún menú. */}
      <Route
        path="/dev/componentes"
        element={
          <RequireAuth>
            <DevComponentes />
          </RequireAuth>
        }
      />
      <Route
        path="/mediciones"
        element={
          <RequireAuth>
            <MedicionesConfirmadas />
          </RequireAuth>
        }
      />
      <Route
        path="/tasa-desgaste"
        element={
          <RequireAuth>
            <TasaDesgaste />
          </RequireAuth>
        }
      />
      <Route
        path="/trazabilidad"
        element={
          <RequireAuth>
            <Trazabilidad />
          </RequireAuth>
        }
      />
      <Route
        path="/proyeccion"
        element={
          <RequireAuth>
            <Proyeccion />
          </RequireAuth>
        }
      />
      <Route
        path="/migracion"
        element={
          <RequireAuth>
            <MigracionUpload />
          </RequireAuth>
        }
      />
      <Route
        path="/migracion/:fileId"
        element={
          <RequireAuth>
            <MigracionPreview />
          </RequireAuth>
        }
      />
      <Route
        path="/nuevas-mediciones"
        element={
          <RequireAuth>
            <NuevasMediciones />
          </RequireAuth>
        }
      />
      <Route
        path="/nuevas-mediciones/:fichaId"
        element={
          <RequireAuth>
            <NuevasMediciones />
          </RequireAuth>
        }
      />
      <Route
        path="/reperfilado"
        element={
          <RequireAuth>
            <Reperfilado />
          </RequireAuth>
        }
      />
      <Route
        path="/reperfilado/:fichaId"
        element={
          <RequireAuth>
            <Reperfilado />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
