#!/usr/bin/env node

/**
 * Sync Python package version from package.json to pyproject.toml
 * This script is called by changesets when versioning packages
 */

const { readFileSync, writeFileSync } = require('node:fs');
const { join, dirname } = require('node:path');

const scriptDir = dirname(__filename);

const rootDir = join(scriptDir, '..');
const pythonSdkDir = join(rootDir, 'sdks', 'python');
const packageJsonPath = join(pythonSdkDir, 'package.json');
const pyprojectPath = join(pythonSdkDir, 'pyproject.toml');

try {
  // Read the new version from package.json (updated by changesets)
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const newVersion = packageJson.version;

  console.log(`🔄 Syncing Python package version to: ${newVersion}`);

  // Update pyproject.toml directly (uv version doesn't accept version arguments)
  const pyprojectContent = readFileSync(pyprojectPath, 'utf8');
  const updatedContent = pyprojectContent.replace(
    /version = ".*"/,
    `version = "${newVersion}"`,
  );

  if (updatedContent === pyprojectContent) {
    throw new Error('Could not find version line in pyproject.toml to update');
  }

  writeFileSync(pyprojectPath, updatedContent);
  console.log(
    `✅ Successfully updated pyproject.toml version to ${newVersion}`,
  );
} catch (error) {
  console.error('❌ Error syncing Python version:', error.message);
  process.exit(1);
}
