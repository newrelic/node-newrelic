/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const client = require('../../../lib/instrumentation/@node-redis/client')

tap.test('getRedisParams should behave as expected', function (t) {
  t.autoend()

  t.test('given no opts, should return sensible defaults', function (t) {
    t.autoend()
    const params = client.getRedisParams()
    const expected = {
      host: 'localhost',
      port_path_or_id: '6379',
      database_name: 0
    }
    t.match(params, expected, 'redis client should be definable without params')
  })
  t.test('if host/port are defined incorrectly, should return expected defaults', function (t) {
    t.autoend()
    const params = client.getRedisParams({ host: 'myLocalHost', port: '1234' })
    const expected = {
      host: 'localhost',
      port_path_or_id: '6379',
      database_name: 0
    }
    t.match(params, expected, 'should return sensible defaults if defined without socket')
  })
  t.test('if host/port are defined correctly, we should see them in config', function (t) {
    t.autoend()
    const params = client.getRedisParams({ socket: { host: 'myLocalHost', port: '1234' } })
    const expected = {
      host: 'myLocalHost',
      port_path_or_id: '1234',
      database_name: 0
    }
    t.match(params, expected, 'host/port should be returned when defined correctly')
  })
  t.test('path should be used if defined', function (t) {
    t.autoend()
    const params = client.getRedisParams({ socket: { path: '5678' } })
    const expected = {
      host: 'localhost',
      port_path_or_id: '5678',
      database_name: 0
    }
    t.match(params, expected, 'path should show up in params')
  })
  t.test('path should be preferred over port', function (t) {
    t.autoend()
    const params = client.getRedisParams({
      socket: { host: 'myLocalHost', port: '1234', path: '5678' }
    })
    const expected = {
      host: 'myLocalHost',
      port_path_or_id: '5678',
      database_name: 0
    }
    t.match(params, expected, 'path should show up in params')
  })
  t.test('database name should be definable', function (t) {
    t.autoend()
    const params = client.getRedisParams({ database: 12 })
    const expected = {
      host: 'localhost',
      port_path_or_id: '6379',
      database_name: 12
    }
    t.match(params, expected, 'database should be definable')
  })
})
