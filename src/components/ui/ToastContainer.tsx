import { useToastStore } from '@/stores/toastStore'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const iconMap = {
  success: <CheckCircle2 size={16} className="text-green-500 shrink-0" />,
  error: <XCircle size={16} className="text-red-500 shrink-0" />,
  info: <Info size={16} className="text-cyan-500 shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber-500 shrink-0" />,
}

const borderMap = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  info: 'border-l-cyan-500',
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
          className={`animate-toast-slide-in w-full max-w-[320px] rounded-xl bg-[#0d1420] border border-white/10 border-l-4 ${borderMap[t.type]} p-3 shadow-2xl flex items-start gap-2`}
        >
          {iconMap[t.type]}
          <span className="text-[12px] text-white/80 flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="text-white/40 hover:text-white/70 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
