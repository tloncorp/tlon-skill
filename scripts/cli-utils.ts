/**
 * CLI argument parsing utilities
 */

/**
 * Get an option value from command line args
 * @param args Array of arguments
 * @param name Option name (without --)
 * @returns The option value or undefined
 */
export function getOption(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return undefined;
}

export function hasOptionValue(args: string[], name: string): boolean {
  const idx = args.indexOf(`--${name}`);
  const value = idx !== -1 ? args[idx + 1] : undefined;
  return !!value && !value.startsWith("--");
}

/**
 * Check if a flag is present in args
 * @param args Array of arguments
 * @param name Flag name (without --)
 * @returns true if flag is present
 */
export function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

/**
 * Read the value after an option that requires one.
 */
export function getRequiredOptionValue(args: string[], index: number, flag = args[index]): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

/**
 * Check if help was requested for a command/subcommand
 */
export function wantsHelp(args: string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

export function isHelpArg(arg: string | undefined): boolean {
  return arg === "--help" || arg === "-h";
}

export function printHelpAndExit(help: string): never {
  console.log(help);
  process.exit(0);
}

export function printUsageAndExit(help: string): never {
  console.error(help);
  process.exit(1);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function printErrorAndExit(error: unknown): never {
  console.error(`Error: ${errorMessage(error)}`);
  process.exit(1);
}

export const CHANNEL_KINDS = ["chat", "diary", "heap"] as const;

/**
 * Detect the common mistake of passing channel kind positionally instead of via --kind.
 * Example: groups add-channel <group> chat "Title"
 */
export function looksLikePositionalChannelKind(
  args: string[],
  titleIndex: number,
  kindOptionName = "kind"
): boolean {
  const title = args[titleIndex];
  const nextPositional = args[titleIndex + 1];
  return (
    !!title &&
    CHANNEL_KINDS.includes(title as (typeof CHANNEL_KINDS)[number]) &&
    !!nextPositional &&
    !getOption(args, kindOptionName)
  );
}
