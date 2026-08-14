export const EXCEL_COLORS = {
  navyTitle:   '1B2A4A',
  darkBlue:    '1E3A5F',
  blue:        '2563EB',
  white:       'FFFFFF',
  lightGray:   'F8FAFC',
  textDark:    '374151',
  textMuted:   '9CA3AF',
  borderLight: 'D1D5DB',
  borderDark:  '1B2A4A',
  font:        'Aptos',
} as const

export const THRESHOLD_COLORS = {
  green:  { bg: 'D1FAE5', text: '065F46' },
  yellow: { bg: 'FEF3C7', text: '92400E' },
  red:    { bg: 'FEE2E2', text: '991B1B' },
} as const

export const RISK_LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  Extremo:  { bg: 'FEE2E2', text: '991B1B' },
  Alto:     { bg: 'FEF3C7', text: '92400E' },
  Moderado: { bg: 'FEF9C3', text: '713F12' },
  Bajo:     { bg: 'D1FAE5', text: '065F46' },
}

export const VA_COLORS: Record<string, { bg: string; text: string }> = {
  VA:    { bg: 'D1FAE5', text: '065F46' },
  NVA:   { bg: 'FEE2E2', text: '991B1B' },
  NVABN: { bg: 'FEF3C7', text: '92400E' },
}
