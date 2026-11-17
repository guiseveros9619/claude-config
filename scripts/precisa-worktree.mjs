// Decide se uma tarefa que vai mudar código precisa de um git worktree próprio.
// Uso: node ~/.claude/scripts/precisa-worktree.mjs [pasta]
// Responde "SIM: <motivo>" ou "NAO: <motivo>". Na dúvida (erro), responde SIM.
import { execSync } from "node:child_process";

const norm = (p) => String(p).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
const run = (cmd, cwd) => execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
// Arquivos rastreados que mudam sozinhos (CLI) e não indicam outro agente.
const IGNORAR = [/^supabase\/\.temp\//];

try {
  const dir = process.argv[2] || process.cwd();
  let raiz;
  try { raiz = run("git rev-parse --show-toplevel", dir).trim(); } catch { console.log("NAO: não é repositório git"); process.exit(0); }

  const caminhos = run("git worktree list --porcelain", raiz)
    .split(/\r?\n/).filter((l) => l.startsWith("worktree ")).map((l) => norm(l.slice(9)));
  const principal = caminhos[0];
  if (norm(raiz) !== principal) { console.log("NAO: já está num worktree isolado"); process.exit(0); }
  const outrosWt = caminhos.slice(1);

  const sujos = run("git status --porcelain", raiz).split(/\r?\n/)
    .filter((l) => l && !l.startsWith("??"))
    .map((l) => l.slice(3).replace(/^"|"$/g, ""))
    .filter((f) => !IGNORAR.some((r) => r.test(f)));

  let ocupadas = 0, abertas = 0;
  try {
    const sessoes = JSON.parse(run("claude agents --json", raiz));
    for (const s of sessoes) {
      const c = norm(s.cwd ?? "");
      const noRepo = c === principal || c.startsWith(principal + "/");
      if (!noRepo || outrosWt.some((w) => c === w || c.startsWith(w + "/"))) continue;
      abertas++;
      if (s.status === "busy") ocupadas++;
    }
  } catch { /* sem a lista, decide só pelo git */ }

  // A própria sessão que roda este script conta como 1 ocupada.
  if (ocupadas > 1) console.log(`SIM: ${ocupadas - 1} outra(s) sessão(ões) trabalhando agora nesta pasta`);
  else if (sujos.length) console.log(`SIM: há ${sujos.length} arquivo(s) alterado(s) que não são desta tarefa (ex.: ${sujos[0]})`);
  else console.log(`NAO: nenhum outro agente trabalhando aqui (${abertas} sessão(ões) aberta(s), só esta ocupada)`);
} catch (e) {
  console.log(`SIM: não consegui verificar (${e?.message ?? e}); na dúvida, isole`);
}
