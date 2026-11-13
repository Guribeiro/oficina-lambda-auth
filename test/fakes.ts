import type { ClienteAutenticavel, ClienteRepository } from '../src/domain/autenticar-cliente.js'
import type { Cpf } from '../src/domain/cpf.js'

export class InMemoryClienteRepository implements ClienteRepository {
  constructor(public clientes: Array<ClienteAutenticavel & { cpf: string }> = []) { }

  async buscarPorCpf(cpf: Cpf) {
    const encontrado = this.clientes.find((c) => c.cpf === cpf)
    if (!encontrado) return null
    return { id: encontrado.id, nome: encontrado.nome, status: encontrado.status, deletadoEm: encontrado.deletadoEm }
  }
}

export const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente-para-hs256'

export const CPF_ATIVO = '52998224725'
export const CPF_BLOQUEADO = '11144477735'
export const CPF_INATIVO = '93541134780'

export function clientesSeed() {
  return new InMemoryClienteRepository([
    { cpf: CPF_ATIVO, id: 'cli-ativo', nome: 'João da Silva', status: 'ATIVO', deletadoEm: null },
    { cpf: CPF_BLOQUEADO, id: 'cli-bloq', nome: 'Maria Bloqueada', status: 'BLOQUEADO', deletadoEm: null },
    { cpf: CPF_INATIVO, id: 'cli-inat', nome: 'Carlos Inativo', status: 'INATIVO', deletadoEm: new Date() },
  ])
}
