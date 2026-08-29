import { useEffect, useRef } from 'react'

interface WaveformVisualizerProps {
  isActive: boolean
}

const GRADIENT_COLORS = ['#00d4ff', '#7c3aed', '#06b6d4']

export function WaveformVisualizer({ isActive }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas dimensions for HD
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight

    if (!isActive) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
        audioCtxRef.current = null
      }
      analyserRef.current = null

      // Draw idle pulse line
      let phase = 0
      function drawIdle() {
        if (!canvas || !ctx) return
        animationRef.current = requestAnimationFrame(drawIdle)
        ctx.clearRect(0, 0, w, h)

        // Glow effect
        ctx.shadowBlur = 8
        ctx.shadowColor = GRADIENT_COLORS[0]

        const grad = ctx.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, GRADIENT_COLORS[0] + '40')
        grad.addColorStop(0.5, GRADIENT_COLORS[1] + '60')
        grad.addColorStop(1, GRADIENT_COLORS[2] + '40')
        ctx.strokeStyle = grad
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let x = 0; x < w; x++) {
          const y = h / 2 + Math.sin(x * 0.03 + phase) * 4 * Math.sin(phase * 0.3)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.shadowBlur = 0
        phase += 0.02
      }
      drawIdle()
      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current)
      }
    }

    // Active: use microphone
    async function startVisualizer() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream
        const audioCtx = new AudioContext()
        audioCtxRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.85
        source.connect(analyser)
        analyserRef.current = analyser

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        const freqData = new Uint8Array(bufferLength)

        function draw() {
          if (!canvas || !ctx || !analyserRef.current) return
          animationRef.current = requestAnimationFrame(draw)
          analyserRef.current.getByteTimeDomainData(dataArray)
          analyserRef.current.getByteFrequencyData(freqData)

          ctx.clearRect(0, 0, w, h)

          // Frequency bars in background (subtle)
          const barCount = 64
          const barWidth = w / barCount
          for (let i = 0; i < barCount; i++) {
            const fi = Math.floor((i / barCount) * bufferLength)
            const barHeight = (freqData[fi] / 255) * h * 0.6
            const hue = 190 + (i / barCount) * 80 // cyan to purple
            ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.15)`
            ctx.fillRect(i * barWidth, h - barHeight, barWidth - 1, barHeight)
          }

          // Main waveform
          ctx.shadowBlur = 12
          ctx.shadowColor = GRADIENT_COLORS[0]
          const grad = ctx.createLinearGradient(0, 0, w, 0)
          grad.addColorStop(0, GRADIENT_COLORS[0])
          grad.addColorStop(0.5, GRADIENT_COLORS[1])
          grad.addColorStop(1, GRADIENT_COLORS[2])
          ctx.strokeStyle = grad
          ctx.lineWidth = 2.5
          ctx.beginPath()

          const sliceWidth = w / bufferLength
          let x = 0
          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0
            const y = (v * h) / 2
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
            x += sliceWidth
          }
          ctx.lineTo(w, h / 2)
          ctx.stroke()
          ctx.shadowBlur = 0

          // Mirror waveform (faint)
          ctx.globalAlpha = 0.15
          ctx.strokeStyle = GRADIENT_COLORS[2]
          ctx.lineWidth = 1.5
          ctx.beginPath()
          x = 0
          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0
            const y = h - (v * h) / 2
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
            x += sliceWidth
          }
          ctx.stroke()
          ctx.globalAlpha = 1
        }

        draw()
      } catch {
        // Microphone not available — animated sine wave fallback
        let phase = 0
        function drawFallback() {
          if (!canvas || !ctx) return
          animationRef.current = requestAnimationFrame(drawFallback)
          ctx.clearRect(0, 0, w, h)

          ctx.shadowBlur = 10
          ctx.shadowColor = GRADIENT_COLORS[0]
          const grad = ctx.createLinearGradient(0, 0, w, 0)
          grad.addColorStop(0, GRADIENT_COLORS[0])
          grad.addColorStop(0.5, GRADIENT_COLORS[1])
          grad.addColorStop(1, GRADIENT_COLORS[2])
          ctx.strokeStyle = grad
          ctx.lineWidth = 2.5
          ctx.beginPath()
          for (let x = 0; x < w; x++) {
            const amp = 25 + Math.sin(phase * 0.5) * 15
            const y = h / 2 + Math.sin(x * 0.025 + phase) * amp * Math.sin(x * 0.003 + phase * 0.7)
            if (x === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.stroke()
          ctx.shadowBlur = 0
          phase += 0.04
        }
        drawFallback()
      }
    }

    startVisualizer()

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
        audioCtxRef.current = null
      }
      analyserRef.current = null
    }
  }, [isActive])

  return (
    <div className="relative w-full">
      {/* Glow backdrop */}
      <div className="absolute inset-0 rounded-lg blur-xl bg-primary-500" />
      <canvas
        ref={canvasRef}
        className="relative w-full h-28 rounded-lg bg-gray-900/45 border border-gray-100"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  )
}
