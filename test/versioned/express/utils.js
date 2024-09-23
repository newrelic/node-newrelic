/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const http = require('http')
const helper = require('../../lib/agent_helper')
const semver = require('semver')
const promiseResolvers = require('../../lib/promise-resolvers')
const TEST_HOST = 'localhost'
const TEST_URL = `http://${TEST_HOST}`

function isExpress5() {
  const { version } = require('express/package')
  return semver.gte(version, '5.0.0')
}

function makeRequest(port, path, callback) {
  http.request({ port, path }, callback).end()
}

async function setup(ctx, config = {}) {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent(config)
  ctx.nr.isExpress5 = isExpress5()

  ctx.nr.express = require('express')
  ctx.nr.app = ctx.nr.express()
  const { promise, resolve } = promiseResolvers()
  const server = require('http').createServer(ctx.nr.app)
  server.listen(0, TEST_HOST, resolve)
  await promise
  ctx.nr.server = server
  ctx.nr.port = server.address().port
}

function teardown(ctx) {
  const { server, agent } = ctx.nr
  server.close()
  helper.unloadAgent(agent)
}

module.exports = {
  isExpress5,
  makeRequest,
  setup,
  teardown,
  TEST_URL
}
