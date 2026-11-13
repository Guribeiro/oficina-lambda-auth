type Nivel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Logger JSON (uma linha por evento) com o mesmo formato da API NestJS:
 * service, env, request_id e message, para correlação no CloudWatch/New Relic.
 */
export function criarLogger(contexto: Record<string, unknown> = {}) {
  const base = {
    service: 'oficina-lambda-auth',
    env: process.env.APP_ENV ?? 'local',
    ...contexto,
  }

  const escrever = (level: Nivel, message: string, extra?: Record<string, unknown>) => {
    if (process.env.LOG_LEVEL === 'silent') return
    const linha = JSON.stringify({ level, timestamp: new Date().toISOString(), ...base, ...extra, message })
    if (level === 'error') console.error(linha)
    else console.log(linha)
  }

  return {
    info: (message: string, extra?: Record<string, unknown>) => escrever('info', message, extra),
    warn: (message: string, extra?: Record<string, unknown>) => escrever('warn', message, extra),
    error: (message: string, extra?: Record<string, unknown>) => escrever('error', message, extra),
  }
}

export type Logger = ReturnType<typeof criarLogger>

export function serializarErro(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) }
}
