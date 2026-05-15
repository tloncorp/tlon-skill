export const COMMAND_FAMILIES = [
  "activity",
  "channels",
  "contacts",
  "dms",
  "expose",
  "groups",
  "hooks",
  "messages",
  "notebook",
  "posts",
  "settings",
  "upload",
] as const;

export const SUBCOMMAND_FAMILIES = COMMAND_FAMILIES.filter(
  (family) => family !== "notebook" && family !== "upload"
);

export type CliCase = {
  name: string;
  args: string[];
  expectedExitCode: number;
  stdout?: string;
  stderr?: string;
  stdoutIncludes?: string[];
  stderrIncludes?: string[];
  stdoutExcludes?: string[];
  stderrExcludes?: string[];
};

const SCRIPT_ERA_PATTERNS = [
  "npx ts-node",
  "activity.ts",
  "channels.ts",
  "contacts.ts",
  "dms.ts",
  "expose.ts",
  "groups.ts",
  "hooks.ts",
  "main.ts",
  "messages.ts",
  "notebook-post.ts",
  "posts.ts",
  "settings.ts",
  "upload.ts",
];

const STACK_PATTERNS = [
  "\n    at ",
  "\n  at ",
  "api-client.ts:",
  "notebook-post.ts:",
  "dist/tlon-run:",
  "error: Uncaught",
];

const AUTH_CONFIG_PATTERNS = [
  "Missing Urbit config",
  "Multiple cached ships",
  "Ship config not found",
  "Invalid config:",
  "Failed to parse config",
  "OpenClaw",
  "TLON_CONFIG_FILE",
  "TLON_CACHE_DIR",
  "Using cached credentials",
  "Credentials cached",
];

function helpCase(name: string, args: string[], usage: string): CliCase {
  return {
    name,
    args,
    expectedExitCode: 0,
    stderr: "",
    stdoutIncludes: ["Usage:", usage],
    stdoutExcludes: SCRIPT_ERA_PATTERNS,
  };
}

function usageErrorCase(name: string, args: string[], usage = "Usage:"): CliCase {
  return {
    name,
    args,
    expectedExitCode: 1,
    stdout: "",
    stderrIncludes: [usage],
    stderrExcludes: [
      ...SCRIPT_ERA_PATTERNS,
      ...STACK_PATTERNS,
      ...AUTH_CONFIG_PATTERNS,
    ],
  };
}

export const TOP_LEVEL_HELP_CASE = helpCase("top-level --help", ["--help"], "tlon");

export const UNKNOWN_TOP_LEVEL_CASE: CliCase = {
  name: "unknown top-level command",
  args: ["definitely-not-a-command"],
  expectedExitCode: 1,
  stdout: "",
  stderrIncludes: [
    "Unknown command: definitely-not-a-command",
    'Run "tlon --help" for usage information.',
  ],
  stderrExcludes: [...STACK_PATTERNS, ...AUTH_CONFIG_PATTERNS],
};

export const FAMILY_HELP_CASES: CliCase[] = COMMAND_FAMILIES.flatMap((family) => [
  helpCase(`${family} --help`, [family, "--help"], `tlon ${family}`),
  helpCase(`${family} -h`, [family, "-h"], `tlon ${family}`),
]);

export const FAMILY_BARE_CASES: CliCase[] = COMMAND_FAMILIES.map((family) =>
  usageErrorCase(`${family} bare invocation`, [family], `Usage: tlon ${family}`)
);

export const INVALID_SUBCOMMAND_CASES: CliCase[] = SUBCOMMAND_FAMILIES.map((family) =>
  usageErrorCase(`${family} invalid subcommand`, [
    family,
    "definitely-not-a-subcommand",
  ])
);

export const MISSING_REQUIRED_CASES: CliCase[] = [
  usageErrorCase("channels info missing nest", ["channels", "info"], "Usage: tlon channels info"),
  usageErrorCase("contacts get missing ship", ["contacts", "get"], "Usage: tlon contacts get"),
  usageErrorCase("dms send missing args", ["dms", "send"], "Usage: tlon dms send"),
  usageErrorCase("expose show missing cite", ["expose", "show"], "Usage: tlon expose show"),
  usageErrorCase("groups info missing id", ["groups", "info"], "Usage: tlon groups info"),
  usageErrorCase("hooks init missing name", ["hooks", "init"], "Usage: tlon hooks init"),
  usageErrorCase("messages dm missing ship", ["messages", "dm"], "Usage: tlon messages dm"),
  usageErrorCase("notebook missing args", ["notebook"], "Usage: tlon notebook"),
  usageErrorCase("posts react missing args", ["posts", "react"], "Usage: tlon posts react"),
  usageErrorCase("settings set missing args", ["settings", "set"], "Usage: tlon settings set"),
  usageErrorCase("upload missing input", ["upload"], "Usage: tlon upload"),
];

export const SPECIAL_INPUT_CASES: CliCase[] = [
  {
    ...usageErrorCase(
      "upload unknown option",
      ["upload", "--definitely-not-an-option"],
      "Unknown option: --definitely-not-an-option"
    ),
    stderrIncludes: [
      "Error: Unknown option: --definitely-not-an-option",
      "Usage: tlon upload",
    ],
  },
  {
    name: "notebook unknown option",
    args: [
      "notebook",
      "diary/~host/notes",
      "Title",
      "--definitely-not-an-option",
    ],
    expectedExitCode: 1,
    stdout: "",
    stderrIncludes: ["Error: Unknown option: --definitely-not-an-option"],
    stderrExcludes: [
      ...SCRIPT_ERA_PATTERNS,
      ...STACK_PATTERNS,
      ...AUTH_CONFIG_PATTERNS,
    ],
  },
];

export const NESTED_HELP_CASES: CliCase[] = [
  helpCase(
    "channels info --help",
    ["channels", "info", "--help"],
    "Usage: tlon channels info"
  ),
  helpCase(
    "groups info --help",
    ["groups", "info", "--help"],
    "Usage: tlon groups info"
  ),
];

export const CLI_MATRIX_CASES: CliCase[] = [
  TOP_LEVEL_HELP_CASE,
  UNKNOWN_TOP_LEVEL_CASE,
  ...FAMILY_HELP_CASES,
  ...FAMILY_BARE_CASES,
  ...INVALID_SUBCOMMAND_CASES,
  ...MISSING_REQUIRED_CASES,
  ...SPECIAL_INPUT_CASES,
  ...NESTED_HELP_CASES,
];

export function normalizeCliOutput(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}
