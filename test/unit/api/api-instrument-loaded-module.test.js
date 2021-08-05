/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')

tap.test('Agent API - instrumentLoadedModule', (t) => {
  t.autoend()

  let agent
  let api
  let expressMock
  let shimHelper

  t.beforeEach(() => {
    agent = agentHelper.instrumentMockedAgent()

    api = new API(agent)

    expressMock = {}
    expressMock.application = {}
    expressMock.application.use = function use() {}
    expressMock.Router = {}

    shimHelper = new Shim(agent, 'fake')
  })

  t.afterEach(() => {
    agentHelper.unloadAgent(agent)
    agent = null
    api = null
    expressMock = null
  })

  t.test('should be callable without an error', (t) => {
    api.instrumentLoadedModule('express', expressMock)

    t.end()
  })

  t.test('should return true when a function is instrumented', (t) => {
    const didInstrument = api.instrumentLoadedModule('express', expressMock)
    t.equal(didInstrument, true)

    t.end()
  })

  t.test('should wrap express.application.use', (t) => {
    api.instrumentLoadedModule('express', expressMock)

    t.type(expressMock, 'object')

    const isWrapped = shimHelper.isWrapped(expressMock.application.use)
    t.ok(isWrapped)

    t.end()
  })

  t.test('should not throw if supported module is not installed', function (t) {
    // We need a supported module in our test. We need that module _not_ to be
    // installed. We'll use aws-sdk.  This first bit ensures
    let awsSdk = false
    try {
      // eslint-disable-next-line node/no-missing-require
      awsSdk = require('aws-sdk')
    } catch (e) {}
    t.ok(awsSdk === false, 'aws-sdk is not installed')

    // attempt to instrument -- if nothing throws we're good
    try {
      api.instrumentLoadedModule('aws-sdk', awsSdk)
    } catch (e) {
      t.error(e)
    }
    t.end()
  })
})
