// Hook global (PreToolUse em Bash/PowerShell): antes de "git commit", roda o
// typecheck e os testes do projeto. Falhou -> bloqueia o commit (exit 2).
// Erro do próprio hook nunca bloqueia (exit 0 com aviso): um hook quebrado não
// pode travar commits em todos os projetos.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CODIGO = /\.(ts|tsx|js|jsx|mjs|cjs|sql|vue|svelte|py)$/i;

function sh(cmd, cwd, timeout = 540_000, extra = {}) {
  return spawnSync(cmd, {
    cwd, shell: true, encoding: "utf8", timeout,
    env: { ...process.env, CI: "true", FORCE_COLOR: "0", ...extra },
    maxBuffer: 50 * 1024 * 1024,
  });
}

// "TZ=UTC vitest run" -> { TZ: "UTC" }: o prefixo de variável não funciona no cmd do Windows,
// então ele vira env do processo.
function envDoScript(script) {
  const env = {};
  let s = String(script).trim(), m;
  while ((m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)=(\S+)\s+/))) { env[m[1]] = m[2]; s = s.slice(m[0].length); }
  return env;
}

// Pasta do package.json mais próximo do arquivo, sem sair da raiz (monorepo: o workspace dele).
function pacoteDe(raiz, arquivo) {
  let d = dirname(join(raiz, arquivo));
  while (d.length >= raiz.length) {
    if (existsSync(join(d, "package.json"))) return d;
    const cima = dirname(d);
    if (cima === d) break;
    d = cima;
  }
  return raiz;
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
  // Vitest: só os testes ligados aos arquivos alterados (a suíte inteira de projeto grande passa do
  // tempo limite e carrega vermelho de ambiente que não é do commit). Outros runners: npm test.
  const alterados = [...new Set(arquivos)].filter((f) => CODIGO.test(f) && existsSync(join(raiz, f)));
  if (scripts.test && /\bvitest\b/.test(scripts.test)) {
    if (alterados.length) passos.push(["testes", `npx --no-install vitest related --run --hookTimeout=120000 ${alterados.map((f) => `"${f}"`).join(" ")}`, raiz, envDoScript(scripts.test)]);
  } else {
    // Monorepo: a raiz só delega. Roda o vitest related em cada workspace que tem arquivo alterado.
    const grupos = new Map();
    for (const f of alterados) {
      const pkg = pacoteDe(raiz, f);
      if (pkg === raiz) continue;
      if (!grupos.has(pkg)) grupos.set(pkg, []);
      grupos.get(pkg).push(relative(pkg, join(raiz, f)));
    }
    let achouVitest = false;
    for (const [pkg, fs] of grupos) {
      const t = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).scripts?.test ?? "";
      if (!/\bvitest\b/.test(t)) continue;
      achouVitest = true;
      passos.push([`testes (${relative(raiz, pkg)})`, `npx --no-install vitest related --run --hookTimeout=120000 ${fs.map((f) => `"${f}"`).join(" ")}`, pkg, envDoScript(t)]);
    }
    if (!achouVitest && scripts.test && !/no test specified/i.test(scripts.test)) passos.push(["testes", "npm test"]);
  }
  if (passos.length === 0) process.exit(0);

  if (!existsSync(join(raiz, "node_modules"))) {
    bloquear(`Commit bloqueado: não há node_modules em ${raiz}. Rode "npm install" (worktree novo precisa) e tente de novo.`);
  }

  // Projetos em que TESTE ou TYPECHECK que estoura o tempo só avisa (decisões do dono, 20/11/2026 para os testes e 23/11/2026
  // para o typecheck): lá a suíte ligada a uma peça central passa de 30 min, o typecheck do monorepo passa de 9 min com a
  // máquina carregada, e o CI obrigatório da main é o juiz. Falha de verdade (status ≠ 0) continua bloqueando.
  // Lista de trechos da URL do origin em checar-antes-commit.liberar-tempo.json.
  let liberaTempoDosTestes = false;
  try {
    const lista = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "checar-antes-commit.liberar-tempo.json"), "utf8"));
    const origem = sh("git remote get-url origin", raiz, 20_000).stdout?.trim() ?? "";
    liberaTempoDosTestes = Array.isArray(lista) && lista.some((trecho) => origem.includes(trecho));
  } catch { /* sem a lista, nenhum projeto libera */ }

  for (const [nome, comando, cwd = raiz, extra = {}] of passos) {
    const r = sh(comando, cwd, 540_000, extra);
    if (r.error?.code === "ETIMEDOUT" || r.signal) {
      if (liberaTempoDosTestes && (nome.startsWith("testes") || nome === "typecheck")) {
        process.stderr.write(`[checar-antes-commit] AVISO: ${nome} passou do tempo limite; liberado neste projeto (o CI obrigatório julga). Rode à mão o ${nome} do que mudou.\n`);
        continue;
      }
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
