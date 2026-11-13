import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'

export interface DbSecret {
  host: string
  port: number
  username: string
  password: string
  dbname: string
}

export interface JwtSecret {
  secret: string
}

const TTL_MS = 5 * 60 * 1000

let client: SecretsManagerClient | undefined
const cache = new Map<string, { valor: unknown; expiraEm: number }>()

/**
 * Lê um segredo JSON do Secrets Manager com cache em memória (reaproveitado entre
 * invocações do mesmo ambiente de execução da Lambda).
 */
export async function lerSegredo<T>(secretId: string): Promise<T> {
  const emCache = cache.get(secretId)
  if (emCache && emCache.expiraEm > Date.now()) return emCache.valor as T

  client ??= new SecretsManagerClient({})
  const resposta = await client.send(new GetSecretValueCommand({ SecretId: secretId }))

  if (!resposta.SecretString) {
    throw new Error(`Segredo ${secretId} sem SecretString`)
  }

  const valor = JSON.parse(resposta.SecretString) as T
  cache.set(secretId, { valor, expiraEm: Date.now() + TTL_MS })
  return valor
}

export function limparCacheDeSegredos(): void {
  cache.clear()
}
