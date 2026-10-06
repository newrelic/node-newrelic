#!/usr/bin/env node
/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

process.exitCode = 1

// `(node:util).parseArgs` is very clearly not designed for tools that operate
// via commands. First, we have a fragile reliance on positional parameters
// in order to get the desired command (e.g. the command can come after the
// options that are associated with it). Second, the options (values) are not
// actually associated with the provided command. But we really don't want to
// have to include another dependency for a rarely used CLI tool. So we are
// making use of what is available to us.
import { parseArgs } from 'node:util'
import { createReadStream, readFileSync } from 'node:fs'

import validateCliConfig from './validate-config.mjs'

const options = {
  'config-file': {
    type: 'string',
    short: 'c',
  },

  format: {
    type: 'string',
    short: 'f'
  },

  help: {
    type: 'boolean',
    short: 'h'
  }
}
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options
})

if (positionals.length < 1) {
  console.error('Missing command.\n')
  displayHelp()
  process.exit()
}

const command = positionals[0]
if (command !== 'validate-config') {
  console.error('Unrecognized command.\n')
  displayHelp()
  process.exit()
} else if (values.help === true) {
  displayHelp('validate-config')
  process.exit(0)
}

const configFile = values['config-file']
const input = configFile
  ? createReadStream(configFile)
  : process.stdin
validateCliConfig({
  input,
  filePath: configFile,
  format: values.format
})

function displayHelp(cmd = null) {
  if (cmd === null) {
    console.error(
      readFileSync('./cli/help.txt').toString('utf8')
    )
    return
  }

  console.error(
    readFileSync(`./cli/help/${cmd}.txt`).toString('utf8')
  )
}
