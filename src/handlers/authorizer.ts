import type { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerWithContextResult } from 'aws-lambda'
import { extrairBearer, type TokenVerifier } from '../domain/verificar-token.js'
import { variavel } from '../infra/config.js'
import { JoseTokenVerifier } from '../infra/jwt.js'
import { criarLogger, serializarErro } from '../infra/logger.js'
import { lerSegredo, type JwtSecret } from '../infra/secrets.js'

type Contexto = { sub: string; role: string }
type Resultado = APIGatewaySimpleAuthorizerWithContextResult<Contexto | Record<string, never>>

const NEGADO: Resultado = { isAuthorized: false, context: {} }

/**
 * Lambda Authorizer (HTTP API, payload 2.0, respostas simples): libera a rota
 * quando o Bearer token tem assinatura e expiração válidas e um perfil conhecido.
 * A API NestJS revalida o token e aplica as regras de perfil por rota.
 */
export function criarHandler(verifier: TokenVerifier) {
  return async (event: APIGatewayRequestAuthorizerEventV2): Promise<Resultado> => {
    const log = criarLogger({ request_id: event.requestContext?.requestId, function: 'authorizer' })
    const authorization = event.headers?.authorization ?? event.identitySource?.[0]
    const token = extrairBearer(authorization)

    if (!token) {
      log.warn('Requisição sem Bearer token', { route: event.routeKey })
      return NEGADO
    }

    try {
      const verificado = await verifier.verificar(token)

      if (!verificado) {
        log.warn('Token inválido ou expirado', { route: event.routeKey })
        return NEGADO
      }

      return { isAuthorized: true, context: { sub: verificado.sub, role: verificado.role } }
    } catch (error) {
      log.error('Falha ao validar token', { err: serializarErro(error), route: event.routeKey })
      return NEGADO
    }
  }
}

let handlerPadrao: ReturnType<typeof criarHandler> | undefined

export const handler = (event: APIGatewayRequestAuthorizerEventV2) => {
  if (!handlerPadrao) {
    const jwtSecretId = variavel('JWT_SECRET_ID')
    handlerPadrao = criarHandler(new JoseTokenVerifier(async () => (await lerSegredo<JwtSecret>(jwtSecretId)).secret))
  }
  return handlerPadrao(event)
}
