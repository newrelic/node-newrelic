/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const InstrumentationDescriptor = require('../../lib/instrumentation-descriptor')

test('constructs instances', async () => {
  const desc = new InstrumentationDescriptor({
    type: 'generic',
    module: 'foo',
    moduleName: 'foo',
    absolutePath: '/foo',
    resolvedName: '/opt/app/node_modules/foo',
    onRequire,
    onError
  })

  assert.equal(desc.type, InstrumentationDescriptor.TYPE_GENERIC)
  assert.equal(desc.module, 'foo')
  assert.equal(desc.moduleName, 'foo')
  assert.equal(desc.absolutePath, '/foo')
  assert.equal(desc.resolvedName, '/opt/app/node_modules/foo')
  assert.equal(desc.onRequire, onRequire)
  assert.equal(desc.onError, onError)
  assert.equal(desc.instrumentationId, 0)

  const desc2 = new InstrumentationDescriptor({ moduleName: 'foo' })
  assert.equal(desc2.instrumentationId, 1)

  function onRequire() {}
  function onError() {}
})
