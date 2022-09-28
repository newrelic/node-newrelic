/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import sinon from 'sinon'
import path from 'node:path'
import * as td from 'testdouble'
import shimmer from '../../lib/shimmer.js'
import helper from '../lib/agent_helper.js'
import esmHelpers from '../lib/esm-helpers.mjs'
import { default as testModInstrumentation } from '../lib/test-mod-instrumentation.js'
const __dirname = esmHelpers.__dirname(import.meta.url)
const TEST_MOD_FILE_PATH = path.resolve(`${__dirname}../lib/test-mod.mjs`)
const MOD_URL = `file://${TEST_MOD_FILE_PATH}`
shimmer.registerInstrumentation({
  moduleName: 'test-mod',
  type: 'generic',
  onRequire: testModInstrumentation
})

tap.test('Instrument ESM', { skip: !esmHelpers.supportedLoaderVersion() }, async (t) => {
  const fakeAgent = helper.loadMockedAgent()
  await td.replaceEsm('../../index.js', {}, { agent: fakeAgent })
  const loader = await import('../../esm-loader.mjs')
  loader.registeredSpecifiers.set(MOD_URL, 'test-mod')
  const data = await loader.load(`${MOD_URL}?hasNrInstrumentation=true`, {}, sinon.stub())
  const mod = await import(
    `data:application/javascript;base64,${Buffer.from(data.source).toString('base64')}`
  )
  const result = mod.default.testMethod()
  t.ok(result.endsWith('that we have instrumented.'), 'should instrument methods on default export')
  const namedMethodResult = mod.namedMethod()
  t.ok(namedMethodResult.endsWith('that we have instrumented.'), 'should instrument named exports')
})
