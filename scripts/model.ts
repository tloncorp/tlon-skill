#!/usr/bin/env ts-node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const configPath = join(homedir(), '.clawdbot', 'clawdbot.json');
const statePath = join(homedir(), '.clawdbot', '.model-state.json');

interface ModelAlias {
  [key: string]: string;
}

function getModelAliases(): ModelAlias {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const models = config.agents?.defaults?.models || {};
    const aliases: ModelAlias = {};

    // Build aliases from config
    for (const [modelName, modelConfig] of Object.entries(models)) {
      const alias = (modelConfig as any)?.alias;
      if (alias) {
        aliases[alias] = modelName;
      }
    }

    return aliases;
  } catch (err) {
    // Fallback to common aliases if config read fails
    return {
      'sonnet': 'anthropic/claude-sonnet-4-5',
      'opus': 'anthropic/claude-opus-4-5',
      'haiku': 'anthropic/claude-haiku-4-5'
    };
  }
}

function getCurrentModel(): string {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    return config.agents?.defaults?.model?.primary || 'unknown';
  } catch (err) {
    console.error('Failed to read config:', err);
    process.exit(1);
  }
}

function saveOriginalModel(): void {
  const currentModel = getCurrentModel();
  const state = {
    originalModel: currentModel,
    savedAt: new Date().toISOString()
  };
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`✓ Saved original model: ${currentModel}`);
}

function restoreOriginalModel(): void {
  if (!existsSync(statePath)) {
    console.error('No saved model state found. Nothing to restore.');
    process.exit(1);
  }

  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    const originalModel = state.originalModel;

    // Set model back to original
    setModel(originalModel, false);

    // Clean up state file
    const fs = require('fs');
    fs.unlinkSync(statePath);

    console.log(`✓ Restored original model: ${originalModel}`);
  } catch (err) {
    console.error('Failed to restore model:', err);
    process.exit(1);
  }
}

function setModel(modelInput: string, saveOriginal: boolean = true): void {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    // Save original model before changing (unless restoring)
    if (saveOriginal && !existsSync(statePath)) {
      const currentModel = config.agents.defaults.model.primary;
      const state = {
        originalModel: currentModel,
        savedAt: new Date().toISOString()
      };
      writeFileSync(statePath, JSON.stringify(state, null, 2));
    }

    // Resolve alias to full model name
    const modelAliases = getModelAliases();
    const fullModelName = modelAliases[modelInput.toLowerCase()] || modelInput;

    // Validate model exists in config
    if (!config.agents?.defaults?.models?.[fullModelName]) {
      console.error(`Model "${fullModelName}" not found in config.`);
      console.error(`Available models: ${Object.keys(config.agents.defaults.models).join(', ')}`);
      process.exit(1);
    }

    // Update primary model
    config.agents.defaults.model.primary = fullModelName;

    // Write back
    config.meta.lastTouchedAt = new Date().toISOString();
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    if (saveOriginal) {
      console.log(`✓ Model changed to ${fullModelName} (task-specific)`);
      console.log(`  Original model saved for restoration after task`);
    } else {
      console.log(`✓ Model changed to ${fullModelName}`);
    }

    const aliases = getModelAliases();
    const alias = Object.entries(aliases).find(([_, v]) => v === fullModelName)?.[0] || 'none';
    console.log(`  Alias: ${alias}`);
    console.log(`\n⚠️  Restart gateway for changes to take effect:`);
    console.log(`   clawdbot gateway restart`);

    if (saveOriginal && existsSync(statePath)) {
      console.log(`\n💡 After task completion, restore with:`);
      console.log(`   npx ts-node scripts/model.ts restore`);
    }
  } catch (err) {
    console.error('Failed to update config:', err);
    process.exit(1);
  }
}

function checkState(): void {
  if (!existsSync(statePath)) {
    console.log('No saved model state. Using configured default.');
    return;
  }

  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    console.log('Task-specific model active:');
    console.log(`  Current: ${getCurrentModel()}`);
    console.log(`  Original: ${state.originalModel}`);
    console.log(`  Saved at: ${state.savedAt}`);
    console.log('\nRestore with: npx ts-node scripts/model.ts restore');
  } catch (err) {
    console.error('Failed to read state:', err);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Current model:', getCurrentModel());

    if (existsSync(statePath)) {
      console.log('\n⚠️  Task-specific model override active!');
      try {
        const state = JSON.parse(readFileSync(statePath, 'utf8'));
        console.log(`   Original model: ${state.originalModel}`);
        console.log(`   Will restore after task completion`);
      } catch {}
    }

    console.log('\nAvailable models (from config):');
    const aliases = getModelAliases();
    for (const [alias, fullName] of Object.entries(aliases)) {
      console.log(`  ${alias.padEnd(15)} - ${fullName}`);
    }
    console.log('\nCommands:');
    console.log('  npx ts-node scripts/model.ts [model]  - Switch model (saves original)');
    console.log('  npx ts-node scripts/model.ts restore  - Restore original model');
    console.log('  npx ts-node scripts/model.ts state    - Check if override is active');
    console.log('\nExample workflow:');
    console.log('  1. npx ts-node scripts/model.ts opus    # Switch to opus for task');
    console.log('  2. [Complete your task]');
    console.log('  3. npx ts-node scripts/model.ts restore # Restore default');
    return;
  }

  const command = args[0].toLowerCase();

  if (command === 'restore') {
    restoreOriginalModel();
  } else if (command === 'state') {
    checkState();
  } else if (command === 'save') {
    saveOriginalModel();
  } else {
    setModel(command);
  }
}

main();
