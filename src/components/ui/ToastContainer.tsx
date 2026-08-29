import { useToastStore } from '@/stores/toastStore'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const iconMap = {
  success: <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />,
  error: <XCircle size={16} className="text-red-600 shrink-0" />,
  info: <Info size={16} className="text-primary-600 shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber-600 shrink-0" />,
}

const borderMap = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  info: 'border-l-primary-500',
  warning: 'border-l-amber-500',
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)
  const pauseToast = useToastStore((s) => s.pauseToast)
  const resumeToast = useToastStore((s) => s.resumeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[9998] flex flex-col-reverse items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          // Con el puntero encima el reloj se para: si alguien va a leerlo, es que
          // necesita mas tiempo, y que el texto se escape a media frase obliga a
          // repetir la accion solo para volver a verlo.
          onMouseEnter={() => pauseToast(t.id)}
          onMouseLeave={() => resumeToast(t.id)}
          className={`animate-toast-slide-in w-full max-w-[320px] rounded-lg bg-white border border-gray-200 border-l-4 ${borderMap[t.type]} p-3 shadow-2xl flex items-start gap-2`}
        >
          {iconMap[t.type]}
          <span className="text-[12px] text-gray-800 flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="text-gray-500 hover:text-gray-700 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
