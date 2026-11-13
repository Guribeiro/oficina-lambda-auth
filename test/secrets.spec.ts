import { beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.fn()

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn(function () { return { send } }),
  GetSecretValueCommand: vi.fn(function (input: unknown) { return { input } }),
}))

const { lerSegredo, limparCacheDeSegredos } = await import('../src/infra/secrets.js')

describe('lerSegredo', () => {
  beforeEach(() => {
    send.mockReset()
    limparCacheDeSegredos()
    vi.useRealTimers()
  })

  it('lê e faz parse do JSON do segredo', async () => {
    send.mockResolvedValue({ SecretString: '{"secret":"abc"}' })

    await expect(lerSegredo('oficina/hml/jwt')).resolves.toEqual({ secret: 'abc' })
    expect(send).toHaveBeenCalledWith({ input: { SecretId: 'oficina/hml/jwt' } })
  })

  it('reaproveita o valor em cache entre invocações', async () => {
    send.mockResolvedValue({ SecretString: '{"secret":"abc"}' })

    await lerSegredo('oficina/hml/jwt')
    await lerSegredo('oficina/hml/jwt')

    expect(send).toHaveBeenCalledTimes(1)
  })

  it('busca novamente após o TTL de 5 minutos', async () => {
    vi.useFakeTimers()
    send.mockResolvedValue({ SecretString: '{"secret":"abc"}' })

    await lerSegredo('oficina/hml/jwt')
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    await lerSegredo('oficina/hml/jwt')

    expect(send).toHaveBeenCalledTimes(2)
  })

  it('falha quando o segredo não tem SecretString', async () => {
    send.mockResolvedValue({})
    await expect(lerSegredo('oficina/hml/db')).rejects.toThrow('sem SecretString')
  })
})
