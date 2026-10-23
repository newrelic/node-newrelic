#!/usr/bin/env node
/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

process.exitCode = 1

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parse, ParseError } from './parser.mjs'
import validateCliConfig from './validate-config.mjs'

const argumentsConfig = {
  globals: {
    help: {
      type: 'boolean',
      short: 'h'
    }
  },

  commands: {
    'validate-config': {
      options: {
        'config-file': {
          type: 'string',
          short: 'c'
        },

        'output-format': {
          type: 'string',
          short: 'o'
        },

        dump: {
          type: 'string',
          short: 'd',
          optionalValue: true,
          greedy: true
        },

        format: {
          type: 'string',
          short: 'f'
        }
      }
    }
  }
}

let parsed
try {
  parsed = parse(argumentsConfig, process.argv.slice(2))
} catch (error) {
  if (error instanceof ParseError && error.code === 'ENOCMD') {
    // Distinguish "no command given" from "a command was given but is not
    // recognized" so the message matches what the user did.
    const gaveOperand = process.argv.slice(2).some((arg) => arg.startsWith('-') === false)
    console.error(gaveOperand ? 'Unrecognized command.\n' : 'Missing command.\n')
    displayHelp()
    process.exit()
  }
  console.error(`${error.message}\n`)
  displayHelp('validate-config')
  process.exit()
}

if (parsed.globals.help === true) {
  displayHelp('validate-config')
  process.exit(0)
}

const configFile = parsed.options['config-file']
if (configFile == null) {
  console.error('Must supply a configuration file to validate.\n')
  displayHelp('validate-config')
  process.exit()
}

await validateCliConfig({
  filePath: configFile,
  outputFormat: parsed.options['output-format'],
  dump: parsed.options.dump,
  dumpFormat: parsed.options.format
})

function displayHelp(cmd = null) {
  if (cmd === null) {
    console.error(
      readFileSync(
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        join(import.meta.dirname, 'help.txt')
      ).toString('utf8')
    )
    return
  }

  console.error(
    readFileSync(
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      join(import.meta.dirname, 'help', `${cmd}.txt`)
    ).toString('utf8')
  )
}
