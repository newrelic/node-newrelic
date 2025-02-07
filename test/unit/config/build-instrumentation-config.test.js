/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

test('should default the instrumentation stanza', () => {
  const { boolean } = require('../../../lib/config/formatters')
  const pkgs = require('../../../lib/config/build-instrumentation-config')
  const instrumentation = require('../../../lib/instrumentations')()
  const pkgNames = Object.keys(instrumentation)

  pkgNames.forEach((pkg) => {
    assert.deepEqual(pkgs[pkg], { enabled: { formatter: boolean, default: true } })
  })

  assert.deepEqual(pkgs.undici, { enabled: { formatter: boolean, default: true } })
  const coreLibraries = require('../../../lib/core-instrumentation')
  const corePkgs = Object.keys(coreLibraries)
  corePkgs.forEach((pkg) => {
    assert.deepEqual(pkgs[pkg], { enabled: { formatter: boolean, default: true } })
  })
})
