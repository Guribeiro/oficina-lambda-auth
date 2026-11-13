import { parseCpf, type Cpf } from './cpf.js'

export type StatusCliente = 'ATIVO' | 'INATIVO' | 'BLOQUEADO'

export interface ClienteAutenticavel {
  id: string
  nome: string
  status: StatusCliente
  deletadoEm: Date | null
}

/** Consulta de clientes (implementada sobre o PostgreSQL da aplicação). */
export interface ClienteRepository {
  buscarPorCpf(cpf: Cpf): Promise<ClienteAutenticavel | null>
}

export interface TokenPayload {
  sub: string
  role: 'CLIENTE'
  cpf: string
}

export interface TokenSigner {
  assinar(payload: TokenPayload): Promise<{ token: string; expiresIn: number }>
}

export type FalhaAutenticacao =
  | { tipo: 'CPF_INVALIDO' }
  | { tipo: 'CLIENTE_NAO_ENCONTRADO' }
  | { tipo: 'CLIENTE_INATIVO'; status: StatusCliente }

export type ResultadoAutenticacao =
  | { ok: true; accessToken: string; expiresIn: number; cliente: { id: string; nome: string } }
  | { ok: false; falha: FalhaAutenticacao }

/**
 * Caso de uso: valida o CPF, verifica existência e status do cliente e emite o JWT
 * aceito pela API (mesmo segredo e formato de payload validados pelo JwtStrategy).
 */
export class AutenticarClientePorCpf {
  constructor(
    private readonly clientes: ClienteRepository,
    private readonly signer: TokenSigner,
  ) { }

  async executar(cpfInformado: unknown): Promise<ResultadoAutenticacao> {
    const cpf = parseCpf(cpfInformado)
    if (!cpf) return { ok: false, falha: { tipo: 'CPF_INVALIDO' } }

    const cliente = await this.clientes.buscarPorCpf(cpf)
    if (!cliente) return { ok: false, falha: { tipo: 'CLIENTE_NAO_ENCONTRADO' } }

    if (cliente.status !== 'ATIVO' || cliente.deletadoEm) {
      const status = cliente.status === 'ATIVO' ? 'INATIVO' : cliente.status
      return { ok: false, falha: { tipo: 'CLIENTE_INATIVO', status } }
    }

    const { token, expiresIn } = await this.signer.assinar({ sub: cliente.id, role: 'CLIENTE', cpf })

    return {
      ok: true,
      accessToken: token,
      expiresIn,
      cliente: { id: cliente.id, nome: cliente.nome },
    }
  }
}
