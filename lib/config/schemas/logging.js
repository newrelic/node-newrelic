/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'logging.js',
  type: 'object',
  properties: {
    level: {
      type: 'string',
      default: 'info',
      description: "Verbosity of the module's logging. This module uses bunyan (https://github.com/trentm/node-bunyan) for its logging, and as such the valid logging levels are 'fatal', 'error', 'warn', 'info', 'debug' and 'trace'. Logging at levels 'info' and higher is very terse. For support requests, attaching logs captured at 'trace' level are extremely helpful in chasing down bugs."
    },
    filepath: {
      type: 'string',
      description: "Where to put the log file -- by default just uses process.cwd + 'newrelic_agent.log'. A special case is a filepath of 'stdout', in which case all logging will go to stdout, or 'stderr', in which case all logging will go to stderr."
    },
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Whether to write to a log file at all'
    }
  },
  additionalProperties: true
}
