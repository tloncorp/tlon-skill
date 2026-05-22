import {
  type CliCredentialOverrides,
  setCliCredentialOverrides,
} from "./api-client";
import { CredentialFlagError, parseGlobalCliOptions } from "./credential-flags";
import {
  type CommandDeps,
  type CommandRunner,
  formatUnexpectedError,
} from "./commands/command";

export interface CommandAdapterRuntime {
  writeStderr: (text: string) => void;
  setVerbose: () => void;
  setCredentialOverrides: (overrides: CliCredentialOverrides | null) => void;
}

export const processCommandAdapterRuntime: CommandAdapterRuntime = {
  writeStderr: (text) => process.stderr.write(text),
  setVerbose: () => {
    process.env.TLON_VERBOSE = "1";
  },
  setCredentialOverrides: setCliCredentialOverrides,
};

function formatCredentialFlagError(error: CredentialFlagError): string {
  return `Error: ${error.message}\nRun "tlon --help" for usage information.\n`;
}

export async function runDirectCommand<TDeps extends CommandDeps>(
  rawArgs: string[],
  run: CommandRunner<TDeps>,
  createDeps: () => TDeps,
  runtime: CommandAdapterRuntime = processCommandAdapterRuntime
): Promise<number> {
  let parsed;
  try {
    parsed = parseGlobalCliOptions(rawArgs);
  } catch (error) {
    if (error instanceof CredentialFlagError) {
      runtime.writeStderr(formatCredentialFlagError(error));
      return 1;
    }
    throw error;
  }

  if (parsed.verbose) {
    runtime.setVerbose();
  }

  runtime.setCredentialOverrides(parsed.credentialOverrides);

  try {
    return await run(parsed.args, createDeps());
  } catch (error) {
    runtime.writeStderr(formatUnexpectedError(error));
    return 1;
  }
}

export async function runDirectCommandAndExit<TDeps extends CommandDeps>(
  run: CommandRunner<TDeps>,
  createDeps: () => TDeps
): Promise<never> {
  const exitCode = await runDirectCommand(process.argv.slice(2), run, createDeps);
  process.exit(exitCode);
}
