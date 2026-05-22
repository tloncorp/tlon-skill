#!/usr/bin/env bun

import { runDirectCommandAndExit } from "./command-adapter";
import { createUploadDeps } from "./command-runtime";
import { formatUnexpectedError } from "./commands/command";
import { run } from "./commands/upload";

runDirectCommandAndExit(run, createUploadDeps).catch((error) => {
  process.stderr.write(formatUnexpectedError(error));
  process.exit(1);
});
