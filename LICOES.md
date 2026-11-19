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
- Teste-guarda que conta texto por regex (catraca/baseline) dá número diferente em checkout Windows (CRLF) e na CI (LF): normalize 
 antes de contar e gere a base já normalizada. E teste com data fixa perto de uma janela ("até N dias") quebra sozinho com o calendário: use a data de hoje.
