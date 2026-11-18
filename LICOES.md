# Lições que valem para qualquer projeto

Uma linha por armadilha: o que acontece → como evitar. Acrescente no fim; não apague
sem motivo. Lição de um projeto só vai para aquele projeto.

## Shell nesta máquina (Windows + Git Bash)

- Heredoc grande no Bash falha com "unexpected EOF" sem escrever nada, e `\\` vira `\` → arquivo grande ou com muitas aspas: ferramenta Write.
- Crase dentro de `node -e "..."` é EXECUTADA pelo bash (já causou um deploy de produção acidental) → texto com crase ou `$`: Write/Edit, nunca shell.
- `sed -i` troca CRLF por LF em repositório com `autocrlf=true` → edite com Edit ou preserve CRLF de propósito.
- `s.replace(a, b)` do JS com `$'`, `` $` `` ou `$&` em `b` corrompe o arquivo → use `s.replace(a, () => b)` ou `split/join`.
- PowerShell 5.1: nomes de variável não diferenciam maiúsculas (`$k` = `$K`); `.ps1` com acento sem BOM é lido errado → evite acento em script.
- Não há Python nem LibreOffice; há Node e Excel (via COM, com `NumberFormatLocal` pt-BR).
- Chrome headless não emula celular com `--window-size` → `puppeteer-core` com `setViewport`.

## Ferramentas e serviços

- `supabase db query --linked` não aguenta chamadas paralelas (respostas vazias) → sempre em fila única, com nova tentativa.
- PostgREST trunca em 1.000 linhas sem erro → leitura grande sempre paginada com ordem estável.
- `void supabase.from(...).insert(...)` não grava nada (o builder só envia no `then`) → sempre `await` e confira `{ error }`.

## Agentes

- Limite do Fable derruba todos os subagentes dele de uma vez (429) → relance com `model: "opus"`.
- Subagente que só grava o relatório no fim perde tudo se for interrompido → peça para gravar cedo e ir completando.
- Worktrees com `node_modules` por junção compartilham um diretório só: `npm install` interrompido nele poda pacotes de todos (sumiu o vitest) → para um pacote avulso, `npm pack` + `tar -x` direto na pasta; reparo = `npm install` no worktree de referência.
- Hook de pré-commit que roda a suíte inteira trava frota em worktree com CRLF (`core.autocrlf=true`): shebang + CRLF quebra o vitest, teste que compara SQL falha → `.gitattributes` com `eol=lf` para `*.sql`/`*.mjs` antes de lançar a frota.
- `cmd | tail` devolve o código de saída do `tail`, não do `cmd` (build vermelho relatado como verde) → `cmd > log 2>&1; echo exit=$?` e só depois leia o log.
- **Trava de commit e suíte grande (18/11/2026):** `npm test` inteiro passa de 9 min e carrega vermelho de ambiente em projeto grande (TiChat: 23 min, 55 arquivos). O hook `checar-antes-commit` agora roda `vitest related --run --hookTimeout=120000` só nos arquivos alterados; teste com banco PGlite estoura 30 s de preparo quando roda em paralelo — rodar sozinho antes de concluir que falhou.
