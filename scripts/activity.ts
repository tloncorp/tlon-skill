#!/usr/bin/env bun

import { runDirectCommandAndExit } from "./command-adapter";
import { createActivityDeps } from "./command-runtime";
import { formatUnexpectedError } from "./commands/command";
import { run } from "./commands/activity";

runDirectCommandAndExit(run, createActivityDeps).catch((error) => {
  process.stderr.write(formatUnexpectedError(error));
  process.exit(1);
});
