import { describe, expect, it } from 'vitest'
import { parseCpf, type Cpf } from '../src/domain/cpf.js'
import { PgClienteRepository } from '../src/infra/pg-cliente-repository.js'

/**
 * Executa contra um PostgreSQL com o schema e o seed da aplicação (tech-challenge):
 *   INTEGRATION_DB_HOST=localhost INTEGRATION_DB_PASSWORD=postgres DB_SSL=false npm test
 */
const host = process.env.INTEGRATION_DB_HOST

describe.skipIf(!host)('PgClienteRepository (integração)', () => {
  const repo = new PgClienteRepository(async () => ({
    host: host!,
    port: Number(process.env.INTEGRATION_DB_PORT ?? 5432),
    username: process.env.INTEGRATION_DB_USER ?? 'postgres',
    password: process.env.INTEGRATION_DB_PASSWORD ?? 'postgres',
    dbname: process.env.INTEGRATION_DB_NAME ?? 'oficina_db',
  }))

  const cpf = (valor: string) => parseCpf(valor) as Cpf

  it.each([
    ['52998224725', 'ATIVO', false],
    ['11144477735', 'BLOQUEADO', false],
    ['93541134780', 'INATIVO', true],
  ])('encontra o cliente do seed %s com status %s', async (documento, status, excluido) => {
    const cliente = await repo.buscarPorCpf(cpf(documento))

    expect(cliente).toMatchObject({ status })
    expect(cliente?.id).toEqual(expect.any(String))
    expect(cliente?.deletadoEm instanceof Date).toBe(excluido)
  })

  it('retorna null para CPF sem cadastro', async () => {
    expect(await repo.buscarPorCpf(cpf('39053344705'))).toBeNull()
  })
})
