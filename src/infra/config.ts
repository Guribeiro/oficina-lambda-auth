export function variavel(nome: string, padrao?: string): string {
  const valor = process.env[nome] ?? padrao
  if (!valor) throw new Error(`Variável de ambiente ${nome} não configurada`)
  return valor
}
