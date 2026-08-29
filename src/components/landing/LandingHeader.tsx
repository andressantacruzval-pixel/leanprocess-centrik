import { liteLoginUrl, liteSignupUrl } from '@/features/auth/lite'

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-surface-ground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-lg focus:bg-primary-500 focus:px-4 focus:py-2 focus:text-gray-900 focus:outline-none"
      >
        Saltar al contenido
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="text-xl font-bold text-primary-600">
          LeanProcess
        </a>
        <nav aria-label="Navegación principal">
          <ul role="list" className="hidden items-center gap-8 md:flex">
            <li>
              <a href="#features" className="text-sm text-gray-500 transition-colors hover:text-gray-900">
                Características
              </a>
            </li>
            <li>
              <a href="#plans" className="text-sm text-gray-500 transition-colors hover:text-gray-900">
                Precios
              </a>
            </li>
            <li>
              <a href="#faq" className="text-sm text-gray-500 transition-colors hover:text-gray-900">
                FAQ
              </a>
            </li>
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <a href={liteLoginUrl} className="hidden text-sm text-gray-500 transition-colors hover:text-gray-900 sm:block">
            Iniciar sesión
          </a>
          <a
            href={liteSignupUrl}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] bg-primary-500 hover:bg-primary-600"
          >
            Registrarse
          </a>
        </div>
      </div>
    </header>
  )
}
