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

/**
 * Check if a flag is present in args
 * @param args Array of arguments
 * @param name Flag name (without --)
 * @returns true if flag is present
 */
export function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}
