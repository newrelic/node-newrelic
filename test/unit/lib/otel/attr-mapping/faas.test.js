/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { getMapping } = require('#agentlib/otel/attr-mapping/faas.js')
const test = require('node:test')
const assert = require('node:assert')
const {
  ATTR_AWS_REGION
} = require('#agentlib/otel/constants.js')

test('region', () => {
  const span = {
    attributes: {
      [ATTR_AWS_REGION]: 'us-east-1'
    }
  }
  const { value } = getMapping({ key: 'region', span })
  assert.deepEqual(value, 'us-east-1')
})
