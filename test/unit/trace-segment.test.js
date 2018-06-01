'use strict'

var chai = require('chai')
var DESTINATIONS = require('../../lib/config/attribute-filter').DESTINATIONS
var should = chai.should()
var expect = chai.expect
var helper = require('../lib/agent_helper')
var TraceSegment = require('../../lib/transaction/trace/segment')
var Transaction = require('../../lib/transaction')


describe('TraceSegment', function() {
  var agent = null

  beforeEach(function() {
    agent = helper.loadMockedAgent()
  })

  afterEach(function() {
    helper.unloadAgent(agent)
    agent = null
  })

  it('should be bound to a Trace', function() {
    var segment = null
    var trans = new Transaction(agent)
    expect(function noTrace() {
      segment = new TraceSegment(null, 'UnitTest')
    }).to.throw()
    expect(segment).to.be.null

    var success = new TraceSegment(trans, 'UnitTest')
    expect(success.transaction).equal(trans)
    trans.end()
  })

  it('should not add new children when marked as opaque', function() {
    var trans = new Transaction(agent)
    var segment = new TraceSegment(trans, 'UnitTest')
    expect(segment.opaque).to.be.false
    segment.opaque = true
    segment.add('child')
    expect(segment.children.length).to.equal(0)
    segment.opaque = false
    segment.add('child')
    expect(segment.children.length).to.equal(1)
    trans.end()
  })

  it('should call an optional callback function', function(done) {
    var trans = new Transaction(agent)
    expect(function noCallback() {
      new TraceSegment(trans, 'UnitTest') // eslint-disable-line no-new
    }).not.throws()

    var working = new TraceSegment(trans, 'UnitTest', callback)

    function callback() {
      return done()
    }

    working.end()
    trans.end()
  })

  it('has a name', function() {
    var trans = new Transaction(agent)

    var success = new TraceSegment(trans, 'UnitTest')
    expect(success.name).equal('UnitTest')
  })

  it('is created with no children', function() {
    var trans = new Transaction(agent)
    var segment = new TraceSegment(trans, 'UnitTest')
    expect(segment.children.length).equal(0)
  })

  it('has a timer', function() {
    var trans = new Transaction(agent)
    var segment = new TraceSegment(trans, 'UnitTest')
    should.exist(segment.timer)
  })

  it('does not start its timer on creation', function() {
    var trans = new Transaction(agent)
    var segment = new TraceSegment(trans, 'UnitTest')
    expect(segment.timer.isRunning()).equal(false)
  })

  it('allows the timer to be updated without ending it', function() {
    var trans = new Transaction(agent)

    var segment = new TraceSegment(trans, 'UnitTest')
    segment.start()
    segment.touch()
    expect(segment.timer.isRunning()).equal(true)
    expect(segment.getDurationInMillis()).above(0)
  })

  it('accepts a callback that records metrics for this segment', function(done) {
    var trans = new Transaction(agent)
    var segment = new TraceSegment(trans, 'Test', function(insider) {
      expect(insider).equal(segment)
      return done()
    })

    segment.end()
    trans.end()
  })

  it('updates root segment timer when end() is called', function(done) {
    var trans = new Transaction(agent)
    var trace = trans.trace
    var segment = new TraceSegment(trans, 'Test')

    segment.setDurationInMillis(10, 0)

    setTimeout(function() {
      expect(trace.root.timer.hrDuration).equal(null)
      segment.end()
      expect(trace.root.timer.getDurationInMillis())
        .to.be.above(segment.timer.getDurationInMillis() - 1) // alow for slop
      done()
    }, 10)
  })

  it('properly tracks the number of active or harvested segments', function(done) {
    expect(agent.activeTransactions).to.equal(0)
    expect(agent.totalActiveSegments).to.equal(0)
    expect(agent.segmentsCreatedInHarvest).to.equal(0)

    var tx = new Transaction(agent)
    expect(agent.totalActiveSegments).to.equal(1)
    expect(agent.segmentsCreatedInHarvest).to.equal(1)
    expect(tx.numSegments).to.equal(1)
    expect(agent.activeTransactions).to.equal(1)

    var segment = new TraceSegment(tx, 'Test') // eslint-disable-line no-unused-vars
    expect(agent.totalActiveSegments).to.equal(2)
    expect(agent.segmentsCreatedInHarvest).to.equal(2)
    expect(tx.numSegments).to.equal(2)
    tx.end()

    setTimeout(function() {
      expect(agent.totalActiveSegments).to.equal(0)
      expect(agent.segmentsClearedInHarvest).to.equal(2)
      agent.harvest(function() {
        agent.harvest(function() {
          expect(agent.totalActiveSegments).to.equal(0)
          expect(agent.segmentsClearedInHarvest).to.equal(0)
          expect(agent.segmentsCreatedInHarvest).to.equal(0)
          done()
        })
      })
    }, 10)
  })

  describe('with children created from URLs', function() {
    var webChild

    beforeEach(function() {
      agent.config.attributes.enabled = true
      agent.config.attributes.include.push('request.parameters.*')
      agent.config.emit('attributes.include')

      var transaction = new Transaction(agent)
      var trace = transaction.trace
      var segment = new TraceSegment(transaction, 'UnitTest')
      var url = '/test?test1=value1&test2&test3=50&test4='

      webChild = segment.add(url)
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
    })

    it('should return the URL minus any query parameters', function() {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have parameters on the child segment', function() {
      should.exist(webChild.parameters)
    })

    it('should have the parameters that were passed in the query string', function() {
      expect(webChild.parameters).to.have.property('request.parameters.test1', 'value1')
      expect(webChild.parameters).to.have.property('request.parameters.test3', '50')
    })

    it('should set bare parameters to true (as in present)', function() {
      expect(webChild.parameters).to.have.property('request.parameters.test2', true)
    })

    it('should set parameters with empty values to ""', function() {
      expect(webChild.parameters).to.have.property('request.parameters.test4', '')
    })

    it('should serialize the segment with the parameters', function() {
      expect(webChild.toJSON()).to.deep.equal([
        0,
        1,
        'WebTransaction/NormalizedUri/*', {
          'nr_exclusive_duration_millis': 1,
          'request.parameters.test1': 'value1',
          'request.parameters.test2': true,
          'request.parameters.test3': '50',
          'request.parameters.test4': ''
        },
        []
      ])
    })
  })

  describe('with parameters parsed out by framework', function() {
    var webChild, trace

    beforeEach(function() {
      agent.config.attributes.enabled = true

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
      transaction.trace.addAttributes(DESTINATIONS.ALL, params)
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
    })

    it('should return the URL minus any query parameters', function() {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have attributes on the trace', function() {
      expect(trace.attributes.get(DESTINATIONS.TRANS_TRACE)).to.exist
    })

    it('should have the positional parameters from the params array', function() {
      var attributes = trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      expect(attributes[0]).equal('first')
      expect(attributes[1]).equal('another')
    })

    it('should have the named parameter from the params array', function() {
      expect(trace.attributes.get(DESTINATIONS.TRANS_TRACE))
        .to.have.property('test3', '50')
    })

    it('should serialize the segment with the parameters', function() {
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

  describe('with attributes.enabled set to false', function() {
    var webChild

    beforeEach(function() {
      agent.config.attributes.enabled = false

      var transaction = new Transaction(agent)
      var trace = transaction.trace
      var segment = new TraceSegment(transaction, 'UnitTest')
      var url = '/test?test1=value1&test2&test3=50&test4='


      webChild = segment.add(url)
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
    })

    it('should return the URL minus any query parameters', function() {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have parameters on the child segment', function() {
      expect(webChild.parameters).eql({nr_exclusive_duration_millis : null})
    })

    it('should serialize the segment without the parameters', function() {
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

  describe('with attributes.enabled set', function() {
    var webChild

    beforeEach(function() {
      agent.config.attributes.enabled = true
      agent.config.attributes.include = ['request.parameters.*']
      agent.config.attributes.exclude = [
        'request.parameters.test1',
        'request.parameters.test4'
      ]
      agent.config.emit('attributes.exclude')

      var transaction = new Transaction(agent)
      var trace = transaction.trace
      var segment = new TraceSegment(transaction, 'UnitTest')
      var url = '/test?test1=value1&test2&test3=50&test4='


      webChild = segment.add(url)
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)
      webChild.markAsWeb(url)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
    })

    it('should return the URL minus any query parameters', function() {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have parameters on the child segment', function() {
      should.exist(webChild.parameters)
    })

    it('should filter the parameters that were passed in the query string', function() {
      expect(webChild.parameters).to.not.have.property('test1')
      expect(webChild.parameters).to.not.have.property('request.parameters.test1')

      expect(webChild.parameters).to.not.have.property('test3')
      expect(webChild.parameters).to.have.property('request.parameters.test3', '50')

      expect(webChild.parameters).to.not.have.property('test4')
      expect(webChild.parameters).to.not.have.property('request.parameters.test4')
    })

    it('should set bare parameters to true (as in present)', function() {
      expect(webChild.parameters).to.not.have.property('test2')
      expect(webChild.parameters).to.have.property('request.parameters.test2', true)
    })

    it('should serialize the segment with the parameters', function() {
      expect(webChild.toJSON()).deep.equal([
        0,
        1,
        'WebTransaction/NormalizedUri/*', {
          'nr_exclusive_duration_millis': 1,
          'request.parameters.test2': true,
          'request.parameters.test3': '50'
        },
        []
      ])
    })
  })

  describe('when ended', function() {
    it('stops its timer', function() {
      var trans = new Transaction(agent)

      var segment = new TraceSegment(trans, 'UnitTest')
      segment.end()
      expect(segment.timer.isRunning()).equal(false)
    })

    it('should produce JSON that conforms to the collector spec', function() {
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
    })
  })

  describe('when serialized', function() {
    var trans = null
    var segment = null

    beforeEach(function() {
      trans = new Transaction(agent)
      segment = new TraceSegment(trans, 'UnitTest')
    })

    afterEach(function() {
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
