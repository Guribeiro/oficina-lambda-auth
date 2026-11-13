import { describe, expect, it, vi } from 'vitest'
import { AutenticarClientePorCpf, type TokenSigner } from '../src/domain/autenticar-cliente.js'
import { CPF_ATIVO, CPF_BLOQUEADO, CPF_INATIVO, InMemoryClienteRepository, clientesSeed } from './fakes.js'

const signer: TokenSigner = { assinar: vi.fn(async () => ({ token: 'jwt', expiresIn: 3600 })) }

describe('AutenticarClientePorCpf', () => {
  it('emite token para cliente ativo com payload { sub, role: CLIENTE, cpf }', async () => {
    const sut = new AutenticarClientePorCpf(clientesSeed(), signer)

    const resultado = await sut.executar('529.982.247-25')

    expect(resultado).toEqual({
      ok: true,
      accessToken: 'jwt',
      expiresIn: 3600,
      cliente: { id: 'cli-ativo', nome: 'João da Silva' },
    })
    expect(signer.assinar).toHaveBeenCalledWith({ sub: 'cli-ativo', role: 'CLIENTE', cpf: CPF_ATIVO })
  })

  it('recusa CPF inválido sem consultar o banco', async () => {
    const repo = new InMemoryClienteRepository()
    const buscar = vi.spyOn(repo, 'buscarPorCpf')

    const resultado = await new AutenticarClientePorCpf(repo, signer).executar('123')

    expect(resultado).toEqual({ ok: false, falha: { tipo: 'CPF_INVALIDO' } })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('informa cliente não encontrado', async () => {
    const resultado = await new AutenticarClientePorCpf(new InMemoryClienteRepository(), signer).executar(CPF_ATIVO)
    expect(resultado).toEqual({ ok: false, falha: { tipo: 'CLIENTE_NAO_ENCONTRADO' } })
  })

  it.each([
    [CPF_BLOQUEADO, 'BLOQUEADO'],
    [CPF_INATIVO, 'INATIVO'],
  ])('recusa cliente %s com status %s', async (cpf, status) => {
    const resultado = await new AutenticarClientePorCpf(clientesSeed(), signer).executar(cpf)
    expect(resultado).toEqual({ ok: false, falha: { tipo: 'CLIENTE_INATIVO', status } })
  })

  it('trata cliente ATIVO com exclusão lógica como inativo', async () => {
    const repo = new InMemoryClienteRepository([
      { cpf: CPF_ATIVO, id: 'x', nome: 'X', status: 'ATIVO', deletadoEm: new Date() },
    ])
    const resultado = await new AutenticarClientePorCpf(repo, signer).executar(CPF_ATIVO)
    expect(resultado).toEqual({ ok: false, falha: { tipo: 'CLIENTE_INATIVO', status: 'INATIVO' } })
  })
})
