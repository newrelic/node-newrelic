/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// A fake module that will be imported as ESM. Basically, the issue is that
// CJS imported as ESM needs its exports proxied and our `shim.wrapExport`
// needs to recognize the "original" export in order to pass it in to the
// instrumentation.

function foo() {
  return Object.create({
    name() {
      return 'foo'
    }
  })
}

// This triplet export replicates they way Fastify solves the CJS utilized in
// ESM issue. It makes it possible to `import foo from './foo.cjs'` or to
// `import { foo } from './foo.cjs'`. It also allows us to replicate the
// issue at hand.
module.exports = foo
module.exports.default = foo
module.exports.foo = foo
