// code-map integration: optional by default, mandatory when teach.codeMap = "required".
import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const CLI = join(import.meta.dir, "cli.ts");
let home = "", data = "", project = "", fakeBin = "", log = "";

// A stand-in `code-map` that answers the handful of queries Plum makes, and logs every call.
function fakeCodeMap(indexed: boolean): string {
  const bin = join(home, "code-map");
  writeFileSync(bin, `#!/bin/sh
echo "$@" >> "${log}"
case "$*" in
  *"count(f)"*)            if [ -f "${home}/indexed" ] || [ "${indexed}" = "true" ]; then echo '[{"c":12}]'; else echo '[{"c":0}]'; fi ;;
  index*)                  touch "${home}/indexed"; echo '{"graph":"g","files":12,"entities":40}' ;;
  *"Library"*)             echo '[{"f":"src/orders/order.service.ts","l":"@prisma/client"}]' ;;
  *"INHERITS"*)            echo '[{"a":"PrismaOrderRepository","af":"src/orders/order.prisma.repository.ts","b":"OrderRepository"}]' ;;
  *"CALLS"*)               echo '[{"f":"src/orders/order.service.ts","n":"OrderRepository"}]' ;;
  *"HAS_METHOD"*)          echo '[{"k":"Class","n":"OrderService","s":4,"m":"cancel","ms":7}]' ;;
  *) echo '[]' ;;
esac
`);
  chmodSync(bin, 0o755);
  return bin;
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "plum-codemap-"));
  data = join(home, "data"); mkdirSync(data);
  project = join(home, "shop"); mkdirSync(join(project, "src", "orders"), { recursive: true });
  writeFileSync(join(project, "src", "orders", "order.service.ts"), "export class OrderService {\n  cancel() {}\n}\n");
  log = join(home, "calls.log");
  fakeBin = "";
});

function plum(args: string[], mode?: string, bin?: string): { out: string; code: number } {
  if (mode) writeFileSync(join(data, "config.json"), JSON.stringify({ teach: { codeMap: mode } }));
  const p = Bun.spawnSync(["bun", CLI, "teach", ...args], {
    cwd: project,
    env: { ...process.env, PLUM_DATA_DIR: data, CLAUDE_PROJECT_DIR: project, PLUM_CODE_MAP_BIN: bin ?? join(home, "missing-code-map") }
  });
  return { out: p.stdout.toString() + p.stderr.toString(), code: p.exitCode ?? 0 };
}

test("auto mode without code-map strongly recommends installing it", () => {
  const r = plum(["survey", "--concept", "repository"], "auto");
  expect(r.code).toBe(0);
  expect(r.out).toContain("Strongly recommended: install code-map");
  expect(r.out).toContain("cargo install");
});

test("required mode without code-map stops with install instructions", () => {
  const r = plum(["survey", "--concept", "repository"], "required");
  expect(r.code).not.toBe(0);
  expect(r.out).toContain("teach.codeMap is \"required\"");
  expect(r.out).toContain("cargo install");
});

test("auto mode with an indexed graph adds graph facts to the survey", () => {
  fakeBin = fakeCodeMap(true);
  const r = plum(["survey", "--concept", "repository"], "auto", fakeBin);
  expect(r.out).toContain("## From code-map");
  expect(r.out).toContain("src/orders/order.service.ts → @prisma/client");
  expect(r.out).toContain("PrismaOrderRepository");
  expect(r.out).not.toContain("Strongly recommended");
});

test("auto mode with code-map but no index suggests indexing, without indexing on its own", () => {
  fakeBin = fakeCodeMap(false);
  const r = plum(["survey", "--concept", "repository"], "auto", fakeBin);
  expect(r.out).toContain("plum teach index");
  expect(Bun.file(join(home, "indexed")).size).toBe(0);
});

test("required mode indexes an unindexed repo automatically, then uses the graph", () => {
  fakeBin = fakeCodeMap(false);
  const r = plum(["survey", "--concept", "repository"], "required", fakeBin);
  expect(r.code).toBe(0);
  expect(r.out).toContain("## From code-map");
  expect(require("fs").readFileSync(log, "utf-8")).toContain("index");
});

test("outline uses graph declarations when available", () => {
  fakeBin = fakeCodeMap(true);
  const r = plum(["outline", "src/orders/order.service.ts"], "auto", fakeBin);
  expect(r.out).toContain("4: Class OrderService");
  expect(r.out).toContain("7:   cancel()");
});

test("off mode never calls code-map", () => {
  fakeBin = fakeCodeMap(true);
  plum(["survey", "--concept", "repository"], "off", fakeBin);
  expect(Bun.file(log).size).toBe(0);
});

test("teach index indexes the project", () => {
  fakeBin = fakeCodeMap(false);
  const r = plum(["index"], "auto", fakeBin);
  expect(r.code).toBe(0);
  expect(r.out).toContain("Indexed");
});
