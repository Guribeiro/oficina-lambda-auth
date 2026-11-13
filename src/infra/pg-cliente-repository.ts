import pg from 'pg'
import type { Cpf } from '../domain/cpf.js'
import type { ClienteAutenticavel, ClienteRepository, StatusCliente } from '../domain/autenticar-cliente.js'
import type { DbSecret } from './secrets.js'

let pool: pg.Pool | undefined

/**
 * Pool pequeno e reaproveitado entre invocações. O RDS exige TLS (rds.force_ssl=1);
 * a cadeia de certificados da AWS vem de NODE_EXTRA_CA_CERTS=/var/runtime/ca-cert.pem.
 */
async function obterPool(obterCredenciais: () => Promise<DbSecret>): Promise<pg.Pool> {
  if (pool) return pool

  const db = await obterCredenciais()
  pool = new pg.Pool({
    host: db.host,
    port: Number(db.port),
    user: db.username,
    password: db.password,
    database: db.dbname,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: true },
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

  return pool
}

interface ClienteRow {
  id: string
  nome: string
  status: StatusCliente
  deletado_em: Date | null
}

export class PgClienteRepository implements ClienteRepository {
  constructor(private readonly obterCredenciais: () => Promise<DbSecret>) { }

  async buscarPorCpf(cpf: Cpf): Promise<ClienteAutenticavel | null> {
    const db = await obterPool(this.obterCredenciais)
    const { rows } = await db.query<ClienteRow>(
      'SELECT id, nome, status, deletado_em FROM clientes WHERE documento = $1 LIMIT 1',
      [cpf],
    )

    const row = rows[0]
    if (!row) return null

    return { id: row.id, nome: row.nome, status: row.status, deletadoEm: row.deletado_em }
  }
}
