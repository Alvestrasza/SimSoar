import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function configPath(environment = process.env, platform = process.platform) {
  const base = platform === "win32" ? environment.LOCALAPPDATA : environment.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  if (!base) throw new Error("config_directory_unavailable");
  return path.join(base, "SimSoar", "companion.json");
}

export async function loadConfig(file = configPath()) {
  try { const stored = JSON.parse(await fs.readFile(file, "utf8")); return {approvedInstallRoots: [], approvedResultRoots: [], simulatorPaths: {}, ...stored}; }
  catch (error) { if (error?.code === "ENOENT") return {apiBaseUrl: "", approvedInstallRoots: [], approvedResultRoots: [], simulatorPaths: {}}; throw error; }
}

export async function saveConfig(config, file = configPath()) {
  await fs.mkdir(path.dirname(file), {recursive: true, mode: 0o700});
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, {mode: 0o600, flag: "wx"});
  await fs.rename(temporary, file);
  await fs.chmod(file, 0o600).catch(() => undefined);
}
