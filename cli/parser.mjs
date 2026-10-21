/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// A thin wrapper over `node:util.parseArgs` that adds the shape of a modern
// CLI — global switches, commands, command-specific options, and
// optional-argument switches — while preserving the POSIX/GNU features
// parseArgs already provides (short clustering, `--`, `--long=val`,
// allowNegative, ...).
//
// See the companion plan for the full design. The core idea: parseArgs is a
// single flat pass, so this wrapper does command/scope resolution *around* it
// in three stages (find command → normalize optional-value switches → one
// parseArgs call → split the result by scope).

import { parseArgs } from 'node:util'

export class ParseError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'ParseError'
    this.code = options?.code ?? 'EPARSE'
  }
}

// Validate a single command's options against the globals: no option key may
// collide with a global key, and short aliases must be unique within the
// command's effective (global+command) option table — otherwise parseArgs
// itself would behave surprisingly. Throws ParseError on a collision.
function validateCommand(name, command, globals) {
  const commandOptions = command?.options ?? {}

  for (const key of Object.keys(commandOptions)) {
    if (key in globals) {
      throw new ParseError(
        `command '${name}' option '${key}' collides with a global switch`,
        { code: 'ECOLLIDE' }
      )
    }
  }

  const shorts = new Map()
  for (const [key, def] of Object.entries({ ...globals, ...commandOptions })) {
    if (def?.short == null) {
      continue
    }
    if (shorts.has(def.short)) {
      throw new ParseError(
        `command '${name}': short '-${def.short}' maps to both ` +
          `'${shorts.get(def.short)}' and '${key}'`,
        { code: 'ECOLLIDE' }
      )
    }
    shorts.set(def.short, key)
  }
}

/**
 * Validate a spec and return a normalized form with convenient lookups.
 * Throws ParseError on structural problems (name collisions, bad types, ...).
 *
 * @param {object} spec The CLI spec to validate ({ globals, commands,
 * defaultCommand?, strict?, allowNegative? }).
 *
 * @returns {object} The normalized spec with defaults filled in.
 */
export function validateSpec(spec) {
  if (spec == null || typeof spec !== 'object') {
    throw new ParseError('spec must be an object', { code: 'EBADSPEC' })
  }

  const globals = spec.globals ?? {}
  const commands = spec.commands ?? {}

  if (Object.keys(commands).length === 0) {
    throw new ParseError('spec must define at least one command', { code: 'EBADSPEC' })
  }

  for (const [name, command] of Object.entries(commands)) {
    validateCommand(name, command, globals)
  }

  const defaultCommand = spec.defaultCommand ?? null
  if (defaultCommand != null && !(defaultCommand in commands)) {
    throw new ParseError(
      `defaultCommand '${defaultCommand}' is not a defined command`,
      { code: 'EBADSPEC' }
    )
  }

  return {
    globals,
    commands,
    defaultCommand,
    strict: spec.strict ?? true,
    allowNegative: spec.allowNegative ?? false
  }
}

// Build the `options` table parseArgs understands for a given command: the
// union of globals and that command's options, with our extra `optionalValue`
// / `greedy` keys stripped (parseArgs rejects unknown keys). An optional-value
// switch is declared to parseArgs as a plain string option.
function buildParseArgsOptions(normSpec, command) {
  const merged = { ...normSpec.globals, ...(normSpec.commands[command]?.options ?? {}) }
  const out = {}
  for (const [key, def] of Object.entries(merged)) {
    const { optionalValue, greedy, ...passthrough } = def
    out[key] = passthrough
    if (optionalValue === true) {
      // optional-value switches are strings to parseArgs; the normalization
      // step guarantees a bare one is rewritten to an empty value.
      out[key].type = 'string'
    }
  }
  return { options: out, merged }
}

// Map a token to the option key it represents, if any. Handles `--long`,
// `--long=x`, `-s`, `-s=x`, and the leading short of a cluster like `-vd`.
// Returns { key, def, hasInlineValue } or null.
function optionForToken(token, merged, shortIndex) {
  if (!token.startsWith('-') || token === '-' || token === '--') {
    return null
  }

  if (token.startsWith('--')) {
    const body = token.slice(2)
    const eq = body.indexOf('=')
    const name = eq === -1 ? body : body.slice(0, eq)
    const def = merged[name]
    if (def == null) {
      return null
    }
    return { key: name, def, hasInlineValue: eq !== -1 }
  }

  // short form: `-s`, `-s=x`, or cluster `-vd`. We only need the FIRST short
  // for optional-value detection, and only treat it as an optional-value
  // switch when the token is exactly `-s` (a cluster or inline value is
  // unambiguous and left to parseArgs).
  const body = token.slice(1)
  const first = body[0]
  const key = shortIndex.get(first)
  if (key == null) {
    return null
  }
  const def = merged[key]
  const exact = body.length === 1
  const hasInlineValue = body.includes('=') || (!exact && def?.type === 'string')
  return { key, def, hasInlineValue, exact }
}

/**
 * The result of parsing argv against a spec.
 *
 * @typedef {object} ParseResult
 * @property {string} command The resolved command name.
 * @property {object} globals The values of the global switches, keyed by their
 * option name.
 * @property {object} options The values of the resolved command's options,
 * keyed by their option name.
 * @property {string[]} operands The positional arguments, excluding the command
 * token.
 * @property {Set<string>} provided The names of the switches the user actually
 * passed, so a caller can tell a bare optional switch from an unset one that
 * was filled in from a `default`.
 */

/**
 * Parse argv against a spec.
 *
 * @param {object} spec   { globals, commands, defaultCommand?, strict?, allowNegative? }
 * @param {string[]} argv typically process.argv.slice(2)
 *
 * @returns {ParseResult} The command, its options, the global switches, the
 * remaining operands, and the set of switches the user actually provided.
 *
 * @example
 * const spec = {
 *   globals: { help: { type: 'boolean', short: 'h' } },
 *   commands: {
 *     'validate-config': {
 *       options: {
 *         'config-file': { type: 'string', short: 'c' },
 *         format: { type: 'string', short: 'f' }
 *       }
 *     }
 *   }
 * }
 *
 * parse(spec, ['validate-config', '-c', './newrelic.js', '--format', 'json'])
 * // => {
 * //   command: 'validate-config',
 * //   globals: {},
 * //   options: { 'config-file': './newrelic.js', format: 'json' },
 * //   operands: [],
 * //   provided: Set(2) { 'config-file', 'format' }
 * // }
 */
export function parse(spec, argv = process.argv.slice(2)) {
  const normSpec = validateSpec(spec)
  const args = [...argv]

  // Index of short -> key across globals (used before a command is known) is
  // not enough for per-command shorts, so we recompute once the command is
  // found. For command detection we only need to skip option *values*, which
  // requires knowing which options take a string value. Use the global table
  // plus every command option as a permissive union for the skip logic.
  const unionMerged = { ...normSpec.globals }
  for (const command of Object.values(normSpec.commands)) {
    Object.assign(unionMerged, command?.options ?? {})
  }
  const unionShortIndex = buildShortIndex(unionMerged)

  // ---- Stage 1: find the command token (globals-anywhere) ----------------
  const command = findCommand(args, normSpec, unionMerged, unionShortIndex)
  if (command == null) {
    throw new ParseError('missing or unknown command', { code: 'ENOCMD' })
  }

  // ---- Stage 2: normalize optional-value switches for THIS command -------
  const { options: parseArgsOptions, merged } = buildParseArgsOptions(normSpec, command)
  const shortIndex = buildShortIndex(merged)
  const normalized = normalizeOptionalValues(args, merged, shortIndex, normSpec)

  // ---- Stage 3: single parseArgs call, then split by scope ---------------
  let values
  let positionals
  let tokens
  try {
    ;({ values, positionals, tokens } = parseArgs({
      args: normalized,
      options: parseArgsOptions,
      allowPositionals: true,
      strict: normSpec.strict,
      allowNegative: normSpec.allowNegative,
      tokens: true
    }))
  } catch (err) {
    // parseArgs always sets a `code` on the errors it throws.
    throw new ParseError(friendlyMessage(err), { code: err.code, cause: err })
  }

  // Which switches the user actually supplied (vs. filled in from `default`).
  // Lets callers distinguish `--dump` (bare) from "not passed" even when the
  // option declares a default.
  const provided = new Set(
    tokens.filter((t) => t.kind === 'option').map((t) => t.name)
  )

  const globalsOut = {}
  const optionsOut = {}
  for (const [key, value] of Object.entries(values)) {
    if (key in normSpec.globals) {
      globalsOut[key] = value
    } else {
      optionsOut[key] = value
    }
  }

  // operands = positionals minus the single command token (first occurrence).
  const operands = [...positionals]
  const cmdIdx = operands.indexOf(command)
  if (cmdIdx !== -1) {
    operands.splice(cmdIdx, 1)
  }

  return {
    command,
    globals: globalsOut,
    options: optionsOut,
    operands,
    provided
  }
}

function buildShortIndex(merged) {
  const idx = new Map()
  for (const [key, def] of Object.entries(merged)) {
    if (def?.short != null) {
      idx.set(def.short, key)
    }
  }
  return idx
}

// Walk argv, skipping options (and the values of string options) until we hit
// an operand that names a known command. Stops option scanning at `--`.
function findCommand(args, normSpec, merged, shortIndex) {
  let afterDoubleDash = false
  for (let i = 0; i < args.length; i++) {
    const token = args[i]

    if (!afterDoubleDash && token === '--') {
      afterDoubleDash = true
      continue
    }

    if (!afterDoubleDash && token.startsWith('-') && token !== '-') {
      // Does this option consume the following token as its value?
      const match = optionForToken(token, merged, shortIndex)
      if (
        match != null &&
        match.def?.type === 'string' &&
        !match.hasInlineValue &&
        match.def?.optionalValue !== true // optional-value switches never force-consume
      ) {
        i++ // skip the value token
      }
      continue
    }

    // an operand
    if (token in normSpec.commands) {
      return token
    }
    // first non-command operand with no known command yet → fall through to
    // defaultCommand handling below.
    if (normSpec.defaultCommand != null) {
      return normSpec.defaultCommand
    }
    return null
  }

  return normSpec.defaultCommand
}

// Rewrite bare optional-value switches so parseArgs won't throw and so greedy
// value capture follows the stop rules.
function normalizeOptionalValues(args, merged, shortIndex, normSpec) {
  const out = []
  let afterDoubleDash = false

  for (let i = 0; i < args.length; i++) {
    const token = args[i]

    if (afterDoubleDash) {
      out.push(token)
      continue
    }
    if (token === '--') {
      afterDoubleDash = true
      out.push(token)
      continue
    }

    const match = optionForToken(token, merged, shortIndex)
    const isOptionalSwitch =
      match != null && match.def?.optionalValue === true && !match.hasInlineValue && match.exact !== false

    if (!isOptionalSwitch) {
      out.push(token)
      continue
    }

    const next = args[i + 1]
    const greedy = match.def?.greedy !== false // default greedy for optional-value
    const nextIsValue =
      greedy &&
      next !== undefined &&
      next !== '--' &&
      !next.startsWith('-') &&
      !(next in normSpec.commands)

    if (nextIsValue) {
      // leave the switch; let parseArgs consume `next` as the string value.
      out.push(token)
    } else {
      // bare switch → empty value so the string option doesn't error.
      // `--dump` becomes `--dump=`; the exact short `-d` becomes `-d=`.
      out.push(`${token}=`)
    }
  }

  return out
}

/**
 * Translates a `node:util.parseArgs` error into a concise, user-facing message.
 *
 * @param {Error} err The error thrown by parseArgs (carries a `code`).
 *
 * @returns {string} A friendly message for the error.
 */
export function friendlyMessage(err) {
  switch (err.code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION':
      return `unknown option: ${err.message.replace(/^.*?'(-[^']*)'.*$/s, '$1')}`
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE':
      return `invalid option value: ${err.message}`
    case 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL':
      return `unexpected argument: ${err.message}`
    default:
      return err.message
  }
}
