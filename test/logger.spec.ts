import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarLogger, serializarErro } from '../src/infra/logger.js'

describe('logger JSON', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.LOG_LEVEL
  })

  it('escreve uma linha JSON com service, env, request_id e message', () => {
    process.env.LOG_LEVEL = 'info'
    process.env.APP_ENV = 'hml'
    const log = vi.spyOn(console, 'log').mockImplementation(() => { })

    criarLogger({ request_id: 'req-1' }).info('ok', { cliente_id: 'c1' })

    const linha = JSON.parse(log.mock.calls[0]![0] as string)
    expect(linha).toMatchObject({
      level: 'info',
      service: 'oficina-lambda-auth',
      env: 'hml',
      request_id: 'req-1',
      cliente_id: 'c1',
      message: 'ok',
    })
    expect(new Date(linha.timestamp).toString()).not.toBe('Invalid Date')
  })

  it('usa stderr para erros e respeita LOG_LEVEL=silent', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => { })
    criarLogger().error('falhou')
    expect(error).toHaveBeenCalledTimes(1)

    process.env.LOG_LEVEL = 'silent'
    criarLogger().error('silenciado')
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('serializa erros', () => {
    expect(serializarErro(new Error('x'))).toMatchObject({ name: 'Error', message: 'x' })
    expect(serializarErro('texto')).toEqual({ message: 'texto' })
  })
})
