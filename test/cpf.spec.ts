import { describe, expect, it } from 'vitest'
import { mascararCpf, parseCpf } from '../src/domain/cpf.js'

describe('parseCpf', () => {
  it.each(['52998224725', '529.982.247-25', ' 529 982 247 25 ', 52998224725])('aceita CPF válido em diferentes formatos: %s', (valor) => {
    expect(parseCpf(valor)).toBe('52998224725')
  })

  it.each([
    ['dígito verificador errado', '52998224724'],
    ['tamanho incorreto', '5299822472'],
    ['sequência repetida', '111.111.111-11'],
    ['CNPJ', '82811607000116'],
    ['vazio', ''],
    ['não string', { cpf: '52998224725' }],
    ['indefinido', undefined],
  ])('rejeita %s', (_caso, valor) => {
    expect(parseCpf(valor)).toBeNull()
  })

  it('mascara o CPF para logs', () => {
    expect(mascararCpf('52998224725')).toBe('529.***.***-25')
  })
})
