/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const expect = require('chai').expect

const DistributedTracePayload = require('../../../lib/transaction/dt-payload')
const DistributedTracePayloadStub = DistributedTracePayload.Stub

describe('DistributedTracePayload', function () {
  it('has a text method that returns the stringified payload', function () {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayload(payload)
    const output = JSON.parse(dt.text())
    expect(output).to.have.property('v').that.is.an('array')
    expect(output).to.have.property('d').that.is.an('object')
    const keys = Object.keys(output.d)
    expect(keys.length).to.equal(2)
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i]
      expect(output.d[key]).to.equal(payload[key])
    }
  })

  it('has a httpSafe method that returns the base64 encoded payload', function () {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayload(payload)
    const output = JSON.parse(Buffer.from(dt.httpSafe(), 'base64').toString('utf-8'))
    expect(output).to.have.property('v').that.is.an('array')
    expect(output).to.have.property('d').that.is.an('object')
    const keys = Object.keys(output.d)
    expect(keys.length).to.equal(2)
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i]
      expect(output.d[key]).to.equal(payload[key])
    }
  })
})

describe('DistributedTracePayloadStub', function () {
  it('has a httpSafe method that returns an empty string', function () {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayloadStub(payload)
    expect(dt.httpSafe()).to.equal('')
  })

  it('has a text method that returns an empty string', function () {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayloadStub(payload)
    expect(dt.text()).to.equal('')
  })
})
