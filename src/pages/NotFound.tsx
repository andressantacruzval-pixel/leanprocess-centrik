import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white/10 mb-4">404</h1>
        <p className="text-xl text-white/40 mb-6">Pagina no encontrada</p>
        <Link
          to="/app"
          className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-2.5 rounded-xl hover:from-cyan-500 hover:to-blue-500 font-medium transition-all shadow-lg shadow-cyan-500/20"
        >
          Volver al Dashboard
        </Link>
      </div>
    </div>
  )
}
