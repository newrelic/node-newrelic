/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const chai         = require('chai')
const expect       = chai.expect
const MetricMapper = require('../../lib/metrics/mapper.js')

describe('MetricMapper', function() {
  it("shouldn't throw if passed null", function() {
    expect(function() { new MetricMapper().load(null) }).not.throws()
  })

  it("shouldn't throw if passed undefined", function() {
    expect(function() { new MetricMapper().load(undefined) }).not.throws()
  })

  it("shouldn't throw if passed an empty list", function() {
    expect(function() { new MetricMapper().load([]) }).not.throws()
  })

  it("shouldn't throw if passed garbage input", function() {
    expect(function() {
      new MetricMapper().load({name : 'garbage'}, 1001)
    }).not.throws()
  })

  describe("when loading mappings at creation", function() {
    var mapper

    before(function() {
      mapper = new MetricMapper([
        [{name : 'Test/RenameMe1'}, 1001],
        [{name : 'Test/RenameMe2', scope : 'TEST'}, 1002]
      ])
    })

    it("should have loaded all the mappings", function() {
      expect(mapper.length).equal(2)
    })

    it("should apply mappings", function() {
      expect(mapper.map('Test/RenameMe1')).equal(1001)
      expect(mapper.map('Test/RenameMe2', 'TEST')).equal(1002)
    })

    it("should turn non-mapped metrics into specs", function() {
      expect(mapper.map('Test/Metric1')).deep.equal({name : 'Test/Metric1'})
      expect(mapper.map('Test/Metric2', 'TEST'))
        .deep.equal({name : 'Test/Metric2', scope : 'TEST'})
    })
  })

  describe("when adding mappings after creation", function() {
    var mapper = new MetricMapper()

    before(function() {
      mapper.load([[{name : 'Test/RenameMe1'}, 1001]])
      mapper.load([[{name : 'Test/RenameMe2', scope : 'TEST'}, 1002]])
    })

    it("should have loaded all the mappings", function() {
      expect(mapper.length).equal(2)
    })

    it("should apply mappings", function() {
      expect(mapper.map('Test/RenameMe1')).equal(1001)
      expect(mapper.map('Test/RenameMe2', 'TEST')).equal(1002)
    })

    it("should turn non-mapped metrics into specs", function() {
      expect(mapper.map('Test/Metric1')).deep.equal({name : 'Test/Metric1'})
      expect(mapper.map('Test/Metric2', 'TEST'))
        .deep.equal({name : 'Test/Metric2', scope : 'TEST'})
    })
  })
})
