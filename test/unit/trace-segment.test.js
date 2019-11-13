'use strict'

const chai = require('chai')
const DESTINATIONS = require('../../lib/config/attribute-filter').DESTINATIONS
const should = chai.should()
const expect = chai.expect
const sinon = require('sinon')
const helper = require('../lib/agent_helper')
const TraceSegment = require('../../lib/transaction/trace/segment')
const Transaction = require('../../lib/transaction')

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

  describe('#getSpanId', function() {
    it('should return the segment id when dt and spans are enabled', function() {
      const trans = new Transaction(agent)
      const segment = new TraceSegment(trans, 'Test')
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true
      expect(segment.getSpanId()).to.equal(segment.id)
    })

    it('should return null when dt is disabled', function() {
      const trans = new Transaction(agent)
      const segment = new TraceSegment(trans, 'Test')
      agent.config.distributed_tracing.enabled = false
      agent.config.span_events.enabled = true
      expect(segment.getSpanId()).to.be.null
    })

    it('should return null when spans are disabled', function() {
      const trans = new Transaction(agent)
      const segment = new TraceSegment(trans, 'Test')
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false
      expect(segment.getSpanId()).to.be.null
    })
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

    const tx = new Transaction(agent)
    expect(agent.totalActiveSegments).to.equal(1)
    expect(agent.segmentsCreatedInHarvest).to.equal(1)
    expect(tx.numSegments).to.equal(1)
    expect(agent.activeTransactions).to.equal(1)

    const segment = new TraceSegment(tx, 'Test') // eslint-disable-line no-unused-vars
    expect(agent.totalActiveSegments).to.equal(2)
    expect(agent.segmentsCreatedInHarvest).to.equal(2)
    expect(tx.numSegments).to.equal(2)
    tx.end()

    expect(agent.activeTransactions).to.equal(0)

    setTimeout(function() {
      expect(agent.totalActiveSegments).to.equal(0)
      expect(agent.segmentsClearedInHarvest).to.equal(2)

      agent.forceHarvestAll(() => {
        expect(agent.totalActiveSegments).to.equal(0)
        expect(agent.segmentsClearedInHarvest).to.equal(0)
        expect(agent.segmentsCreatedInHarvest).to.equal(0)
        done()
      })
    }, 10)
  })

  it('toJSON should not modify attributes', () => {
    const transaction = new Transaction(agent)
    const segment = new TraceSegment(transaction, 'TestSegment')

    segment.toJSON()

    expect(segment.getAttributes()).to.eql({})
  })

  describe('with children created from URLs', function() {
    var webChild

    beforeEach(function() {
      agent.config.attributes.enabled = true
      agent.config.attributes.include.push('request.parameters.*')
      agent.config.emit('attributes.include')

      var transaction = new Transaction(agent)
      var trace = transaction.trace
      const segment = trace.add('UnitTest')

      var url = '/test?test1=value1&test2&test3=50&test4='

      webChild = segment.add(url)
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)

      trace.end()
    })

    it('should return the URL minus any query parameters', function() {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have attributes on the child segment', function() {
      should.exist(webChild.getAttributes())
    })

    it('should have the parameters that were passed in the query string', function() {
      const attributes = webChild.getAttributes()
      expect(attributes).to.have.property('request.parameters.test1', 'value1')
      expect(attributes).to.have.property('request.parameters.test3', '50')
    })

    it('should set bare parameters to true (as in present)', function() {
      expect(webChild.getAttributes()).to.have.property('request.parameters.test2', true)
    })

    it('should set parameters with empty values to ""', function() {
      expect(webChild.getAttributes()).to.have.property('request.parameters.test4', '')
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

      const segment = trace.add('UnitTest')

      var url = '/test'
      var params = {}

      // Express uses positional parameters sometimes
      params[0] = 'first'
      params[1] = 'another'
      params.test3 = '50'

      webChild = segment.add(url)
      transaction.trace.attributes.addAttributes(
        DESTINATIONS.TRANS_SCOPE,
        params
      )
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)

      trace.end()
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
      webChild.addAttribute('test', 'non-null value')
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
    })

    it('should return the URL minus any query parameters', function() {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have no attributes on the child segment', function() {
      expect(webChild.getAttributes()).eql({})
    })

    it('should serialize the segment without the parameters', function() {
      var expected = [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {},
        []
      ]
      expect(webChild.toJSON()).deep.equal(expected)
    })
  })

  describe('with attributes.enabled set', function() {
    var webChild
    let attributes = null

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
      const segment = trace.add('UnitTest')

      var url = '/test?test1=value1&test2&test3=50&test4='

      webChild = segment.add(url)
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)
      webChild.markAsWeb(url)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
      attributes = webChild.getAttributes()

      trace.end()
    })

    it('should return the URL minus any query parameters', function() {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*')
    })

    it('should have attributes on the child segment', function() {
      should.exist(attributes)
    })

    it('should filter the parameters that were passed in the query string', function() {
      expect(attributes).to.not.have.property('test1')
      expect(attributes).to.not.have.property('request.parameters.test1')

      expect(attributes).to.not.have.property('test3')
      expect(attributes).to.have.property('request.parameters.test3', '50')

      expect(attributes).to.not.have.property('test4')
      expect(attributes).to.not.have.property('request.parameters.test4')
    })

    it('should set bare parameters to true (as in present)', function() {
      expect(attributes).to.not.have.property('test2')
      expect(attributes).to.have.property('request.parameters.test2', true)
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
      const transaction = new Transaction(agent)
      const trace = transaction.trace
      const segment = trace.add('DB/select/getSome')

      trace.setDurationInMillis(17, 0)
      segment.setDurationInMillis(14, 3)

      trace.end()

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

  describe('#finalize', () => {
    it('should add nr_exclusive_duration_millis attribute', () => {
      const transaction = new Transaction(agent)
      const segment = new TraceSegment(transaction, 'TestSegment')

      segment._setExclusiveDurationInMillis(1)

      expect(segment.getAttributes()).to.eql({})

      segment.finalize()

      expect(segment.getAttributes()).to.have.property('nr_exclusive_duration_millis', 1)
    })

    it('should truncate when timer still running', () => {
      const segmentName = 'TestSegment'

      const transaction = new Transaction(agent)
      const segment = new TraceSegment(transaction, segmentName)

      // Force truncation
      sinon.stub(segment.timer, 'softEnd').returns(true)
      sinon.stub(segment.timer, 'endsAfter').returns(true)

      const root = transaction.trace.root

      // Make root duration calculation predictable
      root.timer.start  = 1000
      segment.timer.start = 1001
      segment.overwriteDurationInMillis(3)

      segment.finalize()

      expect(segment.name).to.equal(`Truncated/${segmentName}`)
      expect(root.getDurationInMillis()).to.equal(4)
    })
  })
})
