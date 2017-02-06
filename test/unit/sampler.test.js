'use strict'

var chai         = require('chai')
var expect       = chai.expect
var configurator = require('../../lib/config.js')
var sampler      = require('../../lib/sampler')
var Agent        = require('../../lib/agent')
var semver       = require('semver')


var NAMES = require('../../lib/metrics/names')
var HAS_NATIVE_METRICS = false
try {
  require('@newrelic/native-metrics')
  HAS_NATIVE_METRICS = true
} catch (e) {}


describe("environmental sampler", function() {
  var agent
  var numCpus = require('os').cpus().length
  var oldCpuUsage = process.cpuUsage
  var oldUptime = process.uptime
  var it_v610 = semver.satisfies(process.version, '>= 6.1.0') ? it : xit
  var it_native = HAS_NATIVE_METRICS ? it : xit
  var it_v610_or_native = semver.satisfies(process.version, '>= 6.1.0') || HAS_NATIVE_METRICS ? it : xit

  beforeEach(function() {
    agent = new Agent(configurator.initialize())
    process.cpuUsage = function() {
      // process.cpuUsage return values in cpu microseconds (1^-6)
      return { user: 1e6 * numCpus, system: 1e6 * numCpus }
    }
    process.uptime = function() {
      // process.uptime returns values in seconds
      return 1
    }
  })

  afterEach(function() {
    sampler.stop()
    process.cpuUsage = oldCpuUsage
    process.uptime = oldUptime
  })

  it_native("should still gather native metrics when bound and unbound", function(done) {
    sampler.start(agent)
    sampler.stop()
    sampler.start(agent)

    sampler.nativeMetrics.emit('gc', {
      type: 'TestGC',
      typeId: 1337,
      duration: 50 * 1e9 // 50 seconds in nanoseconds
    })
    var pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
    var type = agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + 'TestGC')

    // These are "at least" because a real GC might happen during the test.
    expect(pause).property('callCount').to.be.at.least(1)
    expect(pause).property('total').to.be.at.least(50)

    // These tests can be exact because we're using a fake GC type.
    expect(type).to.have.property('callCount', 1)
    expect(type).to.have.property('total', 50)

    sampler.nativeMetrics.getLoopMetrics()
    setTimeout(function runLoop() {
      sampler.sampleLoop(agent, sampler.nativeMetrics)()

      var stats = agent.metrics.getOrCreateMetric(NAMES.LOOP.USAGE)
      expect(stats.callCount).to.be.above(1)
      expect(stats.max).to.be.above(0)
      expect(stats.min).to.be.at.most(stats.max)
      expect(stats.total).to.be.at.least(stats.max)
      done()
    }, 1)
  })

  it_native("should gather loop metrics", function(done) {
    sampler.start(agent)
    sampler.nativeMetrics.getLoopMetrics()
    setTimeout(function runLoop() {
      sampler.sampleLoop(agent, sampler.nativeMetrics)()

      var stats = agent.metrics.getOrCreateMetric(NAMES.LOOP.USAGE)
      expect(stats.callCount).to.be.above(1)
      expect(stats.max).to.be.above(0)
      expect(stats.min).to.be.at.most(stats.max)
      expect(stats.total).to.be.at.least(stats.max)
      done()
    }, 1)
  })

  it("should depend on Agent to provide the current metrics summary", function() {
    expect(function() { sampler.start(agent) }).to.not.throw()
    expect(function() { sampler.stop(agent) }).to.not.throw()
  })

  it("should default to a state of stopped", function() {
    expect(sampler.state).equal('stopped')
  })

  it("should say it's running after start", function() {
    sampler.start(agent)
    expect(sampler.state).equal('running')
  })

  it_v610_or_native("should gather CPU user utilization metric", function() {
    sampler.sampleCpu(agent)()

    var stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_UTILIZATION)
    expect(stats.callCount).equal(1)
    expect(stats.total).equal(1)
  })

  it_v610_or_native("should gather CPU system utilization metric", function() {
    sampler.sampleCpu(agent)()

    var stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_UTILIZATION)
    expect(stats.callCount).equal(1)
    expect(stats.total).equal(1)
  })

  it_v610_or_native("should gather CPU user time metric", function() {
    sampler.sampleCpu(agent)()

    var stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_TIME)
    expect(stats.callCount).equal(1)
    expect(stats.total).equal(numCpus)
  })

  it_v610_or_native("should gather CPU sytem time metric", function() {
    sampler.sampleCpu(agent)()

    var stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_TIME)
    expect(stats.callCount).equal(1)
    expect(stats.total).equal(numCpus)
  })

  it_native('should gather GC metrics', function() {
    sampler.start(agent)
    sampler.nativeMetrics.emit('gc', {
      type: 'TestGC',
      typeId: 1337,
      duration: 50 * 1e9 // 50 seconds in nanoseconds
    })
    var pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
    var type = agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + 'TestGC')

    // These are "at least" because a real GC might happen during the test.
    expect(pause).property('callCount').to.be.at.least(1)
    expect(pause).property('total').to.be.at.least(50)

    // These tests can be exact because we're using a fake GC type.
    expect(type).to.have.property('callCount', 1)
    expect(type).to.have.property('total', 50)
  })

  it_native('should not gather GC metrics if the feature flag is off', function() {
    agent.config.feature_flag.native_metrics = false
    sampler.start(agent)
    expect(sampler.nativeMetrics).to.be.null
  })

  if (!HAS_NATIVE_METRICS) {
    it('should create a supportability metric for missing native module', function() {
      sampler.start(agent)
      var sup = agent.metrics.getOrCreateMetric(
        NAMES.SUPPORTABILITY.DEPENDENCIES + '/NoNativeMetricsModule'
      )
      expect(sup).to.have.property('callCount', 1)
    })
  }

  it("should catch if process.cpuUsage throws an error", function() {
    process.cpuUsage = function() {
      throw new Error('ohhhhhh boyyyyyy')
    }
    sampler.sampleCpu(agent)()

    var stats = agent.metrics.getOrCreateMetric('CPU/User/Utilization')
    expect(stats.callCount).equal(0)
  })

  it("should collect all specified memory statistics", function () {
    sampler.sampleMemory(agent)()

    Object.keys(NAMES.MEMORY).forEach(function testStat(memoryStat) {
      var metricName = NAMES.MEMORY[memoryStat]
      var stats = agent.metrics.getOrCreateMetric(metricName)
      expect(stats.callCount).equal(1)
      expect(stats.max).above(1); // maybe someday this test will fail
    })
  })

  it("should catch if process.memoryUsage throws an error", function() {
    var oldProcessMem = process.memoryUsage
    process.memoryUsage = function() {
      throw new Error('your computer is on fire')
    }
    sampler.sampleMemory(agent)()

    var stats = agent.metrics.getOrCreateMetric('Memory/Physical')
    expect(stats.callCount).equal(0)
    process.memoryUsage = oldProcessMem
  })

  it("should have some rough idea of how deep the event queue is", function(done) {
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
    setTimeout(function() {
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
