/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const INSTRUMENTED_COMMANDS = new Set([
  'InvokeModelCommand',
  'InvokeModelWithResponseStreamCommand',
  'ConverseCommand',
  'ConverseStreamCommand'
])

const STREAMING_COMMANDS = new Set([
  'InvokeModelWithResponseStreamCommand',
  'ConverseStreamCommand'
])

const CONVERSE_COMMANDS = new Set([
  'ConverseCommand',
  'ConverseStreamCommand'
])

module.exports = {
  INSTRUMENTED_COMMANDS,
  STREAMING_COMMANDS,
  CONVERSE_COMMANDS
}
