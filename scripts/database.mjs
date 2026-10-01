import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(".demo");
const data = join(root, "postgres");
const bin = process.env.POSTGRES_BIN || "C:/Program Files/PostgreSQL/18/bin";
export function database(action = "start") {
  const run = (name, args, allowFailure = false) => {
    const result = spawnSync(
      join(bin, `${name}${process.platform === "win32" ? ".exe" : ""}`),
      args,
      {
        encoding: "utf8",
        windowsHide: true,
        stdio: name === "pg_ctl" && args.includes("start") ? "ignore" : "pipe",
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0 && !allowFailure)
      throw new Error(result.stderr || result.stdout);
    return result;
  };
  if (action === "stop") {
    run("pg_ctl", ["-D", data, "stop", "-m", "fast"]);
    return;
  }
  mkdirSync(root, { recursive: true });
  if (!existsSync(join(data, "PG_VERSION")))
    run("initdb", [
      "-D",
      data,
      "-U",
      "ad_demo",
      "--auth=trust",
      "--encoding=UTF8",
      "--no-locale",
    ]);
  const status = run("pg_ctl", ["-D", data, "status"], true);
  if (status.status !== 0)
    run("pg_ctl", [
      "-D",
      data,
      "-l",
      join(root, "postgres.log"),
      "-o",
      "-h 127.0.0.1 -p 55432",
      "start",
    ]);
  const check = run("psql", [
    "-h",
    "127.0.0.1",
    "-p",
    "55432",
    "-U",
    "ad_demo",
    "-d",
    "postgres",
    "-tAc",
    "SELECT 1 FROM pg_database WHERE datname = 'ad_demo'",
  ]);
  if (!check.stdout.includes("1"))
    run("createdb", [
      "-h",
      "127.0.0.1",
      "-p",
      "55432",
      "-U",
      "ad_demo",
      "ad_demo",
    ]);
  console.log(
    "Demo PostgreSQL is running on 127.0.0.1:55432 (fictional data only).",
  );
}
if (process.argv[1]?.endsWith("database.mjs")) database(process.argv[2]);
