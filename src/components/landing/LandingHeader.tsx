import { liteLoginUrl, liteSignupUrl } from '@/features/auth/lite'

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070b14]/80 backdrop-blur-md">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-lg focus:bg-cyan-500 focus:px-4 focus:py-2 focus:text-white focus:outline-none"
      >
        Saltar al contenido
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="text-xl font-bold text-cyan-400">
          LeanProcess
        </a>
        <nav aria-label="Navegación principal">
          <ul role="list" className="hidden items-center gap-8 md:flex">
            <li>
              <a href="#features" className="text-sm text-white/50 transition-colors hover:text-white">
                Características
              </a>
            </li>
            <li>
              <a href="#plans" className="text-sm text-white/50 transition-colors hover:text-white">
                Precios
              </a>
            </li>
            <li>
              <a href="#faq" className="text-sm text-white/50 transition-colors hover:text-white">
                FAQ
              </a>
            </li>
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <a href={liteLoginUrl} className="hidden text-sm text-white/50 transition-colors hover:text-white sm:block">
            Iniciar sesión
          </a>
          <a
            href={liteSignupUrl}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(6,182,212,0.2)] transition-all duration-200 hover:scale-[1.02] hover:from-cyan-400 hover:to-blue-500 hover:shadow-[0_0_24px_rgba(6,182,212,0.4)] active:scale-[0.99]"
          >
            Registrarse
          </a>
        </div>
      </div>
    </header>
  )
}
