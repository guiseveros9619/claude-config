// Publica o padrão de desenvolvimento a partir da fonte única (~/.claude):
//  1. regenera ~/.codex/AGENTS.md (CLAUDE.md global + skill fluxo-dev + regras do Ponytail);
//  2. faz commit e push do repositório ~/.claude (só os arquivos do .gitignore-lista).
// Uso: node ~/.claude/scripts/publicar-padrao.mjs ["mensagem do commit"]
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CLAUDE = join(homedir(), ".claude");
const CODEX = join(homedir(), ".codex");
const ler = (p) => readFileSync(join(CLAUDE, p), "utf8").replace(/\r\n/g, "\n");
const semFrontmatter = (t) => t.replace(/^---\n[\s\S]*?\n---\n/, "");

const agentsMd = [
  "<!-- GERADO por ~/.claude/scripts/publicar-padrao.mjs. NÃO edite aqui: edite ~/.claude e rode o script. -->",
  "",
  "# Padrão de desenvolvimento (cópia para o Codex)",
  "",
  "Este é o mesmo padrão do Claude Code. Adaptações para o Codex:",
  "",
  "- Leia as instruções do projeto: `AGENTS.md` e também **`CLAUDE.md`** (raiz e pastas que a",
  "  tarefa toca). Muitos projetos desta máquina só têm `CLAUDE.md`; ele vale como `AGENTS.md`.",
  "- Onde o texto cita agentes (`implementador`, `operario`, `revisor`, `arquiteto-geral`): se o",
  "  ambiente não tiver subagentes, faça você mesmo cada etapa, revisando com olhar adversarial.",
  "  Modelo mais caro só em tarefa grave e **com autorização do usuário**.",
  "- `AskUserQuestion` = pergunte ao usuário. `PushNotification`, hooks e `EnterWorktree` podem não",
  "  existir: use `git worktree` direto e ignore o que não houver. Os caminhos `~/.claude/...`",
  "  (LICOES.md, scripts) existem nesta máquina e valem para você também.",
  "",
  ler("CLAUDE.md"),
  "",
  "# Skill fluxo-dev (passo a passo de tarefa que muda código)",
  "",
  semFrontmatter(ler("skills/fluxo-dev/SKILL.md")).replace(/^# /gm, "## "),
  "",
  ler("padrao/ponytail-regras.md"),
  "",
].join("\n");

const bytes = Buffer.byteLength(agentsMd, "utf8");
if (!existsSync(CODEX)) mkdirSync(CODEX, { recursive: true });
writeFileSync(join(CODEX, "AGENTS.md"), agentsMd, "utf8");
console.log(`~/.codex/AGENTS.md regenerado (${bytes} bytes).`);
if (bytes > 32 * 1024) console.log("AVISO: passou de 32 KB, o limite padrão de leitura do Codex. Enxugue o CLAUDE.md ou a skill.");

const git = (cmd) => execSync(`git ${cmd}`, { cwd: CLAUDE, encoding: "utf8" }).trim();
try {
  git("add -A");
  if (!git("status --porcelain")) { console.log("Nada novo para commitar em ~/.claude."); process.exit(0); }
  const msg = (process.argv[2] || "atualiza padrão de desenvolvimento").replace(/"/g, "'");
  git(`commit -q -m "${msg}"`);
  console.log(`Commit feito: ${msg}`);
  if (git("remote")) { git("push -q"); console.log("Push feito."); }
  else console.log("Sem remote configurado: commit só local.");
} catch (e) {
  console.error(`Falha no git de ~/.claude: ${e?.message ?? e}`);
  process.exit(1);
}
