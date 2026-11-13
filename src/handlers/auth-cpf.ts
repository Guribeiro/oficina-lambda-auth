import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { AutenticarClientePorCpf, type FalhaAutenticacao } from '../domain/autenticar-cliente.js'
import { mascararCpf, parseCpf } from '../domain/cpf.js'
import { variavel } from '../infra/config.js'
import { JoseTokenSigner } from '../infra/jwt.js'
import { criarLogger, serializarErro } from '../infra/logger.js'
import { PgClienteRepository } from '../infra/pg-cliente-repository.js'
import { lerSegredo, type DbSecret, type JwtSecret } from '../infra/secrets.js'

type Resposta = APIGatewayProxyStructuredResultV2

const FALHAS: Record<FalhaAutenticacao['tipo'], { statusCode: number; message: string }> = {
  CPF_INVALIDO: { statusCode: 400, message: 'CPF inválido.' },
  CLIENTE_NAO_ENCONTRADO: { statusCode: 404, message: 'Cliente não encontrado.' },
  CLIENTE_INATIVO: { statusCode: 403, message: 'Cliente inativo ou bloqueado.' },
}

function json(statusCode: number, body: unknown, requestId: string): Resposta {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-request-id': requestId,
    },
    body: JSON.stringify(body),
  }
}

function lerCpfDoCorpo(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return undefined
  const texto = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
  try {
    return (JSON.parse(texto) as { cpf?: unknown })?.cpf
  } catch {
    return undefined
  }
}

/**
 * POST /auth/cpf  { "cpf": "529.982.247-25" }
 * 200 { accessToken, tokenType, expiresIn, cliente } | 400 CPF inválido | 403 inativo | 404 inexistente
 */
export function criarHandler(autenticar: AutenticarClientePorCpf) {
  return async (event: APIGatewayProxyEventV2): Promise<Resposta> => {
    const requestId = event.requestContext?.requestId ?? 'local'
    const log = criarLogger({ request_id: requestId, function: 'auth-cpf' })
    const cpfInformado = lerCpfDoCorpo(event)
    const cpfValido = parseCpf(cpfInformado)
    const cpfLog = cpfValido ? mascararCpf(cpfValido) : undefined

    try {
      const resultado = await autenticar.executar(cpfInformado)

      if (!resultado.ok) {
        const { statusCode, message } = FALHAS[resultado.falha.tipo]
        log.warn('Autenticação por CPF recusada', { motivo: resultado.falha.tipo, cpf: cpfLog, status_code: statusCode })
        return json(statusCode, { statusCode, message }, requestId)
      }

      log.info('Cliente autenticado por CPF', { cliente_id: resultado.cliente.id, cpf: cpfLog })
      return json(200, {
        accessToken: resultado.accessToken,
        tokenType: 'Bearer',
        expiresIn: resultado.expiresIn,
        cliente: resultado.cliente,
      }, requestId)
    } catch (error) {
      log.error('Falha ao autenticar cliente por CPF', { err: serializarErro(error), cpf: cpfLog })
      return json(500, { statusCode: 500, message: 'Erro interno ao autenticar.' }, requestId)
    }
  }
}

let handlerPadrao: ReturnType<typeof criarHandler> | undefined

function montarHandlerPadrao() {
  const dbSecretId = variavel('DB_SECRET_ID')
  const jwtSecretId = variavel('JWT_SECRET_ID')
  const ttl = Number(variavel('TOKEN_TTL_SECONDS', '3600'))

  return criarHandler(new AutenticarClientePorCpf(
    new PgClienteRepository(() => lerSegredo<DbSecret>(dbSecretId)),
    new JoseTokenSigner(async () => (await lerSegredo<JwtSecret>(jwtSecretId)).secret, ttl),
  ))
}

export const handler = (event: APIGatewayProxyEventV2) => {
  handlerPadrao ??= montarHandlerPadrao()
  return handlerPadrao(event)
}
