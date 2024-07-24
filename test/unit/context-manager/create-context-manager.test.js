/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')

const createImplementation = require('../../../lib/context-manager/create-context-manager')
const AsyncLocalContextManager = require('../../../lib/context-manager/async-local-context-manager')

test('Should return AsyncLocalContextManager by default', (t) => {
  const contextManager = createImplementation({
    logging: {},
    feature_flag: {}
  })

  t.ok(contextManager instanceof AsyncLocalContextManager)
  t.end()
})
