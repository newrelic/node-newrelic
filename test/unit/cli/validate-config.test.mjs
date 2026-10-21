/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
 * it works from any directory.
 *
 * @param {string[]} args The command-line arguments to pass to the CLI.
 * @param {object} [env] Extra environment variables to set for the child,
 * merged over the current process environment.
 *
 * @returns {Promise<object>} The captured `stdout`, `stderr`, and `code`.
 */
function runCli(args, env) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [cliPath, ...args],
      { cwd: foreignCwd, env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({
          stdout,
          stderr,
          code: error ? error.code : 0
        })
      }
    )
  })
}

test('validates an invalid .js (CJS) config file', async () => {
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

test('emits JSON output when the json format is requested', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'invalid.js'),
    '-o', 'json'
  ])

  assert.equal(code, 1)
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.status, 1)
  assert.deepEqual(parsed.errors, [
    { '/high_security': 'must be boolean' },
    { '/attributes/value_size_limit': 'must be integer' }
  ])
})

test('accepts a valid .js (CJS) config file', async () => {
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

test('reads config from a whole module.exports assignment', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid-module-exports.cjs'),
    '-o', 'json'
  ])

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('emits a passing JSON result for a valid config', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js'),
    '-o', 'json'
  ])

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('every valid fixture format is accepted', async () => {
  for (const fixture of ['valid.js', 'valid.cjs', 'valid.mjs']) {
    const { stdout, code } = await runCli([
      'validate-config',
      '-c', join(fixturesDir, fixture),
      '-o', 'json'
    ])

    assert.equal(code, 0, `${fixture} should exit zero`)
    const parsed = JSON.parse(stdout)
    assert.equal(parsed.status, 0, `${fixture} should report a passing status`)
    assert.equal(parsed.errors.length, 0, `${fixture} should report no errors`)
  }
})

test('every invalid fixture format surfaces the same errors', async () => {
  for (const fixture of ['invalid.js', 'invalid.cjs', 'invalid.mjs']) {
    const { stdout, code } = await runCli([
      'validate-config',
      '-c', join(fixturesDir, fixture),
      '-o', 'json'
    ])

    assert.equal(code, 1, `${fixture} should exit non-zero`)
    const parsed = JSON.parse(stdout)
    assert.equal(parsed.status, 1, `${fixture} should report a failing status`)
    assert.equal(parsed.errors.length, 2, `${fixture} should report two errors`)
  }
})

test('flags a schema-valid config missing app_name as a startup blocker', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'blocker-no-app-name.cjs'),
    '-o', 'json'
  ])

  assert.equal(code, 1, 'should exit non-zero for an unstartable config')
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.status, 1)
  assert.equal(parsed.errors.length, 1)
  assert.match(parsed.errors[0]['/app_name'], /application name is required/)
})

test('flags a schema-valid config missing license_key as a startup blocker', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'blocker-no-license.cjs'),
    '-o', 'json'
  ])

  assert.equal(code, 1)
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.errors.length, 1)
  assert.match(parsed.errors[0]['/license_key'], /license key is required/)
})

test('does not require license_key when serverless mode is enabled', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'serverless-no-license.cjs'),
    '-o', 'json'
  ])

  assert.equal(code, 0, 'serverless mode exempts the license_key requirement')
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('flags a disabled agent as a startup blocker', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'agent-disabled.cjs'),
    '-o', 'json'
  ])

  assert.equal(code, 1)
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.errors.length, 1)
  assert.match(parsed.errors[0]['/agent_enabled'], /agent is disabled/)
})

test('reports a startup blocker in human format', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'blocker-no-app-name.cjs')
  ])

  assert.equal(code, 1)
  assert.match(stdout, /Found the following configuration errors:/)
  assert.match(stdout, /\/app_name: An application name is required/)
})

test('reports a schema error for a value with the wrong type', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'env-override.cjs'),
    '-o', 'json'
  ])

  assert.equal(code, 1, 'the bad attributes.enabled type should fail validation')
  const parsed = JSON.parse(stdout)
  assert.deepEqual(parsed.errors, [{ '/attributes/enabled': 'must be boolean' }])
})

test('applies NEW_RELIC_ environment overrides before validating', async () => {
  const { stdout, code } = await runCli(
    [
      'validate-config',
      '-c', join(fixturesDir, 'env-override.cjs'),
      '-o', 'json'
    ],
    { NEW_RELIC_ATTRIBUTES_ENABLED: 'true' }
  )

  assert.equal(code, 0, 'the environment override should correct the value')
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('loads and validates a CJS config that requires a sibling file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'imports-data.cjs'),
    '-o', 'json'
  ])

  assert.equal(code, 0, 'should resolve the require relative to the config file')
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('loads and validates an ESM config that imports a sibling file', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'imports-data.mjs'),
    '-o', 'json'
  ])

  assert.equal(code, 0, 'should resolve the import relative to the config file')
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('resolves a node: builtin imported by an ESM config', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'imports-core.mjs'),
    '-o', 'json'
  ])

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('resolves a bare package specifier imported by an ESM config', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'imports-package.mjs'),
    '-o', 'json'
  ])

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(stdout), { status: 0, errors: [] })
})

test('errors when no configuration file is supplied', async () => {
  const { stderr, code } = await runCli(['validate-config'])

  assert.notEqual(code, 0, 'should exit non-zero')
  assert.match(stderr, /Must supply a configuration file to validate\./)
  assert.match(stderr, /newrelic validate-config -c <file>/, 'should show the command help')
})

test('exits gracefully when the file cannot be loaded', async () => {
  const { stderr, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'unknown.txt')
  ])

  assert.equal(code, 2, 'should exit with the unprocessable code')
  assert.match(stderr, /Could not load configuration file/)
  assert.doesNotMatch(stderr, /\n\s+at /, 'should not print a stack trace')
})

test('reports a load failure as JSON when requested', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'unknown.txt'),
    '-o', 'json'
  ])

  assert.equal(code, 2)
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.status, 2)
  assert.equal(parsed.errors.length, 1)
  assert.match(parsed.errors[0].message, /Could not load configuration file/)
})

test('exits gracefully when the file does not exist', async () => {
  const { stderr, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'does-not-exist.js')
  ])

  assert.equal(code, 2, 'should exit with the unprocessable code')
  assert.match(stderr, /Could not load configuration file/)
  assert.doesNotMatch(stderr, /\n\s+at /, 'should not print a stack trace')
})

test('reports an unrecognized command', async () => {
  const { stderr } = await runCli(['bogus-command'])

  assert.match(stderr, /Unrecognized command\./)
  assert.match(stderr, /newrelic <command> \[options\]/)
})

test('loads help text when run from an arbitrary directory', async () => {
  const { stderr, code } = await runCli(['validate-config', '-h'])

  assert.equal(code, 0, 'requesting help should exit zero')
  assert.match(stderr, /newrelic validate-config -c <file>/)
})

test('loads top-level help text when the command is missing', async () => {
  const { stderr } = await runCli([])

  assert.match(stderr, /Missing command\./)
  assert.match(stderr, /newrelic <command> \[options\]/)
})

test('reports an unknown option and shows command help', async () => {
  const { stderr, code } = await runCli(['validate-config', '--bogus'])

  assert.notEqual(code, 0, 'should exit non-zero')
  assert.match(stderr, /unknown option: --bogus/)
  assert.match(stderr, /newrelic validate-config -c <file>/)
})

test('--dump writes a CommonJS config of the user-supplied settings', async () => {
  const { stdout, stderr, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js'),
    '--dump'
  ])

  assert.equal(code, 0)
  assert.equal(stderr, '', 'nothing should be written to stderr')
  assert.match(stdout, /^exports\.config = \{/)
  // Only user-supplied keys appear; defaults the user did not set do not.
  assert.match(stdout, /"app_name"/)
  assert.doesNotMatch(stdout, /transaction_tracer/)
})

test('--dump --format esm writes an ESM config', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js'),
    '--dump', '--format', 'esm'
  ])

  assert.equal(code, 0)
  assert.match(stdout, /^export const config = \{/)
})

test('the -d and -f short options drive the dump', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js'),
    '-d', '-f', 'esm'
  ])

  assert.equal(code, 0)
  assert.match(stdout, /^export const config = \{/)
})

test('--dump --format json writes a JSON config under a config key', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js'),
    '--dump', '--format', 'json'
  ])

  assert.equal(code, 0)
  const parsed = JSON.parse(stdout)
  assert.deepEqual(parsed.config.app_name, ['My Application'])
  assert.equal('transaction_tracer' in parsed.config, false)
})

test('--dump normalizes values (app_name split, license_key trimmed)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nr-dump-'))
  try {
    const file = join(dir, 'in.cjs')
    writeFileSync(file, "exports.config = { app_name: 'a;b', license_key: ' k ' }\n")
    const { stdout, code } = await runCli([
      'validate-config',
      '-c', file,
      '--dump', '--format', 'json'
    ])

    assert.equal(code, 0)
    const { config } = JSON.parse(stdout)
    assert.deepEqual(config.app_name, ['a', 'b'])
    assert.equal(config.license_key, 'k')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--dump full includes every setting at its default', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js'),
    '--dump', 'full', '--format', 'json'
  ])

  assert.equal(code, 0)
  const { config } = JSON.parse(stdout)
  // The user did not set these; full mode fills them from defaults.
  assert.equal('transaction_tracer' in config, true)
  assert.equal('attributes' in config, true)
  assert.equal('distributed_tracing' in config, true)
})

test('--dump full excludes settings marked internal in the schema', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js'),
    '--dump', 'full', '--format', 'json'
  ])

  assert.equal(code, 0)
  const { config } = JSON.parse(stdout)
  // `ssl` and `agent_control` are x-newrelic-internal; nested internals too.
  assert.equal('ssl' in config, false)
  assert.equal('agent_control' in config, false)
  assert.equal('diagnostics' in config.logging, false)
})

test('a --dump cjs file re-validates successfully (round trip)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nr-dump-'))
  try {
    const dumped = await runCli([
      'validate-config',
      '-c', join(fixturesDir, 'valid.js'),
      '--dump'
    ])
    assert.equal(dumped.code, 0)

    const file = join(dir, 'out.cjs')
    writeFileSync(file, dumped.stdout)

    const revalidated = await runCli(['validate-config', '-c', file])
    assert.equal(revalidated.code, 0, 'the dumped file should itself be valid')
    assert.match(revalidated.stdout, /No configuration errors detected\./)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--dump refuses to dump an invalid configuration', async () => {
  const { stdout, stderr, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'blocker-no-app-name.cjs'),
    '--dump'
  ])

  assert.equal(code, 1)
  assert.equal(stdout, '', 'stdout must stay empty so a redirect is not half-written')
  assert.match(stderr, /\/app_name: An application name is required/)
})

test('--dump rejects an unknown --format', async () => {
  const { code, stderr } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js'),
    '--dump', '--format', 'yaml'
  ])

  assert.equal(code, 2)
  assert.match(stderr, /Invalid --format "yaml"/)
})

test('--format without --dump is ignored', async () => {
  const { stdout, code } = await runCli([
    'validate-config',
    '-c', join(fixturesDir, 'valid.js'),
    '--format', 'esm'
  ])

  assert.equal(code, 0)
  assert.match(stdout, /No configuration errors detected\./)
})
