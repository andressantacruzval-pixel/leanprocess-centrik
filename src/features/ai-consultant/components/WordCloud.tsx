import { useMemo } from 'react'

const KEYWORD_COLORS = [
  '#00d4ff', '#7c3aed', '#06b6d4', '#8b5cf6', '#0ea5e9',
  '#a78bfa', '#38bdf8', '#c084fc', '#22d3ee', '#818cf8',
]

// PRNG determinístico (LCG) — permite distribución pseudo-aleatoria sin
// romper la pureza de useMemo: misma semilla → mismo resultado.
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

interface FloatingWord {
  word: string
  count: number
  x: number
  y: number
  size: number
  delay: number
  duration: number
  color: string
}

interface WordCloudProps {
  words: string[]
  maxWords?: number
}

export function WordCloud({ words, maxWords = 25 }: WordCloudProps) {
  const floatingWords = useMemo(() => {
    const stopWords = new Set([
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
      'y', 'o', 'en', 'a', 'que', 'es', 'por', 'con', 'para', 'se', 'su', 'no',
      'lo', 'como', 'mas', 'pero', 'si', 'ya', 'tiene', 'son', 'este', 'esta',
      'muy', 'hay', 'ser', 'ha', 'le', 'me', 'te', 'nos', 'les', 'mi', 'tu',
      'hola', 'necesito', 'ayuda', 'proceso', 'contexto',
    ])

    const counts: Record<string, number> = {}
    for (const w of words) {
      const cleaned = w.toLowerCase().replace(/[^a-záéíóúñü]/g, '')
      if (cleaned.length < 3 || stopWords.has(cleaned)) continue
      counts[cleaned] = (counts[cleaned] || 0) + 1
    }

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxWords)

    if (sorted.length === 0) return []

    const maxCount = sorted[0][1]

    return sorted.map(([word, count], i): FloatingWord => {
      const ratio = count / maxCount
      // Semilla derivada de la palabra: mismas palabras → misma posición.
      const rand = seededRandom(hashString(word))
      return {
        word,
        count,
        x: 5 + rand() * 85,
        y: 5 + rand() * 80,
        size: 0.7 + ratio * 1.3,
        delay: rand() * 5,
        duration: 6 + rand() * 8,
        color: KEYWORD_COLORS[i % KEYWORD_COLORS.length],
      }
    })
  }, [words, maxWords])

  if (floatingWords.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/20 text-sm">
        <div className="text-center space-y-2">
          <div className="flex gap-1 justify-center">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-cyan-500/30 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
          <p>Las palabras clave apareceran aqui...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {floatingWords.map((fw, i) => (
        <span
          key={`${fw.word}-${i}`}
          className="absolute animate-float select-none pointer-events-none"
          style={{
            left: `${fw.x}%`,
            top: `${fw.y}%`,
            fontSize: `${fw.size}rem`,
            color: fw.color,
            opacity: 0.3 + (fw.count / (floatingWords[0]?.count || 1)) * 0.7,
            textShadow: `0 0 12px ${fw.color}40`,
            animationDuration: `${fw.duration}s`,
            animationDelay: `${fw.delay}s`,
            fontWeight: fw.size > 1.2 ? 700 : 500,
          }}
        >
          {fw.word}
        </span>
      ))}
    </div>
  )
}
