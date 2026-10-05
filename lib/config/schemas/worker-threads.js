/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'worker-threads.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: false
    }
  },
  additionalProperties: true,
  description: 'When enabled, it will allow loading of the agent in worker threads. In 11.0.0 we added code to prevent loading in worker threads to cut down on unnecessary overhead of the agent. We have found in testing that traces and spans were useless unless work was completely self contained in the worker thread.'
}
