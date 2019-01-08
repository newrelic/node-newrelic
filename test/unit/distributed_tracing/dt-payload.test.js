'use strict'

var expect = require('chai').expect

var DistributedTracePayload = require('../../../lib/transaction/dt-payload')
var DistributedTracePayloadStub = DistributedTracePayload.Stub

describe('DistributedTracePayload', function() {
  it('has a text method that returns the stringified payload', function() {
    var payload = {
      a: 1,
      b: 'test'
    }
    var dt = new DistributedTracePayload(payload)
    var output = JSON.parse(dt.text())
    expect(output).to.have.property('v').that.is.an('array')
    expect(output).to.have.property('d').that.is.an('object')
    var keys = Object.keys(output.d)
    expect(keys.length).to.equal(2)
    for (var i = 0; i < keys.length; ++i) {
      var key = keys[i]
      expect(output.d[key]).to.equal(payload[key])
    }
  })

  it('has a httpSafe method that returns the base64 encoded payload', function() {
    var payload = {
      a: 1,
      b: 'test'
    }
    var dt = new DistributedTracePayload(payload)
    var output = JSON.parse(Buffer.from(dt.httpSafe(), 'base64').toString('utf-8'))
    expect(output).to.have.property('v').that.is.an('array')
    expect(output).to.have.property('d').that.is.an('object')
    var keys = Object.keys(output.d)
    expect(keys.length).to.equal(2)
    for (var i = 0; i < keys.length; ++i) {
      var key = keys[i]
      expect(output.d[key]).to.equal(payload[key])
    }
  })
})

describe('DistributedTracePayloadStub', function() {
  it('has a httpSafe method that returns an empty string', function() {
    var payload = {
      a: 1,
      b: 'test'
    }
    var dt = new DistributedTracePayloadStub(payload)
    expect(dt.httpSafe()).to.equal('')
  })

  it('has a text method that returns an empty string', function() {
    var payload = {
      a: 1,
      b: 'test'
    }
    var dt = new DistributedTracePayloadStub(payload)
    expect(dt.text()).to.equal('')
  })
})
