/**
 * CPF validado (somente dígitos). Mesmo formato gravado pela API em clientes.documento.
 */
export type Cpf = string & { readonly __brand: 'Cpf' }

function digitoVerificador(base: string): number {
  const pesoInicial = base.length + 1
  const soma = [...base].reduce((acc, digito, i) => acc + Number(digito) * (pesoInicial - i), 0)
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

/** Normaliza (remove pontuação) e valida os dígitos verificadores. */
export function parseCpf(valor: unknown): Cpf | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null

  const digitos = String(valor).replace(/\D/g, '')

  if (digitos.length !== 11) return null
  // Sequências repetidas (000.000.000-00, 111...) passam no cálculo, mas são inválidas.
  if (/^(\d)\1{10}$/.test(digitos)) return null

  const base = digitos.slice(0, 9)
  const dv1 = digitoVerificador(base)
  const dv2 = digitoVerificador(base + dv1)

  return digitos === `${base}${dv1}${dv2}` ? (digitos as Cpf) : null
}

/** 529.***.***-25: mascara o CPF para logs. */
export function mascararCpf(cpf: string): string {
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(-2)}`
}
