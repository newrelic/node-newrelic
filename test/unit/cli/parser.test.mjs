/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parse, validateSpec, ParseError } from '../../../cli/parser.mjs'

const spec = {
  globals: {
    verbose: {
      type: 'boolean',
      short: 'v'
    },
    config: {
      type: 'string',
      short: 'c'
    }
  },
  commands: {
    deploy: {
      options: {
        force: {
          type: 'boolean',
          short: 'f'
        },
        dump: {
          type: 'string',
          optionalValue: true,
          greedy: true
        }
      }
    },
    'validate-config': {
      options: {
        format: {
          type: 'string',
          short: 'F'
        }
      }
    }
  }
}

test('command detection: basic', () => {
  const r = parse(spec, ['deploy'])
  assert.equal(r.command, 'deploy')
})

test('missing/unknown command throws ParseError', () => {
  assert.throws(() => parse(spec, []), ParseError)
  assert.throws(() => parse(spec, ['nope']), (e) => e instanceof ParseError && e.code === 'ENOCMD')
})

test('global before command', () => {
  const r = parse(spec, ['--verbose', 'deploy'])
  assert.equal(r.globals.verbose, true)
  assert.equal(r.command, 'deploy')
})

test('global after command (globals-anywhere)', () => {
  const r = parse(spec, ['deploy', '--verbose'])
  assert.equal(r.globals.verbose, true)
  assert.equal(r.command, 'deploy')
})

test('global interleaved with command options', () => {
  const r = parse(spec, ['deploy', '--force', '--verbose'])
  assert.equal(r.options.force, true)
  assert.equal(r.globals.verbose, true)
})

test('global with string value does not swallow the command', () => {
  const r = parse(spec, ['--config', '/etc/app.conf', 'deploy'])
  assert.equal(r.globals.config, '/etc/app.conf')
  assert.equal(r.command, 'deploy')
})

test('optional-value switch: bare --dump → empty string', () => {
  const r = parse(spec, ['deploy', '--dump'])
  assert.equal(r.options.dump, '')
})

test('optional-value switch: --dump full → "full"', () => {
  const r = parse(spec, ['deploy', '--dump', 'full'])
  assert.equal(r.options.dump, 'full')
})

test('optional-value switch: --dump=full → "full"', () => {
  const r = parse(spec, ['deploy', '--dump=full'])
  assert.equal(r.options.dump, 'full')
})

test('optional-value switch followed by a flag → empty', () => {
  const r = parse(spec, ['deploy', '--dump', '--verbose'])
  assert.equal(r.options.dump, '')
  assert.equal(r.globals.verbose, true)
})

test('optional-value switch not provided → key absent', () => {
  const r = parse(spec, ['deploy', '--force'])
  assert.equal('dump' in r.options, false)
})

test('optional-value: value equal to a command name is not consumed', () => {
  // `deploy` is a command → stop rule means it is NOT taken as dump's value.
  const r = parse(spec, ['deploy', '--dump', 'validate-config'])
  assert.equal(r.options.dump, '')
  assert.deepEqual(r.operands, ['validate-config'])
})

test('short clustering: -vf sets global + command booleans', () => {
  const r = parse(spec, ['deploy', '-vf'])
  assert.equal(r.globals.verbose, true)
  assert.equal(r.options.force, true)
})

test('-- terminator: following tokens are operands', () => {
  const r = parse(spec, ['deploy', '--', '--notaflag', 'x'])
  assert.deepEqual(r.operands, ['--notaflag', 'x'])
})

test('operands exclude the command token', () => {
  const r = parse(spec, ['deploy', 'a', 'b'])
  assert.deepEqual(r.operands, ['a', 'b'])
})

test('command-specific option belongs to its command', () => {
  const r = parse(spec, ['validate-config', '--format', 'json'])
  assert.equal(r.command, 'validate-config')
  assert.equal(r.options.format, 'json')
})

test('unknown option under strict → ParseError', () => {
  assert.throws(() => parse(spec, ['deploy', '--bogus']), ParseError)
})

test('--long=val passthrough', () => {
  const r = parse(spec, ['--config=/x', 'deploy'])
  assert.equal(r.globals.config, '/x')
})

test('validateSpec: option/global name collision throws', () => {
  const bad = {
    globals: { force: { type: 'boolean' } },
    commands: { deploy: { options: { force: { type: 'boolean' } } } }
  }
  assert.throws(() => validateSpec(bad), (e) => e instanceof ParseError && e.code === 'ECOLLIDE')
})

test('validateSpec: short alias collision throws', () => {
  const bad = {
    globals: { verbose: { type: 'boolean', short: 'x' } },
    commands: { deploy: { options: { force: { type: 'boolean', short: 'x' } } } }
  }
  assert.throws(() => validateSpec(bad), (e) => e instanceof ParseError && e.code === 'ECOLLIDE')
})

test('validateSpec: no commands throws', () => {
  assert.throws(() => validateSpec({ globals: {} }), ParseError)
})

test('defaultCommand used when no command token present', () => {
  const withDefault = { ...spec, defaultCommand: 'deploy' }
  const r = parse(withDefault, ['--force'])
  assert.equal(r.command, 'deploy')
  assert.equal(r.options.force, true)
})

test('provided distinguishes bare switch from unset default', () => {
  const withDefault = {
    ...spec,
    commands: {
      ...spec.commands,
      deploy: {
        options: {
          ...spec.commands.deploy.options,
          dump: { type: 'string', optionalValue: true, greedy: true, default: '' }
        }
      }
    }
  }
  const unset = parse(withDefault, ['deploy', '--force'])
  assert.equal(unset.options.dump, '') // default applied
  assert.equal(unset.provided.has('dump'), false) // but not provided

  const bare = parse(withDefault, ['deploy', '--dump'])
  assert.equal(bare.options.dump, '')
  assert.equal(bare.provided.has('dump'), true)
})

test('allowNegative passthrough (--no-force)', () => {
  const neg = { ...spec, allowNegative: true }
  const r = parse(neg, ['deploy', '--no-force'])
  assert.equal(r.options.force, false)
})
