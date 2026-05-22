import { describe, expect, it } from "bun:test";
import { runDirectCommand, type CommandAdapterRuntime } from "./command-adapter";
import type { CommandDeps } from "./commands/command";

function makeRuntime() {
  const stderr: string[] = [];
  const calls = {
    setVerbose: 0,
    credentialOverrides: [] as unknown[],
  };

  const runtime: CommandAdapterRuntime = {
    writeStderr: (text) => stderr.push(text),
    setVerbose: () => {
      calls.setVerbose += 1;
    },
    setCredentialOverrides: (overrides) => {
      calls.credentialOverrides.push(overrides);
    },
  };

  return {
    runtime,
    calls,
    stderr: () => stderr.join(""),
  };
}

describe("direct command adapter helper", () => {
  it("strips global credential flags before calling run", async () => {
    const output: string[] = [];
    const receivedArgs: string[][] = [];
    const context = makeRuntime();
    const deps: CommandDeps = {
      stdout: (text) => output.push(text),
      stderr: (text) => output.push(text),
    };

    const exitCode = await runDirectCommand(
      [
        "--url",
        "https://zod.tlon.network",
        "--cookie",
        "urbauth-~zod=0v-cookie",
        "--verbose",
        "--help",
      ],
      async (args) => {
        receivedArgs.push(args);
        return 0;
      },
      () => deps,
      context.runtime
    );

    expect(exitCode).toBe(0);
    expect(receivedArgs).toEqual([["--help"]]);
    expect(context.calls.setVerbose).toBe(1);
    expect(context.calls.credentialOverrides).toEqual([
      {
        kind: "cookie",
        url: "https://zod.tlon.network",
        cookie: "urbauth-~zod=0v-cookie",
        ship: undefined,
        code: undefined,
      },
    ]);
    expect(context.stderr()).toBe("");
  });

  it("fails malformed direct credential flags before calling run", async () => {
    const context = makeRuntime();
    let runCalled = false;

    const exitCode = await runDirectCommand(
      ["--url", "https://zod.tlon.network", "--help"],
      async () => {
        runCalled = true;
        return 0;
      },
      () => ({
        stdout: () => {},
        stderr: () => {},
      }),
      context.runtime
    );

    expect(exitCode).toBe(1);
    expect(runCalled).toBe(false);
    expect(context.stderr()).toContain("Invalid credential flags");
    expect(context.stderr()).toContain('Run "tlon --help" for usage information.');
    expect(context.calls.credentialOverrides).toEqual([]);
  });

  it("formats unexpected run exceptions once at the adapter boundary", async () => {
    const context = makeRuntime();

    const exitCode = await runDirectCommand(
      ["mentions"],
      async () => {
        throw new Error("unexpected adapter failure");
      },
      () => ({
        stdout: () => {},
        stderr: () => {},
      }),
      context.runtime
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe("Error: unexpected adapter failure\n");
  });
});
