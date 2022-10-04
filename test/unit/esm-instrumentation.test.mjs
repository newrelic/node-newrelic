/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import sinon from 'sinon'
import path from 'node:path'
import * as td from 'testdouble'
import helper from '../lib/agent_helper.js'
import esmHelpers from '../lib/esm-helpers.mjs'
import NAMES from '../../lib/metrics/names.js'
const __dirname = esmHelpers.__dirname(import.meta.url)
const TEST_MOD_FILE_PATH = path.resolve(`${__dirname}../lib/test-mod.mjs`)
const MOD_URL = `file://${TEST_MOD_FILE_PATH}`

tap.test(
  'Register custom ESM instrumentation',
  { skip: !esmHelpers.supportedLoaderVersion() },
  async (t) => {
    const fakeAgent = helper.loadMockedAgent()
    t.teardown(() => {
      helper.unloadAgent(fakeAgent)
    })
    fakeAgent.config.api.esm.custom_instrumentation_entrypoint =
      './test/lib/test-mod-instrumentation.mjs'
    await td.replaceEsm('../../index.js', {}, { agent: fakeAgent })
    const loader = await import('../../esm-loader.mjs')
    loader.registeredSpecifiers.set(MOD_URL, 'test-mod')
    const data = await loader.load(`${MOD_URL}?hasNrInstrumentation=true`, {}, sinon.stub())
    const mod = await import(
      `data:application/javascript;base64,${Buffer.from(data.source).toString('base64')}`
    )
    const result = mod.default.testMethod()
    t.ok(
      result.endsWith('that we have instrumented.'),
      'should instrument methods on default export'
    )
    const namedMethodResult = mod.namedMethod()
    t.ok(
      namedMethodResult.endsWith('that we have instrumented.'),
      'should instrument named exports'
    )
    const metric = fakeAgent.metrics.getMetric(NAMES.FEATURES.ESM.CUSTOM_INSTRUMENTATION)
    t.ok(metric, 'metric should exist')
    t.equal(metric.callCount, 1, 'custom instrumentation metric should have been called once')
  }
)

tap.test(
  'Do not register custom ESM instrumentation',
  { skip: !esmHelpers.supportedLoaderVersion() },
  async (t) => {
    const fakeAgent = helper.loadMockedAgent()
    t.teardown(() => {
      helper.unloadAgent(fakeAgent)
    })
    await td.replaceEsm('../../index.js', {}, { agent: fakeAgent })
    const loader = await import('../../esm-loader.mjs')
    loader.registeredSpecifiers.set(MOD_URL, 'test-mod')
    const data = await loader.load(`${MOD_URL}?hasNrInstrumentation=true`, {}, sinon.stub())
    const mod = await import(
      `data:application/javascript;base64,${Buffer.from(data.source).toString('base64')}`
    )
    const result = mod.default.testMethod()
    t.equal(result, 'this is a test method', 'should not instrument methods on default export')
    const namedMethodResult = mod.namedMethod()
    t.equal(namedMethodResult, 'this is a named method', 'should not instrument named exports')
    const metric = fakeAgent.metrics.getMetric(NAMES.FEATURES.ESM.CUSTOM_INSTRUMENTATION)
    t.notOk(metric, 'metric should not exist')
  }
)
