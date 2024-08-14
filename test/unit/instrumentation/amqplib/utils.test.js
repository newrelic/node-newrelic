/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { parseConnectionArgs } = require('../../../../lib/instrumentation/amqplib/utils')

test('should parse host port if connection args is a string', () => {
  const stub = {
    isString() {
      return true
    }
  }
  const params = parseConnectionArgs({ shim: stub, connArgs: 'amqp://host:5388/' })
  assert.equal(params.host, 'host')
  assert.equal(params.port, 5388)
})

test('should parse host port if connection is an object', () => {
  const stub = {
    isString() {
      return false
    }
  }
  const params = parseConnectionArgs({ shim: stub, connArgs: { hostname: 'host', port: 5388 } })
  assert.equal(params.host, 'host')
  assert.equal(params.port, 5388)
})

test('should default port to 5672 if protocol is amqp:', () => {
  const stub = {
    isString() {
      return false
    }
  }
  const params = parseConnectionArgs({
    shim: stub,
    connArgs: { hostname: 'host', protocol: 'amqp' }
  })
  assert.equal(params.host, 'host')
  assert.equal(params.port, 5672)
})

test('should default port to 5671 if protocol is amqps:', () => {
  const stub = {
    isString() {
      return false
    }
  }
  const params = parseConnectionArgs({
    shim: stub,
    connArgs: { hostname: 'host', protocol: 'amqps' }
  })
  assert.equal(params.host, 'host')
  assert.equal(params.port, 5671)
})
