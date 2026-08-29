import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-ground flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <p className="text-xl text-gray-500 mb-6">Pagina no encontrada</p>
        <Link
          to="/app"
          className="text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg bg-primary-500 hover:bg-primary-600"
        >
          Volver al Dashboard
        </Link>
      </div>
    </div>
  )
}
