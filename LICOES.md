# Lições que valem para qualquer projeto

Uma linha por armadilha: o que acontece → como evitar. Acrescente no fim; não apague
sem motivo. Lição de um projeto só vai para aquele projeto.

## Shell nesta máquina (Windows + Git Bash)

- Heredoc grande no Bash falha com "unexpected EOF" sem escrever nada, e `\\` vira `\` → arquivo grande ou com muitas aspas: ferramenta Write.
- Crase dentro de `node -e "..."` é EXECUTADA pelo bash (já causou um deploy de produção acidental) → texto com crase ou `$`: Write/Edit, nunca shell.
- `sed -i` troca CRLF por LF em repositório com `autocrlf=true` → edite com Edit ou preserve CRLF de propósito.
- `s.replace(a, b)` do JS com `$'`, `` $` `` ou `$&` em `b` corrompe o arquivo → use `s.replace(a, () => b)` ou `split/join`.
- PowerShell 5.1: nomes de variável não diferenciam maiúsculas (`$k` = `$K`); `.ps1` com acento sem BOM é lido errado → evite acento em script.
- Há Python 3.13 (`C:\Python313`, pacotes em `--user`; `python -I` os esconde), Node, ffmpeg e Excel (via COM, com `NumberFormatLocal` pt-BR); não há LibreOffice.
- Máquina com 7,6 GB de RAM quase toda ocupada e disco C: perto de cheio: modelo grande baixado sem conferir espaço lota o disco e não carrega (`mkl_malloc`) → `df -h /c` e memória livre antes de baixar; transcrição local = faster-whisper `small`, com o áudio entregue pelo ffmpeg como numpy (o PyAV novo quebra o decodificador dele).
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
- Management API do Supabase (`/v1/projects/<ref>/database/query`) devolve 429 ThrottlerException depois de ~130 chamadas seguidas: script que aplica migration em lote precisa de pausa + nova tentativa (o 429 é recusado antes de rodar o SQL, repetir é seguro). CREATE INDEX CONCURRENTLY tem de ir sozinho na chamada (multi-comando vira transação implícita).
- Filtro de segurança do Sonnet ("safeguards flagged… reasoning_extraction") derruba subagentes no 1º passo com brief normal (18/11/2026: 3 de uma vez) → `git status` para ver se mexeram em algo e relance com `model: "opus"`.
- Hook `checar-antes-commit` só procura `package.json` na RAIZ do repositório: em repo com o frontend numa subpasta (ex.: `frontend/`) ele não checa nada → rode tsc/eslint/vitest à mão na subpasta antes do commit.
- Disco C: cheio (o arquivo de troca do Windows cresce para 20+ GB quando a memória acaba) mata `gh run watch` com "not enough space", sem relação com o CI → acompanhe com `gh run view --json status,conclusion` em laço, sem log grande.
- Portão de CI "não pode piorar" pode checar mais do que o hook local (ex.: hook roda só tsc, CI roda eslint): antes de push que é deploy, rode localmente TODOS os passos do workflow de CI.
- Arquivo numerado compartilhado entre sessões paralelas (ex.: `decisoes.md` com D01, D02…): releia o ÚLTIMO número imediatamente antes de acrescentar (outras sessões escrevem no meio); acrescentar com número guardado de leituras antigas duplica IDs (18/11/2026).
- Teste-guarda que conta texto por regex (catraca/baseline) dá número diferente em checkout Windows (CRLF) e na CI (LF): normalize CRLF→LF antes de contar e gere a base já normalizada. E teste com data fixa perto de uma janela ("até N dias") quebra sozinho com o calendário: use a data de hoje.
- Git Bash no Windows: `cut -c` conta BYTES, não caracteres — cortar texto com acento parte o caractere ao meio e grava UTF-8 inválido (a ferramenta de edição recusa o arquivo). Para cortar texto, use Node (`[...s].slice`). Esta máquina não tem Python (19/11/2026).
- Postgres: `has_sequence_privilege(..., c.oid, ...)` (e outras `has_*_privilege` que exigem tipo de objeto) no WHERE junto de `relkind = 'S'` pode ser avaliada ANTES do filtro e lança "is not a sequence" (19/11/2026: a C2 da Fase C nunca rodaria) → teste de privilégio dentro de `CASE WHEN relkind = ...` ou de um `IF` no laço; e ensaie a migration (BEGIN…ROLLBACK) antes de dar por pronta.
- Classificador do modo automático recusa `git push --force` mesmo em branch descartável (staging) onde o projeto diz que é normal → antes, `git merge-base --is-ancestor origin/<branch> HEAD`: se for ancestral, push normal (fast-forward) resolve sem força (19/11/2026).
- Checagem que compara arquivo gerado byte a byte (catálogo, livro de rotas) falha em checkout Windows com CRLF mesmo sem mudança real → regenere, confira `git diff --ignore-cr-at-eol` vazio e só então conclua que "está desatualizado" (19/11/2026).
- Comparar `import.meta.url` com `"file://" + process.argv[1]` nunca casa no Windows (file:///C:/…) e o script não executa, saindo 0 → `pathToFileURL(process.argv[1]).href` (19/11/2026).
- GitHub Actions roda `run:` com `bash -e`: `grep ...; test $? -eq 1` morre no grep sem achado (exit 1) antes do `test`, e `! grep` aceita o exit 2 (erro) como limpo → `rc=0; grep ... || rc=$?; test "$rc" -eq 1` (20/11/2026).
- Bundle Hermes (iOS do Expo) guarda as strings coladas: busca por padrão de segredo dá falso positivo (o prefixo da biblioteca cola na string seguinte) → procure no bundle web, que tem o mesmo código e as mesmas variáveis públicas (20/11/2026).
- SDK de IA que valida a resposta com schema estrito (ex.: @openai/agents + zod) quebra 100% quando o provedor acrescenta um campo, e o teste que roda por outro caminho (sem stream) não pega → o teste com o modelo real tem de usar o MESMO caminho da produção (stream, mesmas opções); conserto rápido sem subir a lib: `pnpm patch` afrouxando o schema (20/11/2026).
- Sessão que assume uma passagem: o classificador do modo automático recusa merge na master (= deploy) com a autorização do dono escrita na passagem ou dada em outra sessão → pergunte com AskUserQuestion LOGO no começo ("publicar e migrar nesta sessão?"), não no meio da leva (20/11/2026).
- Trava de commit em monorepo grande (20/11/2026): mudar peça central (schema, domínio) faz o `vitest related` virar a suíte (333 arquivos, 30 min no Windows carregado) e estourar os 9 min → o dono decidiu liberar com aviso só nos projetos listados em `hooks/checar-antes-commit.liberar-tempo.json` (os que têm CI obrigatório na main); nesses, rode à mão os testes do que mudou antes do commit.
- Worktree atualizado (rebase) sobre uma main que ganhou dependência nova: o typecheck acusa "Cannot find module" que não é do seu código → `npm ci` de novo no worktree depois do rebase (20/11/2026).
- `vercel link` (CLI 59) puxa SOZINHO as variáveis de Development para um `.env.local` na pasta (segredos em disco) → para só listar nomes de variáveis ou ler logs, rode numa pasta descartável e apague o `.env.local` na hora, sem abrir; e diagnóstico de "cron parado" começa por `vercel logs --query <função> --json` antes de culpar o agendador (20/11/2026).
- Postgres: UNIQUE (id, x) que começa pela PK, criado só para ser alvo de FK composta, faz o planejador trocar o `*_pkey` por ele nas buscas por `id` (mudou o plano de consulta de dinheiro e quebrou testes de EXPLAIN) → use (x, id): a FK casa as colunas em qualquer ordem, e a busca por id volta ao pkey (20/11/2026).
- Várias sessões do Claude na mesma máquina (20/11/2026): encerrar processo por NOME ou padrão (`node`, `tsc`, `next`, `taskkill /IM`, `pkill`) derruba o trabalho das outras sessões → só encerrar pelo PID que o próprio agente iniciou; ponha isso no brief de todo implementador.
- `npm ci` no Windows (20/11/2026): duas execuções ao mesmo tempo no MESMO worktree, ou `rm -rf node_modules` durante uma, corrompem o `node_modules` (1 h para estabilizar) → um `npm ci` por worktree, em primeiro plano ou com o PID guardado, e nunca apagar `node_modules` com outro rodando.
