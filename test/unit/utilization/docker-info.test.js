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
  ctx.nr.utilCommon = utilCommon

  const { getBootId, getVendorInfo } = require('../../../lib/utilization/docker-info')
  ctx.nr.getBootId = getBootId
  ctx.nr.getVendorInfo = getVendorInfo

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

test('falls back to v1 correctly', (t, end) => {
  const { agent, logger, getVendorInfo, utilCommon } = t.nr
  let invocation = 0

  utilCommon.readProc = (path, callback) => {
    if (invocation === 0) {
      invocation += 1
      return callback(null, 'invalid cgroups v2 file')
    }
    callback(null, '4:cpu:/docker/f37a7e4d17017e7bf774656b19ca4360c6cdc4951c86700a464101d0d9ce97ee')
  }

  getVendorInfo(agent, gotInfo, logger)

  function gotInfo(error, info) {
    assert.ifError(error)
    assert.deepStrictEqual(info, {
      id: 'f37a7e4d17017e7bf774656b19ca4360c6cdc4951c86700a464101d0d9ce97ee'
    })
    assert.deepStrictEqual(t.nr.logs, [
      'Found /proc/self/mountinfo but failed to parse Docker container id.',
      'Attempting to fall back to cgroups v1 parsing.',
      'Found docker id from cgroups v1: f37a7e4d17017e7bf774656b19ca4360c6cdc4951c86700a464101d0d9ce97ee'
    ])
    end()
  }
})
