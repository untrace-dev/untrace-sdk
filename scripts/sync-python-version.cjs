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
const pyprojectTomlPath = join(pythonSdkDir, 'pyproject.toml');

try {
  // Read the new version from package.json (updated by changesets)
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const newVersion = packageJson.version;

  console.log(`🔄 Syncing Python package version to: ${newVersion}`);

  // Read pyproject.toml
  let pyprojectContent = readFileSync(pyprojectTomlPath, 'utf8');

  // Update version in pyproject.toml
  // This regex matches: version = "x.y.z"
  const versionRegex = /^version\s*=\s*"[^"]*"$/m;
  const newVersionLine = `version = "${newVersion}"`;

  if (versionRegex.test(pyprojectContent)) {
    pyprojectContent = pyprojectContent.replace(versionRegex, newVersionLine);
  } else {
    console.error('❌ Could not find version field in pyproject.toml');
    process.exit(1);
  }

  // Write updated pyproject.toml
  writeFileSync(pyprojectTomlPath, pyprojectContent, 'utf8');

  console.log(
    `✅ Successfully updated pyproject.toml version to ${newVersion}`,
  );
} catch (error) {
  console.error('❌ Error syncing Python version:', error.message);
  process.exit(1);
}
