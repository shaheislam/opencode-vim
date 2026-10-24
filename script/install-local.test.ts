import { expect, test } from "bun:test"
import { chmod, mkdtemp, readdir, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const version = "1.19.4-ocv.4.14-listeners.1"

async function fixture(mode = "success", xdg = true) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "ocv-local-install-")))
  const repo = path.join(root, "checkout with spaces")
  const bin = path.join(root, "bin")
  const data = path.join(root, xdg ? "data" : "home/.local/share")
  const destination = path.join(data, "opencode-vim/ocv")
  await Bun.write(path.join(repo, "script/install-local.ts"), Bun.file(path.join(import.meta.dir, "install-local.ts")))
  await Bun.write(destination, "previous binary")
  await Bun.write(
    path.join(bin, "bun"),
    `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$TEST_LOG"
if [ "$1" = install ]; then exit 0; fi
[ "$PWD" = "$TEST_REPO" ]
[ "$OPENCODE_VERSION" = "${version}" ]
[ "$OPENCODE_CHANNEL" = latest ]
[ -z "$OPENCODE_RELEASE" ]
[ "$TEST_MODE" != build-failure ] || exit 42
mkdir -p "packages/opencode/dist/opencode-${process.platform}-${process.arch}/bin"
printf '#!/bin/sh\\nprintf "%%s\\\\n" "%s"\\n' "$TEST_BINARY_VERSION" > "packages/opencode/dist/opencode-${process.platform}-${process.arch}/bin/opencode"
`,
  )
  await chmod(path.join(bin, "bun"), 0o755)
  const run = () =>
    Bun.spawn([process.execPath, path.join(repo, "script/install-local.ts")], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        HOME: path.join(root, "home"),
        XDG_DATA_HOME: xdg ? data : "",
        OPENCODE_RELEASE: "1",
        OPENCODE_VERSION: "unrelated-inherited-version",
        TEST_REPO: repo,
        TEST_LOG: path.join(root, "commands"),
        TEST_MODE: mode,
        TEST_BINARY_VERSION: mode === "bad-version" ? "wrong-version" : version,
      },
      stdout: "ignore",
      stderr: "ignore",
    }).exited
  return { root, destination, run }
}

test("installs the pinned native build from any cwd using XDG or HOME", async () => {
  for (const xdg of [true, false]) {
    const app = await fixture("success", xdg)
    try {
      expect(await app.run()).toBe(0)
      expect(await Bun.file(path.join(app.root, "commands")).text()).toBe(
        "install --frozen-lockfile\nrun packages/opencode/script/build.ts --single --skip-install\n",
      )
      const result = Bun.spawnSync([app.destination, "--version"])
      expect(result.exitCode).toBe(0)
      expect(result.stdout.toString().trim()).toBe(version)
      expect(await readdir(path.dirname(app.destination))).toEqual(["ocv"])
    } finally {
      await rm(app.root, { recursive: true, force: true })
    }
  }
})

for (const mode of ["build-failure", "bad-version"]) {
  test(`${mode} preserves the installed client and cleans staging files`, async () => {
    const app = await fixture(mode)
    try {
      expect(await app.run()).not.toBe(0)
      expect(await Bun.file(app.destination).text()).toBe("previous binary")
      expect(await readdir(path.dirname(app.destination))).toEqual(["ocv"])
    } finally {
      await rm(app.root, { recursive: true, force: true })
    }
  })
}
