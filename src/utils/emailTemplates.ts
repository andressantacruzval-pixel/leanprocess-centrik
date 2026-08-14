// ── Types ────────────────────────────────────────────────────────────────

export type EmailTemplate = {
  subject: string
  html: string
  text: string
}

// ── Brand constants ──────────────────────────────────────────────────────

const BRAND = {
  name: 'Lean Process',
  navy: '#0a0f1a',
  cyan: '#06b6d4',
  white: '#ffffff',
  gray: '#6b7280',
  lightBg: '#f9fafb',
  url: 'https://app.leanprocess.app',
}

// ── Layout helpers ───────────────────────────────────────────────────────

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${BRAND.lightBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.lightBg};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND.navy};padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="margin:0;color:${BRAND.cyan};font-size:24px;font-weight:700;letter-spacing:-0.5px;">${BRAND.name}</h1>
              <p style="margin:8px 0 0;color:${BRAND.gray};font-size:13px;">${title}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:${BRAND.white};padding:40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:${BRAND.white};padding:24px 40px;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:${BRAND.gray};font-size:12px;">
                ${BRAND.name} &mdash; Gestion de Procesos Inteligente
              </p>
              <p style="margin:8px 0 0;">
                <a href="{{unsubscribe_url}}" style="color:${BRAND.gray};font-size:11px;text-decoration:underline;">Cancelar suscripcion</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function btn(text: string, href: string = BRAND.url): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;background-color:${BRAND.cyan};color:${BRAND.white};text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;margin:16px 0;">${text}</a>`
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 16px;color:${BRAND.navy};font-size:20px;font-weight:700;">${text}</h2>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${text}</p>`
}

function statBox(label: string, value: string | number): string {
  return `<td style="text-align:center;padding:16px;">
    <p style="margin:0;font-size:28px;font-weight:700;color:${BRAND.cyan};">${value}</p>
    <p style="margin:4px 0 0;font-size:12px;color:${BRAND.gray};">${label}</p>
  </td>`
}

// ── Templates ────────────────────────────────────────────────────────────

export function welcomeEmail(userName: string): EmailTemplate {
  const subject = `Bienvenido a Lean Process, ${userName}!`
  const html = layout(
    'Bienvenida',
    `${heading(`Hola ${userName}, bienvenido!`)}
     ${paragraph('Gracias por registrarte en Lean Process. Ahora tienes acceso a herramientas profesionales para mapear, documentar y optimizar los procesos de tu organizacion.')}
     ${paragraph('Tu prueba gratuita de 14 dias ha comenzado. Explora todas las funcionalidades sin limite.')}
     <div style="text-align:center;">${btn('Comenzar ahora')}</div>
     ${paragraph('Si tienes preguntas, responde a este correo. Estamos para ayudarte.')}`,
  )
  const text = `Hola ${userName}, bienvenido a Lean Process!\n\nGracias por registrarte. Tu prueba gratuita de 14 dias ha comenzado.\n\nComienza ahora: ${BRAND.url}\n\nSi tienes preguntas, responde a este correo.`
  return { subject, html, text }
}

export function trialExpiringEmail(userName: string, daysLeft: number): EmailTemplate {
  const subject = `Tu prueba gratuita vence en ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`
  const html = layout(
    'Prueba por vencer',
    `${heading(`${userName}, tu prueba vence pronto`)}
     ${paragraph(`Te quedan <strong>${daysLeft} dia${daysLeft !== 1 ? 's' : ''}</strong> de prueba gratuita. Despues de ese plazo, necesitaras un plan activo para seguir usando Lean Process.`)}
     ${paragraph('Actualiza tu plan ahora para no perder acceso a tus procesos, riesgos y KPIs documentados.')}
     <div style="text-align:center;">${btn('Ver planes', `${BRAND.url}/settings/billing`)}</div>`,
  )
  const text = `Hola ${userName},\n\nTe quedan ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} de prueba gratuita en Lean Process.\n\nActualiza tu plan: ${BRAND.url}/settings/billing`
  return { subject, html, text }
}

export function trialExpiredEmail(userName: string): EmailTemplate {
  const subject = 'Tu prueba gratuita ha finalizado'
  const html = layout(
    'Prueba finalizada',
    `${heading(`${userName}, tu prueba ha terminado`)}
     ${paragraph('Tu periodo de prueba gratuita de 14 dias ha concluido. Tu trabajo esta seguro — todos tus procesos, riesgos y documentos estan guardados.')}
     ${paragraph('Elige un plan para retomar el acceso completo a tu espacio de trabajo.')}
     <div style="text-align:center;">${btn('Elegir plan', `${BRAND.url}/settings/billing`)}</div>
     ${paragraph('Si necesitas mas tiempo para evaluar, respondenos y te ayudamos.')}`,
  )
  const text = `Hola ${userName},\n\nTu prueba gratuita ha finalizado. Tu trabajo esta seguro.\n\nElige un plan: ${BRAND.url}/settings/billing\n\nSi necesitas mas tiempo, respondenos.`
  return { subject, html, text }
}

export function inactivityEmail(userName: string, daysSinceLastLogin: number): EmailTemplate {
  const subject = `Te extraniamos en Lean Process`
  const messages: Record<number, string> = {
    7: 'Ha pasado una semana desde tu ultimo ingreso. Tus procesos te esperan.',
    14: 'Han pasado 2 semanas. Que tal si retomas donde lo dejaste?',
    30: 'Ha pasado un mes. Tu espacio de trabajo sigue activo y listo para ti.',
  }
  const body = messages[daysSinceLastLogin] ?? `Han pasado ${daysSinceLastLogin} dias desde tu ultimo ingreso.`

  const html = layout(
    'Te extraniamos',
    `${heading(`Hola ${userName}!`)}
     ${paragraph(body)}
     ${paragraph('Lean Process sigue evolucionando. Nuevas funcionalidades te esperan para optimizar tus procesos.')}
     <div style="text-align:center;">${btn('Volver a Lean Process')}</div>`,
  )
  const text = `Hola ${userName},\n\n${body}\n\nVuelve a Lean Process: ${BRAND.url}`
  return { subject, html, text }
}

export function achievementEmail(userName: string, achievementTitle: string, points: number): EmailTemplate {
  const subject = `Logro desbloqueado: ${achievementTitle}`
  const html = layout(
    'Logro desbloqueado',
    `${heading(`Felicidades, ${userName}!`)}
     <div style="text-align:center;padding:24px 0;">
       <div style="display:inline-block;width:80px;height:80px;border-radius:50%;background-color:${BRAND.cyan}20;line-height:80px;text-align:center;font-size:36px;">🏆</div>
     </div>
     ${paragraph(`Has desbloqueado el logro <strong>"${achievementTitle}"</strong> y ganado <strong>${points} puntos</strong>.`)}
     ${paragraph('Sigue documentando y optimizando tus procesos para desbloquear mas logros.')}
     <div style="text-align:center;">${btn('Ver mis logros', `${BRAND.url}/achievements`)}</div>`,
  )
  const text = `Felicidades ${userName}!\n\nHas desbloqueado "${achievementTitle}" (+${points} puntos).\n\nVer logros: ${BRAND.url}/achievements`
  return { subject, html, text }
}

export function weeklyDigestEmail(
  userName: string,
  stats: { processes: number; risks: number; streak: number },
): EmailTemplate {
  const subject = 'Tu resumen semanal de Lean Process'
  const html = layout(
    'Resumen semanal',
    `${heading(`Hola ${userName}, aqui tu resumen`)}
     ${paragraph('Esta es tu actividad de la ultima semana en Lean Process:')}
     <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
       <tr>
         ${statBox('Procesos', stats.processes)}
         ${statBox('Riesgos', stats.risks)}
         ${statBox('Racha', `${stats.streak}d`)}
       </tr>
     </table>
     ${paragraph('Sigue asi! La constancia es clave para una gestion de procesos efectiva.')}
     <div style="text-align:center;">${btn('Ir al dashboard')}</div>`,
  )
  const text = `Hola ${userName},\n\nTu resumen semanal:\n- Procesos: ${stats.processes}\n- Riesgos: ${stats.risks}\n- Racha: ${stats.streak} dias\n\nDashboard: ${BRAND.url}`
  return { subject, html, text }
}

export function streakBrokenEmail(userName: string, previousStreak: number): EmailTemplate {
  const subject = 'Tu racha se ha roto — pero puedes recuperarla!'
  const html = layout(
    'Racha interrumpida',
    `${heading(`${userName}, tu racha de ${previousStreak} dias se rompio`)}
     ${paragraph('No te preocupes, las rachas se pueden reconstruir. Lo importante es la consistencia a largo plazo.')}
     ${paragraph('Ingresa hoy para iniciar una nueva racha y seguir mejorando tus procesos.')}
     <div style="text-align:center;">${btn('Reiniciar mi racha')}</div>
     ${paragraph(`<em>Tu mejor racha fue de ${previousStreak} dias. Puedes superarla!</em>`)}`,
  )
  const text = `Hola ${userName},\n\nTu racha de ${previousStreak} dias se rompio. Ingresa hoy para iniciar una nueva: ${BRAND.url}\n\nTu mejor racha: ${previousStreak} dias. Puedes superarla!`
  return { subject, html, text }
}

// ── Template registry ────────────────────────────────────────────────────

export const EMAIL_TEMPLATES = [
  { name: 'welcome', description: 'Email de bienvenida despues del registro' },
  { name: 'trial_expiring', description: 'Aviso de que la prueba gratuita esta por vencer (3 o 1 dia)' },
  { name: 'trial_expired', description: 'Notificacion de que la prueba gratuita ha terminado' },
  { name: 'inactivity', description: 'Re-engagement por inactividad (7, 14, 30 dias)' },
  { name: 'achievement', description: 'Notificacion de logro desbloqueado con puntos' },
  { name: 'weekly_digest', description: 'Resumen semanal de actividad del usuario' },
  { name: 'streak_broken', description: 'Motivacion cuando se rompe una racha de uso' },
] as const
