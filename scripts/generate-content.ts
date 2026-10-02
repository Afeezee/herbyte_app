/**
 * Content-agent CLI — thin wrapper around server/agent/runner.ts.
 *
 * The runner is shared with the cron endpoint. The CLI's `submit`
 * function POSTs over HTTPS to the public API (default:
 * https://herbyte.cereustechnologies.com), using the service token
 * header for auth. For a local test against `vercel dev`, pass
 * --endpoint=http://localhost:3000.
 *
 * Usage:
 *   npm run agent                       # one post, respects daily cap
 *   npm run agent -- --n=3              # up to 3 posts (still daily-capped)
 *   npm run agent -- --dry-run          # draft without submitting
 *   npm run agent -- --kind=remedy
 *   npm run agent -- --force-research
 *   npm run agent -- --endpoint=http://localhost:3000
 */
import "dotenv/config";
import { runAgentBatch, type SubmitFn } from "../server/agent/runner";
import { getEnv } from "../server/env";

type Cli = {
  n: number;
  dryRun: boolean;
  kind: "herb" | "remedy" | null;
  forceResearch: boolean;
  skipResearch: boolean;
  endpoint: string;
};

function parseCli(): Cli {
  const args = process.argv.slice(2);
  const o: Cli = {
    n: 1,
    dryRun: false,
    kind: null,
    forceResearch: false,
    skipResearch: false,
    endpoint:
      process.env.AGENT_API_BASE ??
      process.env.HERBYTE_API_BASE ??
      "https://herbyte.cereustechnologies.com",
  };
  for (const a of args) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--force-research") o.forceResearch = true;
    else if (a === "--skip-research") o.skipResearch = true;
    else if (a === "--kind=herb" || a === "--kind=remedy") o.kind = a.split("=")[1] as "herb" | "remedy";
    else if (a.startsWith("--n=")) {
      const n = Number(a.slice("--n=".length));
      if (Number.isFinite(n) && n > 0) o.n = Math.floor(n);
    } else if (a.startsWith("--endpoint=")) o.endpoint = a.slice("--endpoint=".length);
  }
  return o;
}

async function main(): Promise<number> {
  const cli = parseCli();
  const env = getEnv();

  if (!env.AGENT_SERVICE_TOKEN) {
    console.error("AGENT_SERVICE_TOKEN not set — add it to .env");
    return 1;
  }

  const endpoint = cli.endpoint.replace(/\/$/, "");
  const submit: SubmitFn = async (path, body) => {
    const res = await fetch(`${endpoint}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-service-token": env.AGENT_SERVICE_TOKEN!,
        authorization: "Bearer agent",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string } }).error;
      return { ok: false, status: res.status, message: err?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: data as { id?: string; moderation_status?: string } };
  };

  const report = await runAgentBatch(cli.n, {
    submit,
    forceKind: cli.kind ?? undefined,
    forceResearch: cli.forceResearch,
    skipResearch: cli.skipResearch,
    dryRun: cli.dryRun,
  });

  console.log(`\nendpoint:    ${endpoint}`);
  console.log(`today after: ${report.todayAfter}/${report.dailyCap}`);
  if (report.skippedReason) {
    console.log(`skipped:     ${report.skippedReason}`);
    return report.skippedReason === "misconfigured" ? 1 : 0;
  }
  console.log(`attempted:   ${report.attempted}`);
  console.log(`posted:      ${report.posted}`);
  for (const r of report.results) {
    const mark = r.ok ? "✓" : "✗";
    const name = r.display_name ?? "(no draft)";
    const status = r.moderation_status ?? r.error ?? "";
    console.log(
      `  ${mark} [${r.kind}] ${name}  (${r.category}/${r.region}, ${r.generation_method}) → ${status}`,
    );
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[agent] fatal", err);
    process.exit(1);
  });
