#!/usr/bin/env node

/**
 * Sync Python package version from package.json to pyproject.toml using uv
 * This script is called by changesets when versioning packages
 */

const { readFileSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { execSync } = require('node:child_process');

const scriptDir = dirname(__filename);

const rootDir = join(scriptDir, '..');
const pythonSdkDir = join(rootDir, 'sdks', 'python');
const packageJsonPath = join(pythonSdkDir, 'package.json');

try {
  // Read the new version from package.json (updated by changesets)
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const newVersion = packageJson.version;

  console.log(`🔄 Syncing Python package version to: ${newVersion}`);

  // Use uv to update the version in pyproject.toml
  // This is more reliable than manual file editing
  execSync(`uv version ${newVersion}`, {
    cwd: pythonSdkDir,
    stdio: 'inherit',
  });

  console.log(
    `✅ Successfully updated pyproject.toml version to ${newVersion} using uv`,
  );
} catch (error) {
  console.error('❌ Error syncing Python version:', error.message);
  process.exit(1);
}
