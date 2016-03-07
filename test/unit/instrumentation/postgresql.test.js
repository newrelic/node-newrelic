'use strict'

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , helper = require('../../lib/agent_helper')

describe("agent instrumentation of PostgreSQL", function () {
  var agent
    , initialize

  before(function () {
    agent = helper.loadMockedAgent()
    initialize = require('../../../lib/instrumentation/pg')
  })

  after(function () {
    helper.unloadAgent(agent)
  })

  describe("shouldn't cause bootstrapping to fail", function () {
    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws()
    })

    it("when passed an empty module", function () {
      expect(function () { initialize(agent, {}); }).not.throws()
    })
  })

  describe("lazy loading of native PG client", function() {

    function getMockModule() {
      function PG(clientConstructor) {
        this.Client = clientConstructor
      }

      function DefaultClient() {}
      DefaultClient.prototype.query = function() {}
      function NativeClient() {}
      NativeClient.prototype.query = function() {}

      var mockPg = new PG(DefaultClient)
      mockPg.__defineGetter__("native", function() {
        delete mockPg.native;
        mockPg.native = new PG(NativeClient);
        return mockPg.native;
      })
      return mockPg
    }

    it("instruments when native getter is called", function() {
      var mockPg = getMockModule()

      initialize(agent, mockPg)

      var pg = mockPg.native
      expect(pg.Client['__NR_original'].name).equal('NativeClient')

      var pg = mockPg
      expect(pg.Client.name).equal('DefaultClient')
    })

    it("does not fail when getter is called multiple times", function() {
      var mockPg = getMockModule()

      initialize(agent, mockPg)
      var pg1 = mockPg.native

      initialize(agent, mockPg)
      var pg2 = mockPg.native

      expect(pg1).equal(pg2)
    })

    it("does not interfere with non-native instrumentation", function() {
      var mockPg = getMockModule()

      initialize(agent, mockPg)
      var nativeClient = mockPg.native
      expect(nativeClient.Client['__NR_original'].name).equal('NativeClient')
      var defaultClient = mockPg
      expect(defaultClient.Client.name).equal('DefaultClient')

      initialize(agent, mockPg)
      var nativeClient = mockPg.native
      expect(nativeClient.Client['__NR_original'].name).equal('NativeClient')
      var defaultClient = mockPg
      expect(defaultClient.Client.name).equal('DefaultClient')
    })

    it("when pg modules is refreshed in cache", function() {
      var mockPg = getMockModule()

      // instrument once
      initialize(agent, mockPg)
      var pg1 = mockPg.native
      expect(pg1.Client['__NR_original'].name).equal('NativeClient')

      // simulate deleting from module cache
      mockPg = getMockModule()
      initialize(agent, mockPg)
      var pg2 = mockPg.native
      expect(pg2.Client['__NR_original'].name).equal('NativeClient')

      expect(pg1).not.equal(pg2)
    })
  })

  describe("for each operation", function () {
    it("should update the global database aggregate statistics")
    it("should also update the global web aggregate statistics")
    it("should update the aggregate statistics for the operation type")
    it("should update the aggregate statistics for the specific query")
    it("should update the scoped aggregate statistics for the operation type")
  })

  describe("should instrument", function () {
    it("INSERT")
    it("SELECT")
    it("UPDATE")
    it("DELETE")
    it("EXPLAIN")
    it("ALTER TABLE")
    it("DROP TABLE")
  })
})
