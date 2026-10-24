#!/usr/bin/env bun
import { $ } from "bun"
import { chmod, copyFile, mkdir, mkdtemp, rename, rm } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

const root = path.resolve(import.meta.dir, "..")
const version = "1.19.4-ocv.4.14-listeners.1"
await $`bun install --frozen-lockfile`.cwd(root)
await $`bun run packages/opencode/script/build.ts --single --skip-install`.cwd(root).env({
  ...process.env,
  OPENCODE_VERSION: version,
  OPENCODE_CHANNEL: "latest",
  OPENCODE_RELEASE: "",
})

const source = path.join(root, `packages/opencode/dist/opencode-${process.platform}-${process.arch}/bin/opencode`)
const directory = path.join(process.env.XDG_DATA_HOME || path.join(homedir(), ".local/share"), "opencode-vim")
await mkdir(directory, { recursive: true })
const staging = await mkdtemp(path.join(directory, ".install-"))
try {
  const binary = path.join(staging, "ocv")
  await copyFile(source, binary)
  await chmod(binary, 0o755)
  const actual = (await $`${binary} --version`.text()).trim()
  if (actual !== version) throw new Error(`Expected ${version}, got ${actual}`)
  const destination = path.join(directory, "ocv")
  await rename(binary, destination)
  console.log(`Installed ${version} at ${destination}`)
} finally {
  await rm(staging, { recursive: true, force: true })
}
