/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/**
 * The modules below are listed here purely to take
 * advantage of the Supportability/Features/onRequire/<module>
 * metrics for libraries we want to track for some reason or another.
 * The big uses cases are:
 *  Logging libraries we want to instrument in the future
 *  Libraries that have OpenTelemetry instrumentation we want to register
 *  or have already registered.
 */
const trackingPkgs = [
  '@azure/openai',
  '@langchain/community/llms/bedrock',
  'fancy-log',
  'knex',
  'loglevel',
  'npmlog'
]

module.exports = trackingPkgs
