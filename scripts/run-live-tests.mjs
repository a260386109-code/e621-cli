import { spawn } from "node:child_process";

const child = spawn("npx", ["vitest", "run", "test/live.test.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    E621_LIVE_TEST: "1"
  }
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
