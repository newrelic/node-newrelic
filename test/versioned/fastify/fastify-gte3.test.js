/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const symbols = require('../../../lib/symbols')
const semver = require('semver')
const { version: pkgVersion } = require('fastify/package.json')

/**
 * Fastify v3 has '.fastify' and '.default' properties attached to the exported
 * 'fastify' function. These are all the same original exported function, just
 * arranged to support a variety of import styles.
 * This is only applicable to <3.21.0 as we instrument the instance of fastify over
 * diagnostic channel in 3.21.0+
 */
test('Should propagate fastify exports when instrumented', { skip: semver.gte(pkgVersion, '3.21.0') }, () => {
  helper.instrumentMockedAgent()
  const Fastify = require('fastify')
  const original = Fastify[symbols.original]

  // Confirms the original setup matches expectations
  assert.equal(original.fastify, original)
  assert.equal(original.default, original)

  // Asserts our new export has the same behavior
  assert.equal(Fastify.fastify, Fastify)
  assert.equal(Fastify.default, Fastify)
})
