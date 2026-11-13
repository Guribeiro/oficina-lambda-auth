// Empacota cada handler em dist/<funcao>/index.mjs (um zip por Lambda, gerado pelo Terraform).
import { build } from 'esbuild'
import { rm } from 'node:fs/promises'

const funcoes = {
  'auth-cpf': 'src/handlers/auth-cpf.ts',
  authorizer: 'src/handlers/authorizer.ts',
}

await rm('dist', { recursive: true, force: true })

for (const [nome, entrada] of Object.entries(funcoes)) {
  await build({
    entryPoints: [entrada],
    outfile: `dist/${nome}/index.mjs`,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    sourcemap: 'linked',
    minify: true,
    // O AWS SDK v3 já está disponível no runtime da Lambda; pg-native é opcional no pg.
    external: ['@aws-sdk/*', 'pg-native'],
    // Bibliotecas CommonJS empacotadas em ESM precisam de require.
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
    logLevel: 'info',
  })
}
