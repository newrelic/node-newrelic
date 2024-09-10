/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const http = require('http')
const helper = require('../../lib/agent_helper')
const semver = require('semver')

function isExpress5() {
  const { version } = require('express/package')
  return semver.gte(version, '5.0.0')
}

function makeRequest(server, path, callback) {
  const port = server.address().port
  http.request({ port: port, path: path }, callback).end()
}

function setup(t, config = {}) {
  t.context.agent = helper.instrumentMockedAgent(config)
  t.context.isExpress5 = isExpress5()

  t.context.express = require('express')
  t.context.app = t.context.express()
  t.teardown(() => {
    helper.unloadAgent(t.context.agent)
  })
}

module.exports = {
  isExpress5,
  makeRequest,
  setup
}
