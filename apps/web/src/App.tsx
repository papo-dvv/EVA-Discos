import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicOnlyRoute } from './auth/PublicOnlyRoute'
import { RequireAuth } from './auth/RequireAuth'
import { CambiarPasswordObligatorio } from './pages/CambiarPasswordObligatorio'
import { Galeria } from './pages/Galeria'
import { Inicio } from './pages/Inicio'
import { Login } from './pages/Login'
import { MedicionesConfirmadas } from './pages/MedicionesConfirmadas'
import { MigracionPreview } from './pages/MigracionPreview'
import { MigracionUpload } from './pages/MigracionUpload'
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
