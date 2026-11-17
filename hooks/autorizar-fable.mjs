// Hook global (PreToolUse em Agent): todo uso do Fable por subagente
// (arquiteto-geral, ou qualquer agente com model "fable") exige a confirmação
// do usuário no próprio Claude Code. A regra "ask" de permissions é ignorada
// no modo automático; a decisão "ask" de hook não é.
import { readFileSync } from "node:fs";

const ALVO = new RegExp(process.env.FABLE_GATE_AGENTES || "arquiteto-geral", "i");

try {
  const entrada = JSON.parse(readFileSync(0, "utf8") || "{}");
  const t = entrada.tool_input ?? {};
  const usaFable = ALVO.test(String(t.subagent_type ?? "")) || /fable/i.test(String(t.model ?? ""));
  if (!usaFable) process.exit(0);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: "Uso do Fable 5.2 (modelo caro). Só autorize em tarefa grave.",
    },
  }));
  process.exit(0);
} catch {
  process.exit(0);
}
