import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda'
import jsonwebtoken from 'jsonwebtoken'
import { beforeAll, describe, expect, it } from 'vitest'
import { extrairBearer } from '../src/domain/verificar-token.js'
import { criarHandler } from '../src/handlers/authorizer.js'
import { JoseTokenSigner, JoseTokenVerifier } from '../src/infra/jwt.js'
import { SEGREDO } from './fakes.js'

beforeAll(() => {
  process.env.LOG_LEVEL = 'silent'
})

const handler = criarHandler(new JoseTokenVerifier(async () => SEGREDO))

function evento(authorization?: string): APIGatewayRequestAuthorizerEventV2 {
  return {
    routeKey: 'ANY /api/{proxy+}',
    headers: authorization ? { authorization } : {},
    identitySource: authorization ? [authorization] : [],
    requestContext: { requestId: 'req-1' },
  } as unknown as APIGatewayRequestAuthorizerEventV2
}

describe('Lambda Authorizer', () => {
  it('autoriza token de cliente emitido pela Lambda auth-cpf', async () => {
    const { token } = await new JoseTokenSigner(async () => SEGREDO, 60)
      .assinar({ sub: 'cli-1', role: 'CLIENTE', cpf: '52998224725' })

    expect(await handler(evento(`Bearer ${token}`))).toEqual({
      isAuthorized: true,
      context: { sub: 'cli-1', role: 'CLIENTE' },
    })
  })

  it('autoriza token de funcionário emitido pela API (@nestjs/jwt)', async () => {
    const token = jsonwebtoken.sign({ sub: 'func-1', role: 'RECEPCAO' }, SEGREDO, { expiresIn: '1d' })

    expect(await handler(evento(`Bearer ${token}`))).toEqual({
      isAuthorized: true,
      context: { sub: 'func-1', role: 'RECEPCAO' },
    })
  })

  it.each([
    ['sem cabeçalho', undefined],
    ['esquema diferente de Bearer', `Basic ${Buffer.from('a:b').toString('base64')}`],
    ['token malformado', 'Bearer abc.def'],
    ['assinado com outro segredo', `Bearer ${jsonwebtoken.sign({ sub: 'x', role: 'ADMIN' }, 'outro-segredo')}`],
    ['expirado', `Bearer ${jsonwebtoken.sign({ sub: 'x', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) - 10 }, SEGREDO)}`],
    ['perfil desconhecido', `Bearer ${jsonwebtoken.sign({ sub: 'x', role: 'ROOT' }, SEGREDO)}`],
    ['algoritmo none', `Bearer ${jsonwebtoken.sign({ sub: 'x', role: 'ADMIN' }, '', { algorithm: 'none' })}`],
  ])('nega: %s', async (_caso, authorization) => {
    expect(await handler(evento(authorization))).toEqual({ isAuthorized: false, context: {} })
  })

  it('nega quando a leitura do segredo falha', async () => {
    const quebrado = criarHandler(new JoseTokenVerifier(async () => { throw new Error('secrets indisponível') }))
    const token = jsonwebtoken.sign({ sub: 'x', role: 'ADMIN' }, SEGREDO)
    expect(await quebrado(evento(`Bearer ${token}`))).toEqual({ isAuthorized: false, context: {} })
  })
})

describe('extrairBearer', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    ['  Bearer   abc  ', 'abc'],
    ['Bearer', null],
    ['Bearer a b', null],
    ['Token abc', null],
  ])('%s -> %s', (entrada, esperado) => {
    expect(extrairBearer(entrada)).toBe(esperado)
  })
})
