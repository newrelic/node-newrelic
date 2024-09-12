/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const { removeModules, removeMatchedModules } = require('../../lib/cache-buster')

test.beforeEach(async (ctx) => {
  ctx.nr = {}

  const fs = require('fs')
  const os = require('os')
  ctx.nr.orig = {
    fs_access: fs.access,
    fs_readFile: fs.readFile,
    os_platform: os.platform
  }
  fs.access = (file, mode, cb) => {
    cb(Error('no proc file'))
  }
  os.platform = () => 'linux'
  ctx.nr.fs = fs
  ctx.nr.os = os

  const utilCommon = require('../../../lib/utilization/common')
  utilCommon.readProc = (path, cb) => {
    cb(null, 'docker-1')
  }

  const { getBootId } = require('../../../lib/utilization/docker-info')
  ctx.nr.getBootId = getBootId

  ctx.nr.agent = helper.loadMockedAgent()
  ctx.nr.agent.config.utilization = {
    detect_aws: true,
    detect_azure: true,
    detect_gcp: true,
    detect_docker: true,
    detect_kubernetes: true,
    detect_pcf: true
  }

  ctx.nr.logs = []
  ctx.nr.logger = {
    debug(msg) {
      ctx.nr.logs.push(msg)
    }
  }
})

test.afterEach((ctx) => {
  removeModules(['fs', 'os'])
  removeMatchedModules(/docker-info/)
  removeMatchedModules(/utilization\/commo/)
  helper.unloadAgent(ctx.nr.agent)
})

test('error if not on linux', (t, end) => {
  const { agent, logger, getBootId, os } = t.nr
  os.platform = () => false
  getBootId(agent, callback, logger)

  function callback(error, data) {
    assert.equal(error, null)
    assert.equal(data, null)
    assert.deepStrictEqual(t.nr.logs, ['Platform is not a flavor of linux, omitting boot info'])
    end()
  }
})

test('error if no proc file', (t, end) => {
  const { agent, logger, getBootId } = t.nr
  getBootId(agent, callback, logger)

  function callback(error, data) {
    assert.equal(error, null)
    assert.equal(data, null)
    assert.deepStrictEqual(t.nr.logs, ['Container boot id is not available in cgroups info'])
    end()
  }
})

test('data on success', (t, end) => {
  const { agent, logger, getBootId, fs } = t.nr
  fs.access = (file, mode, cb) => {
    cb(null)
  }

  getBootId(agent, callback, logger)

  function callback(error, data) {
    assert.equal(error, null)
    assert.equal(data, 'docker-1')
    assert.deepStrictEqual(t.nr.logs, [])
    end()
  }
})
