/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'heroku.js',
  type: 'object',
  properties: {
    use_dyno_names: {
      type: 'boolean',
      default: true
    }
  },
  additionalProperties: true,
  description: 'When enabled, it will use `process.env.DYNO` to set the hostname of the running application'
}
