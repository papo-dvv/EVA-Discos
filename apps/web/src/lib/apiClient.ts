import axios from 'axios'
import qs from 'qs'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  // arrayFormat 'repeat': un array de params se serializa como
  // "estado=OK&estado=CRITICO" (clave repetida, sin corchetes). El backend
  // configura Express con el parser de query 'extended' (librería `qs`), que
  // entiende este formato de forma nativa bajo la MISMA clave sin corchetes
  // — a diferencia del formato "estado[]=..." que axios usa por defecto, que
  // el ValidationPipe (whitelist:true) rechazaba con 400 "property estado[]
  // should not exist" (la clave con corchetes no matchea el DTO).
  paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
})

// Adjunta el JWT guardado por AuthProvider (localStorage 'eva.sesion') a cada
// request. Así las rutas protegidas del backend no necesitan pasar el token a
// mano en cada llamada.
apiClient.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('eva.sesion')
    if (raw) {
      const token = (JSON.parse(raw) as { accessToken?: string }).accessToken
      if (token) config.headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // sesión ilegible: se envía sin token y el backend responderá 401
  }
  return config
})

// La sesión persistida puede quedar obsoleta (por expiración del JWT o por un
// cambio del secreto del backend). En ese caso no debemos mantener el shell
// autenticado mientras cada pantalla muestra "Unauthorized": limpiamos la
// sesión y forzamos un nuevo login. Se excluye el propio login para que unas
// credenciales incorrectas se puedan mostrar como error sin recargar la vista.
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const requestUrl = error.config?.url ?? ''
      if (!requestUrl.endsWith('/auth/login')) {
        localStorage.removeItem('eva.sesion')
        if (window.location.pathname !== '/login') {
          window.location.replace('/login')
        }
      }
    }
    return Promise.reject(error)
  },
)
