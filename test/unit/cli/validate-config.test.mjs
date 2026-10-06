/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import { execFile } from 'node:child_process'
import { join } from 'node:path'

const cliPath = join(import.meta.dirname, '..', '..', '..', 'cli', 'index.mjs')
const fixturesDir = join(import.meta.dirname, 'fixtures')

// Run the CLI from a directory that is deliberately neither the project root
// nor the fixtures directory (which the imported config files resolve against).
// This proves the tool finds both its help files and a config's imports
// regardless of cwd.
const foreignCwd = import.meta.dirname

/**
 * Runs the `newrelic` CLI as a child process exactly as a user would, and
 * resolves with the captured output and exit code. The CLI is executed from a
 * directory unrelated to both the install location and the fixtures to prove
 * it works from any directory, and with VM Modules enabled because the ESM
 * config loader depends on them.
 *
 * @param {string[]} args The command-line arguments to pass to the CLI.
 * @param {string} [stdin] Optional data to write to the child's stdin.
 *
 * @returns {Promise<object>} The captured `stdout`, `stderr`, and `code`.
 */
function runCli(args, stdin) {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      ['--experimental-vm-modules', cliPath, ...args],
      { cwd: foreignCwd },
      (error, stdout, stderr) => {
        resolve({
          stdout,
          stderr,
          code: error ? error.code : 0
        })
      }
    )

    if (stdin !== undefined) {
      child.stdin.end(stdin)
    }
  })
}

test('validates an invalid .js (CJS-detected) config file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'invalid.js')
  ])

  assert.equal(code, 1, 'should exit non-zero for an invalid config')
  assert.match(stdout, /Found the following configuration errors:/)
  assert.match(stdout, /\/high_security: must be boolean/)
  assert.match(stdout, /\/attributes\/value_size_limit: must be integer/)
})

test('validates an invalid .cjs config file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'invalid.cjs')
  ])

  assert.equal(code, 1)
  assert.match(stdout, /\/high_security: must be boolean/)
  assert.match(stdout, /\/attributes\/value_size_limit: must be integer/)
})

test('validates an invalid .mjs (ESM) config file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'invalid.mjs')
  ])

  assert.equal(code, 1)
  assert.match(stdout, /\/high_security: must be boolean/)
  assert.match(stdout, /\/attributes\/value_size_limit: must be integer/)
})

test('validates an invalid .json config file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'invalid.json')
  ])

  assert.equal(code, 1)
  assert.match(stdout, /\/high_security: must be boolean/)
  assert.match(stdout, /\/attributes\/value_size_limit: must be integer/)
})

test('emits JSON output when the json format is requested', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'invalid.js'),
    '-f', 'json'
  ])

  assert.equal(code, 1)
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.status, 1)
  assert.deepEqual(parsed.errors, [
    { '/high_security': 'must be boolean' },
    { '/attributes/value_size_limit': 'must be integer' }
  ])
})

test('validates configuration provided over stdin', async () => {
  const { stdout, code } = await runCli(
    ['validate-config', '-f', 'json'],
    '{ "high_security": 42 }'
  )

  assert.equal(code, 1)
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.status, 1)
  assert.deepEqual(parsed.errors, [{ '/high_security': 'must be boolean' }])
})

test('accepts a valid .js (CJS-detected) config file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js')
  ])

  assert.equal(code, 0, 'should exit zero for a valid config')
  assert.match(stdout, /No configuration errors detected\./)
})

test('accepts a valid .cjs config file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.cjs')
  ])

  assert.equal(code, 0)
  assert.match(stdout, /No configuration errors detected\./)
})

test('accepts a valid .mjs (ESM) config file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.mjs')
  ])

  assert.equal(code, 0)
  assert.match(stdout, /No configuration errors detected\./)
})

test('accepts a valid .json config file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.json')
  ])

  assert.equal(code, 0)
  assert.match(stdout, /No configuration errors detected\./)
})

test('emits a passing JSON result for a valid config', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js'),
    '-f', 'json'
  ])

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('accepts valid configuration provided over stdin', async () => {
  const { stdout, code } = await runCli(
    ['validate-config', '-f', 'json'],
    '{ "high_security": false }'
  )

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('every valid fixture format is accepted', async () => {
  for (const fixture of ['valid.js', 'valid.cjs', 'valid.mjs', 'valid.json']) {
    const { stdout, code } = await runCli([
      'validate-config',
      '-c', join(fixturesDir, fixture),
      '-f', 'json'
    ])

    assert.equal(code, 0, `${fixture} should exit zero`)
    const parsed = JSON.parse(stdout)
    assert.equal(parsed.status, 0, `${fixture} should report a passing status`)
    assert.equal(parsed.errors.length, 0, `${fixture} should report no errors`)
  }
})

test('loads and validates a CJS config that requires a sibling file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'imports-data.cjs'),
    '-f', 'json'
  ])

  assert.equal(code, 0, 'should resolve the require relative to the config file')
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('loads and validates an ESM config that imports a sibling file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'imports-data.mjs'),
    '-f', 'json'
  ])

  assert.equal(code, 0, 'should resolve the import relative to the config file')
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('loads help text when run from an arbitrary directory', async () => {
  const { stderr, code } = await runCli(['validate-config', '-h'])

  assert.equal(code, 0, 'requesting help should exit zero')
  assert.match(stderr, /newrelic validate-config -c \.\/newrelic\.js/)
})

test('loads top-level help text when the command is missing', async () => {
  const { stderr } = await runCli([])

  assert.match(stderr, /Missing command\./)
  assert.match(stderr, /newrelic <command> \[options\]/)
})

test('every fixture format is detected and surfaces the same errors', async () => {
  for (const fixture of ['invalid.js', 'invalid.cjs', 'invalid.mjs', 'invalid.json']) {
    const { stdout, code } = await runCli([
      'validate-config',
      '-c', join(fixturesDir, fixture),
      '-f', 'json'
    ])

    assert.equal(code, 1, `${fixture} should exit non-zero`)
    const parsed = JSON.parse(stdout)
    assert.equal(parsed.status, 1, `${fixture} should report a failing status`)
    assert.equal(parsed.errors.length, 2, `${fixture} should report two errors`)
  }
})

test('detects and validates CJS configuration over stdin', async () => {
  const { stdout, code } = await runCli(
    ['validate-config', '-f', 'json'],
    'module.exports = { high_security: false }'
  )

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('detects and validates ESM configuration over stdin', async () => {
  const { stdout, code } = await runCli(
    ['validate-config', '-f', 'json'],
    'export const config = { high_security: false }'
  )

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('errors when the stdin source type cannot be detected', async () => {
  const { stderr, code } = await runCli(
    ['validate-config', '-f', 'json'],
    'this is not a recognizable configuration'
  )

  assert.notEqual(code, 0, 'should exit non-zero')
  assert.match(stderr, /Could not detect source type provided via stdin\./)
})

test('errors when a file has an unrecognized extension', async () => {
  const { stderr, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'unknown.txt')
  ])

  assert.notEqual(code, 0, 'should exit non-zero')
  assert.match(stderr, /Could not detect source type of file/)
})

test('reports an unrecognized command', async () => {
  const { stderr } = await runCli(['bogus-command'])

  assert.match(stderr, /Unrecognized command\./)
  assert.match(stderr, /newrelic <command> \[options\]/)
})

test('resolves a node: builtin imported by an ESM config', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'imports-core.mjs'),
    '-f', 'json'
  ])

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('resolves a bare package specifier imported by an ESM config', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'imports-package.mjs'),
    '-f', 'json'
  ])

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('reuses a module imported twice by an ESM config', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'imports-duplicate.mjs'),
    '-f', 'json'
  ])

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('supports import.meta.resolve and dynamic import in an ESM config', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'imports-dynamic.mjs'),
    '-f', 'json'
  ])

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})
