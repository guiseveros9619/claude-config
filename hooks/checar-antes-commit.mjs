// Hook global (PreToolUse em Bash/PowerShell): antes de "git commit", roda o
// typecheck e os testes do projeto. Falhou -> bloqueia o commit (exit 2).
// Erro do próprio hook nunca bloqueia (exit 0 com aviso): um hook quebrado não
// pode travar commits em todos os projetos.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CODIGO = /\.(ts|tsx|js|jsx|mjs|cjs|sql|vue|svelte|py)$/i;

function sh(cmd, cwd, timeout = 540_000) {
  return spawnSync(cmd, {
    cwd, shell: true, encoding: "utf8", timeout,
    env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
    maxBuffer: 50 * 1024 * 1024,
  });
}

function bloquear(msg) {
  process.stderr.write(msg + "\n");
  process.exit(2);
}

try {
  const entrada = JSON.parse(readFileSync(0, "utf8") || "{}");
  const cmd = String(entrada?.tool_input?.command ?? "");
  if (!/\bgit\b[^\n;&|]*\bcommit\b/.test(cmd)) process.exit(0);

  // Pasta do commit: "git -C <dir>", senão "cd <dir> &&", senão a da sessão.
  let dir = entrada.cwd || process.cwd();
  const mC = cmd.match(/\bgit\s+-C\s+("([^"]+)"|'([^']+)'|(\S+))/);
  const mCd = cmd.match(/(?:^|[;&]\s*)(?:cd|Set-Location)\s+("([^"]+)"|'([^']+)'|(\S+))\s*(?:&&|;)/);
  const alvo = mC || mCd;
  if (alvo) dir = resolve(dir, alvo[2] ?? alvo[3] ?? alvo[4]);

  const raiz = sh("git rev-parse --show-toplevel", dir, 20_000).stdout?.trim();
  if (!raiz) process.exit(0);

  // Só código dispara a checagem (commit só de texto/docs passa direto).
  const arquivos = [
    sh("git diff --name-only HEAD", raiz, 20_000).stdout,
    sh("git diff --cached --name-only", raiz, 20_000).stdout,
  ].join("\n").split(/\r?\n/).filter(Boolean);
  if (!arquivos.some((f) => CODIGO.test(f))) process.exit(0);

  const pkgPath = join(raiz, "package.json");
  if (!existsSync(pkgPath)) process.exit(0);
  const scripts = JSON.parse(readFileSync(pkgPath, "utf8")).scripts ?? {};

  const passos = [];
  if (scripts.typecheck) passos.push(["typecheck", "npm run typecheck"]);
  else if (existsSync(join(raiz, "tsconfig.json"))) passos.push(["typecheck", "npx --no-install tsc --noEmit"]);
  if (scripts.test && !/no test specified/i.test(scripts.test)) passos.push(["testes", "npm test"]);
  if (passos.length === 0) process.exit(0);

  if (!existsSync(join(raiz, "node_modules"))) {
    bloquear(`Commit bloqueado: não há node_modules em ${raiz}. Rode "npm install" (worktree novo precisa) e tente de novo.`);
  }

  for (const [nome, comando] of passos) {
    const r = sh(comando, raiz);
    if (r.error?.code === "ETIMEDOUT" || r.signal) {
      bloquear(`Commit bloqueado: ${nome} passou do tempo limite (${comando}). Rode-o à mão e confira.`);
    }
    if (r.status !== 0) {
      const saida = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim().split(/\r?\n/).slice(-40).join("\n");
      bloquear(`Commit bloqueado: ${nome} falhou (${comando}). Corrija e tente de novo.\n--- últimas linhas ---\n${saida}`);
    }
  }
  process.exit(0);
} catch (e) {
  process.stderr.write(`[checar-antes-commit] erro do hook, commit liberado: ${e?.message ?? e}\n`);
  process.exit(0);
}
