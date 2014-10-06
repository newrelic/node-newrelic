'use strict'

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , configurator = require('../../lib/config.js')
  , sampler      = require('../../lib/sampler')
  , Agent        = require('../../lib/agent')
  

describe("environmental sampler", function () {
  var agent

  beforeEach(function () {
    agent = new Agent(configurator.initialize())
  })

  afterEach(function (){
    sampler.stop()
  })

  it("should depend on Agent to provide the current metrics summary", function () {
    expect(function () { sampler.start(agent); }).not.throws()
    expect(function () { sampler.stop(agent); }).not.throws()
  })

  it("should default to a state of stopped", function () {
    expect(sampler.state).equal('stopped')
  })

  it("should say it's running after start", function () {
    sampler.start(agent)
    expect(sampler.state).equal('running')
  })

  it("should have a rough idea of how much memory Node is using", function () {
    sampler.sampleMemory(agent)()

    var stats = agent.metrics.getOrCreateMetric('Memory/Physical')
    expect(stats.callCount).equal(1)
    expect(stats.max).above(1); // maybe someday this test will fail
  })

  it("should have some rough idea of how deep the event queue is", function (done) {
    sampler.checkEvents(agent)()

    /* sampler.checkEvents works by creating a timer and using
     * setTimeout to schedule an "immediate" callback execution,
     * which gives a rough idea of how much stuff is sitting pending
     * on the libuv event queue (and whether there's a lot of stuff
     * being handled through process.nextTick, which maintains its
     * own queue of immediate callbacks). It remains to be seen how
     * high this metric will ever get, but at least the underlying
     * timer has nanosecond precision (and probably significantly
     * greater-than-millisecond accuracy).
     */
    setTimeout(function () {
      var stats = agent.metrics.getOrCreateMetric('Events/wait')
      expect(stats.callCount).equal(1)
      /* process.hrtime will notice the passage of time, but this
       * happens too fast to measure any meaningful latency in versions
       * of Node that don't have process.hrtime available, so just make
       * sure we're not getting back undefined or null here.
       */
      expect(stats.total).a('number')
      if (process.hrtime) expect(stats.total).above(0)

      done()
    }, 0)
  })
})
