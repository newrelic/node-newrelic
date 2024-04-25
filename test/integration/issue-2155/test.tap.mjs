/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import crypto from 'crypto'
import path from 'path'
import url from 'url'
import helper from '../../lib/agent_helper.js'
import shimmer from '../../../lib/shimmer.js'
import InstrumentationDescriptor from '../../../lib/instrumentation-descriptor.js'

let modPath
if (import.meta.dirname) {
  modPath = path.join(import.meta.dirname, 'foo.cjs')
} else {
  modPath = path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'foo.cjs')
}

function instrumentation(shim, resolvedModule) {
  shim.wrapExport(resolvedModule, function wrapModule(shim, fn) {
    return function wrappedModule() {
      // `fn` _should_ be the `foo()` function exported by the module.
      // If it is anything else, i.e. the proxy object, then we have an error
      // in our handling of CJS modules as ESM.
      const foo = fn.apply(this, arguments)
      const _name = foo.name
      foo.name = () => {
        const value = _name.call(foo)
        return `wrapped: ${value}`
      }
      return foo
    }
  })
}

tap.beforeEach(async (t) => {
  shimmer.registerInstrumentation({
    type: InstrumentationDescriptor.TYPE_GENERIC,
    moduleName: 'foo',
    absolutePath: modPath,
    onRequire: instrumentation
  })

  const agent = helper.instrumentMockedAgent()
  t.context.agent = agent

  const { default: foo } = await import('./foo.cjs?v=' + crypto.randomBytes(16).toString('hex'))
  t.context.mod = foo
})

tap.afterEach((t) => {
  helper.unloadAgent(t.context.agent)
})

tap.test('CJS imported as ESM gets wrapped correctly', async (t) => {
  const { mod } = t.context
  const instance = mod()
  t.equal(instance.name(), 'wrapped: foo')
})
