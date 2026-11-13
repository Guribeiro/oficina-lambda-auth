import { jwtVerify, SignJWT } from 'jose'
import type { TokenPayload, TokenSigner } from '../domain/autenticar-cliente.js'
import { ROLES, type Role, type TokenVerificado, type TokenVerifier } from '../domain/verificar-token.js'

const ALGORITMO = 'HS256'
export const ISSUER = 'oficina-lambda-auth'

function chave(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

/** Emite tokens HS256 compatíveis com o JwtStrategy da API (@nestjs/jwt). */
export class JoseTokenSigner implements TokenSigner {
  constructor(
    private readonly obterSegredo: () => Promise<string>,
    private readonly ttlSegundos: number,
  ) { }

  async assinar(payload: TokenPayload) {
    const token = await new SignJWT({ role: payload.role, cpf: payload.cpf })
      .setProtectedHeader({ alg: ALGORITMO, typ: 'JWT' })
      .setSubject(payload.sub)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSegundos}s`)
      .sign(chave(await this.obterSegredo()))

    return { token, expiresIn: this.ttlSegundos }
  }
}

/**
 * Valida tokens emitidos pela Lambda (clientes) e pela própria API (funcionários):
 * ambos usam o mesmo segredo HS256; o issuer não é exigido porque os tokens de
 * funcionários não o definem.
 */
export class JoseTokenVerifier implements TokenVerifier {
  constructor(private readonly obterSegredo: () => Promise<string>) { }

  async verificar(token: string): Promise<TokenVerificado | null> {
    try {
      const { payload } = await jwtVerify(token, chave(await this.obterSegredo()), {
        algorithms: [ALGORITMO],
      })

      const role = payload.role as Role
      if (typeof payload.sub !== 'string' || !ROLES.includes(role)) return null

      return { sub: payload.sub, role }
    } catch {
      return null
    }
  }
}
