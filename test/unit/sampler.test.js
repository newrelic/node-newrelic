'use strict'

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , configurator = require('../../lib/config.js')
  , sampler      = require('../../lib/sampler')
  , Agent        = require('../../lib/agent')
  , semver       = require('semver')
  

describe("environmental sampler", function () {
  var agent
  var numCpus = require('os').cpus().length
  var oldCpuUsage = process.cpuUsage
  var oldUptime = process.uptime

  beforeEach(function () {
    agent = new Agent(configurator.initialize())
    process.cpuUsage = function (isDiff) {
      // process.cpuUsage return values in cpu microseconds (1^-6)
      return { user: 1e6 * numCpus, system: 1e6 * numCpus }
    }
    process.uptime = function () {
      // process.uptime returns values in seconds
      return 1
    }
  })

  afterEach(function (){
    sampler.stop()
    process.cpuUsage = oldCpuUsage
    process.uptime = oldUptime  
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

  it("should gather CPU user utilization metric", function () {
    if (semver.satisfies(process.version, '>= 6.1.0')) {
      sampler.sampleCpu(agent)()

      var stats = agent.metrics.getOrCreateMetric('CPU/User/Utilization')
      expect(stats.callCount).equal(1)
      expect(stats.total).equal(1)
    }
  })

  it("should gather CPU system utilization metric", function () {
    if (semver.satisfies(process.version, '>= 6.1.0')) {
      sampler.sampleCpu(agent)()

      var stats = agent.metrics.getOrCreateMetric('CPU/System/Utilization')
      expect(stats.callCount).equal(1)
      expect(stats.total).equal(1)
    }
  })

  it("should gather CPU user time metric", function () {
    if (semver.satisfies(process.version, '>= 6.1.0')) {
      sampler.sampleCpu(agent)()

      var stats = agent.metrics.getOrCreateMetric('CPU/User Time')
      expect(stats.callCount).equal(1)
      expect(stats.total).equal(numCpus)
    }
  })

  it("should gather CPU sytem time metric", function () {
    if (semver.satisfies(process.version, '>= 6.1.0')) {
      sampler.sampleCpu(agent)()

      var stats = agent.metrics.getOrCreateMetric('CPU/System Time')
      expect(stats.callCount).equal(1)
      expect(stats.total).equal(numCpus)
    }
  })

  it("should catch if process.cpuUsage throws an error", function () {  
    process.cpuUsage = function () {
      throw new Error('ohhhhhh boyyyyyy')
    }
    sampler.sampleCpu(agent)()

    var stats = agent.metrics.getOrCreateMetric('CPU/User/Utilization')
    expect(stats.callCount).equal(0)
  })

  it("should have a rough idea of how much memory Node is using", function () {
    sampler.sampleMemory(agent)()

    var stats = agent.metrics.getOrCreateMetric('Memory/Physical')
    expect(stats.callCount).equal(1)
    expect(stats.max).above(1); // maybe someday this test will fail
  })
  
  it("should catch if process.memoryUsage throws an error", function () {
    var oldProcessMem = process.memoryUsage
    process.memoryUsage = function () {
      throw new Error('your computer is on fire')
    }
    sampler.sampleMemory(agent)()

    var stats = agent.metrics.getOrCreateMetric('Memory/Physical')
    expect(stats.callCount).equal(0)
    process.memoryUsage = oldProcessMem
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
