/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const yaml = require('js-yaml')

const schemaDiff = require('./schema-diff')

const REPO_ROOT = path.join(__dirname, '..', '..')
const FLEET_CONTROL_DIR = path.join(__dirname, '..')
const SCHEMA_PATH = path.join(FLEET_CONTROL_DIR, 'schemas', 'config.json')
const CONFIG_DEF_PATH = path.join(FLEET_CONTROL_DIR, 'configurationDefinitions.yml')
const SCHEMA_REPO_PATH = '.fleetControl/schemas/config.json'
const CONFIG_DEF_REPO_PATH = '.fleetControl/configurationDefinitions.yml'

// The version being bumped lives in the first entry of configurationDefinitions,
// same field this whole system was set up to write (see configurationDefinitions.yml).
function extractVersion(yamlText) {
  const data = yaml.load(yamlText)
  const definitions = (data && data.configurationDefinitions) || []
  return (definitions[0] && definitions[0].version) || null
}

/**
 * The latest final release tag (`vX.Y.Z`), ignoring anything else (RCs,
 * lightweight markers, etc). `git tag` output is newline-separated, already
 * sorted newest-first by the caller's `--sort=-v:refname`.
 */
function findLatestReleaseTag(tagLines) {
  return tagLines.map((line) => line.trim()).find((name) => /^v\d+\.\d+\.\d+$/.test(name)) || null
}

function latestReleaseTag() {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const output = execFileSync('git', ['tag', '--list', '--sort=-v:refname'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  })
  return findLatestReleaseTag(output.split('\n'))
}

/** `git show <ref>:<repoPath>`, or null if the ref/path doesn't exist. */
function gitShow(ref, repoPath) {
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    return execFileSync('git', ['show', `${ref}:${repoPath}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
  } catch {
    return null
  }
}

/**
 * The previous release's schema and the schema version at that release.
 * Returns nulls when there's no tag, or the tag predates the schema/version
 * fields existing — both are "first release that includes the schema" cases,
 * not failures.
 */
function previousRelease(tag, { gitShow: gitShowFn = gitShow } = {}) {
  if (!tag) {
    return { baselineSchema: null, starterVersion: null }
  }

  const schemaText = gitShowFn(tag, SCHEMA_REPO_PATH)
  const configDefText = gitShowFn(tag, CONFIG_DEF_REPO_PATH)
  if (schemaText === null || configDefText === null) {
    return { baselineSchema: null, starterVersion: null }
  }

  let baselineSchema
  let starterVersion
  try {
    baselineSchema = JSON.parse(schemaText)
    starterVersion = extractVersion(configDefText)
  } catch {
    return { baselineSchema: null, starterVersion: null }
  }
  return { baselineSchema, starterVersion }
}

/**
 * Pure decision: given the previous release's schema/version and the
 * current schema, classify the diff and decide what to do. No fs/git —
 * exercised directly in tests with synthetic fixtures.
 *
 * Returns `{ action: 'first_release' | 'no_change' | 'bump', ... }`.
 */
function decideBump({ baselineSchema, currentSchema, starterVersion }) {
  if (!baselineSchema || !starterVersion) {
    return { action: 'first_release', bump: 'none', changes: [] }
  }

  const changes = schemaDiff.classifyChanges(baselineSchema, currentSchema)
  const bump = schemaDiff.recommendBump(changes)
  if (bump === 'none') {
    return { action: 'no_change', bump, changes }
  }

  return {
    action: 'bump',
    bump,
    oldVersion: starterVersion,
    newVersion: schemaDiff.applyBump(starterVersion, bump),
    changes
  }
}

function printReport(result, tag) {
  const bySeverity = { breaking: [], additive: [], cosmetic: [] }
  for (const entry of result.changes) {
    if (bySeverity[entry.severity]) {
      bySeverity[entry.severity].push(entry)
    }
  }

  if (result.changes.length) {
    console.log(`\nSchema changes since ${tag} (${result.changes.length}):`)
    for (const severity of ['breaking', 'additive', 'cosmetic']) {
      if (bySeverity[severity].length) {
        console.log(`  ${severity.toUpperCase()} (${bySeverity[severity].length}):`)
        for (const entry of bySeverity[severity]) {
          console.log(`    ${schemaDiff.renderChange(entry)}`)
        }
      }
    }
  } else if (result.action !== 'first_release') {
    console.log(`\nNo schema changes since ${tag}.`)
  }
}

// Applies the bump to configurationDefinitions.yml on disk, using the
// *release* version as the base (result.oldVersion) rather than whatever the
// file currently holds — the on-disk value may already equal newVersion from
// a prior --write run that hasn't been released yet, in which case there's
// nothing to do. Returns true if the file was written.
function applyWrite(result, { configDefPath = CONFIG_DEF_PATH } = {}) {
  const text = fs.readFileSync(configDefPath, 'utf8')
  const onDiskVersion = extractVersion(text)
  if (onDiskVersion === result.newVersion) {
    return false
  }
  fs.writeFileSync(configDefPath, schemaDiff.bumpVersionLine(text, result.newVersion))
  return true
}

function parseArgs(argv) {
  const args = { since: null, write: false }
  for (const arg of argv) {
    if (arg.startsWith('--since=')) {
      args.since = arg.slice('--since='.length)
    } else if (arg === '--write') {
      args.write = true
    } else {
      throw new Error(`Unknown flag: ${arg}. Usage: bump-schema-version.js [--since=<ref>] [--write]`)
    }
  }
  return args
}

// Every dependency defaults to the real thing, so tests can inject synthetic
// ones instead — same DI convention generate-schema.js uses, so main()'s own
// branching (bootstrap/no-change/dry-run/write) is testable without touching
// real git or the real configurationDefinitions.yml.
function main({
  argv = process.argv.slice(2),
  latestReleaseTag: latestReleaseTagFn = latestReleaseTag,
  previousRelease: previousReleaseFn = previousRelease,
  loadCurrentSchema = () => schemaDiff.loadExisting(SCHEMA_PATH),
  applyWrite: applyWriteFn = applyWrite
} = {}) {
  const args = parseArgs(argv)
  const tag = args.since || latestReleaseTagFn()

  if (!tag) {
    console.log('No release tag (v*) found and no --since ref given; treating this as the first release. No bump.')
    return
  }

  console.log(`Comparing schema at ${tag} to the current on-disk schema.`)
  const { baselineSchema, starterVersion } = previousReleaseFn(tag)
  const currentSchema = loadCurrentSchema()
  const result = decideBump({ baselineSchema, currentSchema, starterVersion })

  printReport(result, tag)

  if (result.action === 'first_release') {
    console.log(`No schema (or no complete configurationDefinitions.yml) at ${tag}; treating this as the first release. No bump.`)
    return
  }
  if (result.action === 'no_change') {
    console.log(`Schema unchanged since ${tag}; no version bump.`)
    return
  }

  console.log(`\nRecommended bump: ${result.bump} (${result.oldVersion} -> ${result.newVersion})`)
  if (!args.write) {
    console.log('Dry-run; pass --write to apply.')
    return
  }

  if (applyWriteFn(result)) {
    console.log(`Wrote ${CONFIG_DEF_PATH} (version: ${result.oldVersion} -> ${result.newVersion})`)
  } else {
    console.log('On-disk version already matches the bumped value; no write needed.')
  }
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Schema bump failed: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = {
  findLatestReleaseTag,
  extractVersion,
  previousRelease,
  applyWrite,
  decideBump,
  parseArgs,
  main
}
