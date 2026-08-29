import { liteLoginUrl, liteSignupUrl } from '@/features/auth/lite'

export default function LandingFooter() {
  return (
    <footer className="mt-8 border-t border-gray-100">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12">
          {/* El pie llevaba la marca solo como texto. Ahora con el isotipo, igual
              que la barra lateral y que el pie de Lite. */}
          <p className="mb-3 flex items-center gap-2.5 text-xl font-bold text-primary-600">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={28} height={28} className="w-7 h-7 shrink-0" />
            LeanProcess
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-gray-500">
            La plataforma de gestión de procesos empresariales con inteligencia artificial
            para organizaciones latinoamericanas.
          </p>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8 sm:flex-row">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} LeanProcess. Todos los derechos reservados.
          </p>
          <nav aria-label="Links del sitio">
            <ul role="list" className="flex items-center gap-6">
              <li>
                <a href={liteLoginUrl} className="text-xs text-gray-500 transition-colors hover:text-gray-900">
                  Iniciar sesión
                </a>
              </li>
              <li>
                <a href={liteSignupUrl} className="text-xs text-gray-500 transition-colors hover:text-gray-900">
                  Registrarse
                </a>
              </li>
              <li>
                <a
                  href="https://process-masters.circle.so"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 transition-colors hover:text-gray-900"
                >
                  Comunidad
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  )
}
