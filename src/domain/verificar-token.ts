export type Role = 'CLIENTE' | 'MECANICO' | 'RECEPCAO' | 'ADMIN'

export const ROLES: ReadonlyArray<Role> = ['CLIENTE', 'MECANICO', 'RECEPCAO', 'ADMIN']

export interface TokenVerificado {
  sub: string
  role: Role
}

export interface TokenVerifier {
  /** Retorna o payload quando assinatura e expiração são válidas; null caso contrário. */
  verificar(token: string): Promise<TokenVerificado | null>
}

/** Extrai o token de um cabeçalho "Authorization: Bearer <token>". */
export function extrairBearer(authorization: string | undefined): string | null {
  if (!authorization) return null
  const [esquema, token, ...resto] = authorization.trim().split(/\s+/)
  if (resto.length > 0 || !token || esquema?.toLowerCase() !== 'bearer') return null
  return token
}
