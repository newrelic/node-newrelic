'use strict'

var chai = require('chai')
var should = chai.should()
var expect = chai.expect
var helper = require('../lib/agent_helper')
var TraceSegment = require('../../lib/transaction/trace/segment')
var Transaction = require('../../lib/transaction')


describe('TraceSegment', function() {
  it('should be bound to a Trace', function() {
    var segment = null
    var agent = helper.loadMockedAgent()
    var trans = new Transaction(agent)
    expect(function noTrace() {
      segment = new TraceSegment(null, 'UnitTest')
    }).to.throw()
    expect(segment).to.be.null()

    var success = new TraceSegment(trans, 'UnitTest')
    expect(success.transaction).equal(trans)
    trans.end()
    helper.unloadAgent(agent)
  })

  it('should call an optional callback function', function(done) {
    var agent = helper.loadMockedAgent()
    var trans = new Transaction(agent)
    expect(function noCallback() {
      new TraceSegment(trans, 'UnitTest') // eslint-disable-line no-new
    }).not.throws()

    var working = new TraceSegment(trans, 'UnitTest', callback)

    function callback() {
      helper.unloadAgent(agent)
      return done()
    }

    working.end()
    trans.end()
  })

  it('has a name', function () {
    var agent = helper.loadMockedAgent()
    var trans = new Transaction(agent)
    expect(function noName() {
      new TraceSegment(trans)
    }).throws()
    var success = new TraceSegment(trans, 'UnitTest')
    expect(success.name).equal('UnitTest')
    helper.unloadAgent(agent)
  })

  it('is created with no children', function () {
    var agent = helper.loadMockedAgent()
    var trans = new Transaction(agent)
    var segment = new TraceSegment(trans, 'UnitTest')
    expect(segment.children.length).equal(0)
    helper.unloadAgent(agent)
  })

  it('has a timer', function () {
    var agent = helper.loadMockedAgent()
    var trans = new Transaction(agent)
    var segment = new TraceSegment(trans, 'UnitTest')
    should.exist(segment.timer)
    helper.unloadAgent(agent)
  })

  it('does not start its timer on creation', function () {
    var agent = helper.loadMockedAgent()
    var trans = new Transaction(agent)
    var segment = new TraceSegment(trans, 'UnitTest')
    expect(segment.timer.isRunning()).equal(false)
    helper.unloadAgent(agent)
  })

  it('allows the timer to be updated without ending it', function () {
    var agent = helper.loadMockedAgent()
    var trans = new Transaction(agent)

    var segment = new TraceSegment(trans, 'UnitTest')
    segment.start()
    segment.touch()
    expect(segment.timer.isRunning()).equal(true)
    expect(segment.getDurationInMillis()).above(0)

    helper.unloadAgent(agent)
  })

  it('accepts a callback that records metrics associated with this segment',
     function (done) {

    var agent = helper.loadMockedAgent()
    var trans = new Transaction(agent)
    var trace = trans.trace
    var segment = new TraceSegment(trans, 'Test', function (insider) {
      expect(insider).equal(segment)
      helper.unloadAgent(agent)
      return done()
    })

    segment.end()
    trans.end()
  })

  it('updates root segment timer when end() is called', function(done) {
    var agent = helper.loadMockedAgent()
    var trans = new Transaction(agent)
    var trace = trans.trace
    var segment = new TraceSegment(trans, 'Test')

    segment.setDurationInMillis(10, 0)

    setTimeout(function() {
      expect(trace.root.timer.hrDuration).equal(null)
      segment.end()
      expect(trace.root.timer.getDurationInMillis())
        .to.be.above(segment.timer.getDurationInMillis() - 1) // alow for slop
      helper.unloadAgent(agent)
      done()
    }, 10)
  })

  it('properly tracks the number of segments that are active and harvested', function(done) {
    var agent = helper.loadMockedAgent()
    expect(agent.activeTransactions).to.equal(0)
    expect(agent.totalActiveSegments).to.equal(0)
    expect(agent.segmentsCreatedInHarvest).to.equal(0)

    var tx = new Transaction(agent)
    expect(agent.totalActiveSegments).to.equal(1)
    expect(agent.segmentsCreatedInHarvest).to.equal(1)
    expect(tx.numSegments).to.equal(1)
    expect(agent.activeTransactions).to.equal(1)

    var segment = new TraceSegment(tx, 'Test')
    expect(agent.totalActiveSegments).to.equal(2)
    expect(agent.segmentsCreatedInHarvest).to.equal(2)
    expect(tx.numSegments).to.equal(2)
    tx.end()

    setTimeout(function () {
      expect(agent.totalActiveSegments).to.equal(0)
      expect(agent.segmentsClearedInHarvest).to.equal(2)
      agent.harvest(function () {
        helper.unloadAgent(agent)
        agent.harvest(function () {
          expect(agent.totalActiveSegments).to.equal(0)
          expect(agent.segmentsClearedInHarvest).to.equal(0)
          expect(agent.segmentsCreatedInHarvest).to.equal(0)
          done()
        })
      })
    }, 10)
  })

  describe('with children created from URLs', function () {
    var webChild, agent

    before(function () {
      agent = helper.loadMockedAgent()
      agent.config.capture_params = true

      var transaction = new Transaction(agent)
      var trace = transaction.trace
      var segment = new TraceSegment(transaction, 'UnitTest')
      var url = '/test?test1=value1&test2&test3=50&test4='


      webChild = segment.add(url)
      transaction.finalizeNameFromUri(url, 200)
      webChild.markAsWeb(url)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should return the URL minus any query parameters', function () {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have parameters on the child segment', function () {
      should.exist(webChild.parameters)
    })

    it('should have the parameters that were passed in the query string', function () {
      expect(webChild.parameters.test1).equal('value1')
      expect(webChild.parameters.test3).equal('50')
    })

    it('should set bare parameters to true (as in present)', function () {
      expect(webChild.parameters.test2).equal(true)
    })

    it('should set parameters with empty values to ""', function () {
      expect(webChild.parameters.test4).equal('')
    })

    it('should serialize the segment with the parameters', function () {
      var expected = [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {
          nr_exclusive_duration_millis : 1,
          test1 : 'value1',
          test2 : true,
          test3 : '50',
          test4 : ''
        },
        []
      ]
      expect(webChild.toJSON()).deep.equal(expected)
    })
  })

  describe('with parameters parsed out by framework', function () {
    var webChild, agent, trace

    before(function () {
      agent = helper.loadMockedAgent()
      agent.config.capture_params = true

      var transaction = new Transaction(agent)
      trace = transaction.trace
      trace.mer = 6

      var segment = new TraceSegment(transaction, 'UnitTest')
      var url = '/test'
      var params = {}

      // Express uses positional parameters sometimes
      params[0] = 'first'
      params[1] = 'another'
      params.test3 = '50'

      webChild = segment.add(url)
      webChild.parameters = params
      transaction.finalizeNameFromUri(url, 200)
      webChild.markAsWeb(url)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should return the URL minus any query parameters', function () {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have parameters on the trace', function () {
      should.exist(trace.parameters)
    })

    it('should have the positional parameters from the params array', function () {
      expect(trace.parameters[0]).equal('first')
      expect(trace.parameters[1]).equal('another')
    })

    it('should have the named parameter from the params array', function () {
      expect(trace.parameters.test3).equal('50')
    })

    it('should serialize the segment with the parameters', function () {
      var expected = [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {
          nr_exclusive_duration_millis : 1,
          0     : 'first',
          1     : 'another',
          test3 : '50',
        },
        []
      ]
      expect(webChild.toJSON()).deep.equal(expected)
    })
  })

  describe('with capture_params disabled', function () {
    var webChild, agent

    before(function () {
      agent = helper.loadMockedAgent()
      agent.config.capture_params = false

      var transaction = new Transaction(agent)
      var trace = transaction.trace
      var segment = new TraceSegment(transaction, 'UnitTest')
      var url = '/test?test1=value1&test2&test3=50&test4='


      webChild = segment.add(url)
      transaction.finalizeNameFromUri(url, 200)
      webChild.markAsWeb(url)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should return the URL minus any query parameters', function () {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have parameters on the child segment', function () {
      expect(webChild.parameters).eql({nr_exclusive_duration_millis : null})
    })

    it('should serialize the segment without the parameters', function () {
      var expected = [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {nr_exclusive_duration_millis : 1},
        []
      ]
      expect(webChild.toJSON()).deep.equal(expected)
    })
  })

  describe('with capture_params enabled and ignored_params set', function () {
    var webChild, agent

    before(function () {
      agent = helper.loadMockedAgent()
      agent.config.capture_params = true
      agent.config.ignored_params = ['test1', 'test4']

      var transaction = new Transaction(agent)
      var trace = transaction.trace
      var segment = new TraceSegment(transaction, 'UnitTest')
      var url = '/test?test1=value1&test2&test3=50&test4='


      webChild = segment.add(url)
      transaction.finalizeNameFromUri(url, 200)
      webChild.markAsWeb(url)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should return the URL minus any query parameters', function () {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have parameters on the child segment', function () {
      should.exist(webChild.parameters)
    })

    it('should have filtered the parameters that were passed in the query string',
       function () {
      should.not.exist(webChild.parameters.test1)
      expect(webChild.parameters.test3).equal('50')
    })

    it('should set bare parameters to true (as in present)', function () {
      expect(webChild.parameters.test2).equal(true)
    })

    it('should not have filtered parameter', function () {
      should.not.exist(webChild.parameters.test4)
    })

    it('should serialize the segment with the parameters', function () {
      var expected = [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {
          nr_exclusive_duration_millis : 1,
          test2 : true,
          test3 : '50'
        },
        []
      ]
      expect(webChild.toJSON()).deep.equal(expected)
    })
  })

  it('should retain any associated SQL statements')
  it('should allow an arbitrary number of segments in the scope of this segment')

  describe('when ended', function () {
    it('stops its timer', function () {
      var agent = helper.loadMockedAgent()
      var trans = new Transaction(agent)

      var segment = new TraceSegment(trans, 'UnitTest')
      segment.end()
      expect(segment.timer.isRunning()).equal(false)

      helper.unloadAgent(agent)
    })

    it('knows its exclusive duration')
    it('produces human-readable JSON')

    it('should produce JSON that conforms to the collector spec', function () {
      var agent = helper.loadMockedAgent()
      var transaction = new Transaction(agent)
      var trace = transaction.trace
      var segment = new TraceSegment(transaction, 'DB/select/getSome')

      trace.setDurationInMillis(17, 0)
      segment.setDurationInMillis(14, 3)
      // See documentation on TraceSegment.toJSON for what goes in which field.
      expect(segment.toJSON()).deep.equal([
        3,
        17,
        'DB/select/getSome',
       {nr_exclusive_duration_millis : 14},
       []
      ])
      helper.unloadAgent(agent)
    })
  })

  describe('when serialized', function() {
    var agent = null
    var trans = null
    var segment = null

    beforeEach(function() {
      agent = helper.loadMockedAgent()
      trans = new Transaction(agent)
      segment = new TraceSegment(trans, 'UnitTest')
    })

    afterEach(function() {
      helper.unloadAgent(agent)
      agent = null
      trans = null
      segment = null
    })

    it('should create a plain JS array', function() {
      segment.end()
      var js = segment.toJSON()

      expect(js).to.be.an.instanceOf(Array)
      expect(js[0]).to.be.a('number')
      expect(js[1]).to.be.a('number')
      expect(js[2]).to.be.a('string').and.equal('UnitTest')
      expect(js[3]).to.be.an('object')
      expect(js[4]).to.be.an.instanceOf(Array).and.have.lengthOf(0)
    })

    it('should not cause a stack overflow', function() {
      this.timeout(30000)
      var parent = segment
      for (var i = 0; i < 9000; ++i) {
        var child = new TraceSegment(trans, 'Child ' + i)
        parent.children.push(child)
        parent = child
      }

      expect(function() {
        segment.toJSON()
      }).to.not.throw()
    })
  })
})
