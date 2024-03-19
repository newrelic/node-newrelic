/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const InstrumentationDescriptor = require('../../lib/instrumentation-descriptor')

tap.test('constructs instances', async (t) => {
  const desc = new InstrumentationDescriptor({
    type: 'generic',
    module: 'foo',
    moduleName: 'foo',
    absolutePath: '/foo',
    resolvedName: '/opt/app/node_modules/foo',
    onRequire,
    onError
  })

  t.equal(desc.type, InstrumentationDescriptor.TYPE_GENERIC)
  t.equal(desc.module, 'foo')
  t.equal(desc.moduleName, 'foo')
  t.equal(desc.absolutePath, '/foo')
  t.equal(desc.resolvedName, '/opt/app/node_modules/foo')
  t.equal(desc.onRequire, onRequire)
  t.equal(desc.onError, onError)
  t.equal(desc.instrumentationId, 0)

  const desc2 = new InstrumentationDescriptor({ moduleName: 'foo' })
  t.equal(desc2.instrumentationId, 1)

  function onRequire() {}
  function onError() {}
})
