---
name: fluxo-dev
description: Fluxo padrão de desenvolvimento em QUALQUER projeto — plano, revisão do plano, implementação por time de agentes (Sonnet implementa, Haiku faz o mecânico, Opus revisa, Fable só em tarefa grave autorizada), auditoria, verificação e commit/push. Use em toda tarefa que muda código (feature, correção, refatoração, migração), mesmo quando o usuário não cita o fluxo.
argument-hint: "<tarefa>"
---

# Fluxo de desenvolvimento

Ordem fixa: **1 plano → 2 revisão do plano → 3 implementação → 4 auditoria → 5 verificação e commit/push.**
O CLAUDE.md do projeto vence este arquivo onde os dois conflitarem (caminho de deploy, de migração,
comandos de teste, proibições).

## 0. Classifique a tarefa

| Tamanho | Quando | Fluxo |
|---|---|---|
| **Trivial** | texto, config de uma linha, renomear, sem lógica nova | delegue ao `operario`/`implementador` (ou faça direto se for menor que o brief), confira, commite |
| **Normal** | lógica nova ou alterada em poucos arquivos, sem os riscos abaixo | plano curto, 1 revisão do plano, implementação, 1 auditoria do diff |
| **Delicada** | banco, migração, dinheiro, autenticação, produção, dado de terceiro, contrato entre módulos, mais de ~5 arquivos | fluxo completo; revisão do plano até aprovar; auditoria por entrega **e** do conjunto; ensaio antes de produção |

Na dúvida, o maior. Diga no início, em uma linha, o tamanho e (se grande) quantos agentes vai usar.

### Fable: candidato e autorização

Candidato **só** com risco real: banco/migração em produção, dinheiro, autenticação ou permissão,
dado de terceiro, mudança irreversível, contrato com muitos chamadores, **alteração cirúrgica de
infraestrutura** (deploy, domínio, DNS, variáveis, configuração de serviço) ou **risco de quebrar
outras funcionalidades** (código compartilhado, motor, função com muitos usos). Fora disso, não
pergunte e não use.

Sendo candidato, **antes de planejar** pergunte com `AskUserQuestion`: uma frase com o risco e as
opções "Sim, usar Fable 5.2 (plano e auditoria geral)" / "Não, só Opus". Com "sim", lance o
`arquiteto-geral`: o Claude Code ainda mostra uma confirmação própria (hook `autorizar-fable`),
que é a trava de segurança. A autorização vale só para esta tarefa. Erro de limite (429): relance
o `arquiteto-geral` com `model: "opus"` e diga no relato.

## 1. Plano

Quem escreve: o `arquiteto-geral` (Modo 1) se o Fable foi autorizado (grave o que ele devolver
em arquivo); senão o coordenador (Opus).

Leia o código que a mudança toca: chamadores, testes, tipos, banco. Se for usar biblioteca, API ou
serviço pela primeira vez no projeto, ou numa versão recente, **confirme na documentação atual**.
O plano vai para um arquivo (no repositório se o projeto versiona planos, ex.: `PLANO_*.md`; senão
no scratchpad) e contém:

- **Problema e evidência**: arquivo/linha ou dado que prova.
- **Mudança mínima** (degraus do Ponytail): existe pronto no código? na biblioteca padrão? numa
  dependência instalada? Só então código novo. Dependência nova: confirme que é o pacote oficial
  (nome exato), mantido nos últimos meses, e diga o motivo.
- **Frentes**: arquivos exatos de cada uma (paralelas nunca compartilham arquivo), contrato literal
  (assinaturas, tipos, nomes), critério de pronto.
- **Testes**: o teste que reproduz o defeito ou prova a regra, escrito **antes** da correção.
- **Riscos, raio de explosão e reversão**: o que mais pode quebrar e como desfazer.
- **Verificação**: comandos exatos (typecheck, testes, lint).

## 2. Revisão do plano (`revisor`, Opus)

Mande o caminho do plano com "revise o PLANO de forma adversarial". Reprovou: corrija e reenvie
até aprovar (em delicada, no mínimo uma rodada completa). Não implemente com plano reprovado.

## 3. Implementação

- **Isolamento**: antes de editar, rode `node ~/.claude/scripts/precisa-worktree.mjs`. Se responder
  **SIM** (outro agente trabalhando no mesmo projeto, ou alterações que não são suas), trabalhe num
  git worktree próprio (`EnterWorktree` ou `git worktree add`) e instale as dependências nele. Se
  **NAO**, crie um branch na própria pasta. Implementadores paralelos da MESMA tarefa com arquivos
  disjuntos podem dividir o mesmo worktree/branch.
- Cada frente vai a um `implementador` (Sonnet) com **brief curto e literal**: trecho do plano,
  arquivos permitidos, contrato, teste a escrever primeiro, comandos de verificação, caminho do
  worktree e arquivo do relatório (gravar cedo e ir completando).
- Mecânico (consultas, levantamentos, textos, documentação) vai ao `operario` (Haiku).
- Frentes disjuntas em paralelo; frentes que se tocam, em sequência.
- **Escrita em produção é sempre do coordenador** (migração, backfill, deploy, variável de
  ambiente). Subagente não acessa banco de produção. Em tarefa delicada, **ensaie antes**:
  transação desfeita (BEGIN…ROLLBACK) ou dry-run, backup da tabela antes de alterar dados, preview
  antes do deploy de produção quando o projeto permitir.
- Erro: até **3 abordagens diferentes** (não o mesmo comando 3 vezes). Não resolveu: pare e explique
  em linguagem simples o que acontece, o que tentou e o que sugere.

## 4. Auditoria

- **Cada entrega** de `implementador` passa pelo `revisor` (Opus) antes de entrar no branch: diff,
  trecho do plano e critério de pronto. Reprovou: volta ao `implementador` com a lista.
- Delicada: no fim, auditoria do **conjunto** (diff inteiro contra o plano) — pelo
  `arquiteto-geral` (Modo 2) se o Fable foi autorizado, senão pelo `revisor`.

## 5. Verificação e commit/push (coordenador)

1. Rode a verificação do plano e a que o projeto exige. Vermelho não segue: corrija e volte à
   auditoria do que mudou. O hook `checar-antes-commit` roda typecheck e testes antes de todo
   `git commit` com código e bloqueia se falharem: corrija, não contorne.
2. Commit com mensagem que diz o porquê, push, PR. Com verificação e CI verdes, **faça o merge**.
   Remova o worktree, se houver.
3. Relato no formato do CLAUDE.md global (curto, para leigo). Achados das revisões e detalhes
   técnicos vão num arquivo; o relato aponta onde.

## Briefs

- Subagente não vê esta conversa: o brief tem tudo (caminhos, contrato, comandos). Nunca "faça como
  combinamos".
- Relatório curto na resposta, detalhe num arquivo do scratchpad.
- Ao `revisor`, passe o código e o critério, não a sua conclusão.
