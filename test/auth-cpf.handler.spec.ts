import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import jsonwebtoken from 'jsonwebtoken'
import { beforeAll, describe, expect, it } from 'vitest'
import { AutenticarClientePorCpf } from '../src/domain/autenticar-cliente.js'
import { criarHandler } from '../src/handlers/auth-cpf.js'
import { JoseTokenSigner } from '../src/infra/jwt.js'
import { CPF_ATIVO, CPF_BLOQUEADO, SEGREDO, clientesSeed } from './fakes.js'

beforeAll(() => {
  process.env.LOG_LEVEL = 'silent'
})

function evento(body?: unknown, base64 = false): APIGatewayProxyEventV2 {
  const texto = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  return {
    body: texto && base64 ? Buffer.from(texto).toString('base64') : texto,
    isBase64Encoded: base64,
    requestContext: { requestId: 'req-123' },
  } as unknown as APIGatewayProxyEventV2
}

const handler = criarHandler(
  new AutenticarClientePorCpf(clientesSeed(), new JoseTokenSigner(async () => SEGREDO, 3600)),
)

describe('POST /auth/cpf', () => {
  it('retorna 200 com JWT aceito pelo @nestjs/jwt da API (jsonwebtoken, HS256)', async () => {
    const resposta = await handler(evento({ cpf: '529.982.247-25' }))
    const body = JSON.parse(resposta.body as string)

    expect(resposta.statusCode).toBe(200)
    expect(resposta.headers).toMatchObject({ 'x-request-id': 'req-123', 'cache-control': 'no-store' })
    expect(body).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600, cliente: { id: 'cli-ativo' } })

    const payload = jsonwebtoken.verify(body.accessToken, SEGREDO) as jsonwebtoken.JwtPayload
    expect(payload).toMatchObject({ sub: 'cli-ativo', role: 'CLIENTE', cpf: CPF_ATIVO, iss: 'oficina-lambda-auth' })
    expect(payload.exp! - payload.iat!).toBe(3600)
  })

  it('aceita corpo em base64', async () => {
    const resposta = await handler(evento({ cpf: CPF_ATIVO }, true))
    expect(resposta.statusCode).toBe(200)
  })

  it.each([
    ['CPF inválido', { cpf: '12345678900' }, 400],
    ['corpo ausente', undefined, 400],
    ['JSON malformado', '{cpf:', 400],
    ['cliente inexistente', { cpf: '39053344705' }, 404],
    ['cliente bloqueado', { cpf: CPF_BLOQUEADO }, 403],
  ])('%s -> %i', async (_caso, body, statusCode) => {
    const resposta = await handler(evento(body))
    expect(resposta.statusCode).toBe(statusCode)
    expect(JSON.parse(resposta.body as string)).toMatchObject({ statusCode })
  })

  it('retorna 500 sem vazar detalhes quando o banco falha', async () => {
    const quebrado = criarHandler(new AutenticarClientePorCpf(
      { buscarPorCpf: async () => { throw new Error('connection refused 10.0.0.1') } },
      new JoseTokenSigner(async () => SEGREDO, 3600),
    ))

    const resposta = await quebrado(evento({ cpf: CPF_ATIVO }))

    expect(resposta.statusCode).toBe(500)
    expect(resposta.body).not.toContain('10.0.0.1')
  })
})
