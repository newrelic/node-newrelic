'use strict'

var chai = require('chai')
var DESTINATIONS = require('../../lib/config/attribute-filter').DESTINATIONS
var expect = chai.expect
var helper = require('../lib/agent_helper')
var codec = require('../../lib/util/codec')
var Segment = require('../../lib/transaction/trace/segment')
var Trace = require('../../lib/transaction/trace')
var Transaction = require('../../lib/transaction')


describe('Trace', function() {
  var agent = null

  beforeEach(function() {
    agent = helper.loadMockedAgent()
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  it('should always be bound to a transaction', function() {
    // fail
    expect(function() {
      return new Trace()
    }).throws(/must be associated with a transaction/)

    // succeed
    var transaction = new Transaction(agent)
    var tt = new Trace(transaction)
    expect(tt.transaction).to.be.an.instanceof(Transaction)
  })

  it('should have the root of a Segment tree', function() {
    var tt = new Trace(new Transaction(agent))
    expect(tt.root).to.be.an.instanceof(Segment)
  })

  it('should be the primary interface for adding segments to a trace', function() {
    var transaction = new Transaction(agent)
    var trace = transaction.trace

    expect(function() { trace.add('Custom/Test17/Child1') }).to.not.throw()
  })

  it('should produce a transaction trace in the expected format', function(done) {
    makeTrace(agent, function(err, details) {
      if (err) {
        return done(err)
      }
      details.trace.generateJSON(function(err, traceJSON) {
        if (err) {
          return done(err)
        }

        codec.decode(traceJSON[4], function(derr, reconstituted) {
          if (derr) {
            return done(derr)
          }

          expect(traceJSON, 'full trace JSON')
            .to.deep.equal(details.expectedEncoding)

          expect(reconstituted, 'reconstituted trace segments')
            .to.deep.equal(details.rootNode)

          return done()
        })
      })
    })
  })

  it('should generate span events on end', function() {
    agent.config.span_events.enabled = true
    agent.config.feature_flag.distributed_tracing = true

    var transaction = new Transaction(agent)
    var parentId = transaction.parentId = 'testParentId'

    var trace = transaction.trace
    var child1 = trace.add('test')
    child1.start()
    var child2 = child1.add('nested')
    child2.start()
    child1.end()
    child2.end()
    trace.root.end()
    trace.end()

    var events = agent.spans.getEvents()
    var nested = events[0]
    var root = events[1]
    var testSpan = events[2]

    expect(nested.parentId).to.equal(testSpan.guid)
    expect(nested.grandparentId).to.equal(root.guid)
    expect(nested.category).to.equal('generic')
    expect(nested.priority).to.equal(transaction.priority)
    expect(nested.appLocalRootId).to.equal(transaction.id)
    expect(nested.sampled).to.equal(transaction.sampled)
    expect(nested.name).to.equal('nested')
    expect(nested.traceId).to.equal(transaction.id)
    expect(nested.timestamp).to.equal(child1.timer.start)

    expect(testSpan.parentId).to.equal(root.guid)
    expect(testSpan.grandparentId).to.equal(transaction.id)
    expect(testSpan.category).to.equal('generic')
    expect(testSpan.priority).to.equal(transaction.priority)
    expect(testSpan.appLocalRootId).to.equal(transaction.id)
    expect(testSpan.sampled).to.equal(transaction.sampled)
    expect(testSpan.name).to.equal('test')
    expect(testSpan.traceId).to.equal(transaction.id)
    expect(testSpan.timestamp).to.equal(child2.timer.start)

    expect(root.parentId).to.equal(transaction.id)
    expect(root.grandparentId).to.equal(parentId)
    expect(root.category).to.equal('generic')
    expect(root.priority).to.equal(transaction.priority)
    expect(root.appLocalRootId).to.equal(transaction.id)
    expect(root.sampled).to.equal(transaction.sampled)
    expect(root.name).to.equal('ROOT')
    expect(root.traceId).to.equal(transaction.id)
    expect(root.timestamp).to.equal(transaction.trace.root.timer.start)
  })

  it('should not generate span events on end if span_events is disabled', function() {
    agent.config.span_events.enabled = false
    agent.config.feature_flag.distributed_tracing = true

    var transaction = new Transaction(agent)
    var parentId = transaction.parentId = 'testParentId'

    var trace = transaction.trace
    var child1 = trace.add('test')
    child1.start()
    var child2 = child1.add('nested')
    child2.start()
    child1.end()
    child2.end()
    trace.root.end()
    trace.end()

    var events = agent.spans.getEvents()
    expect(events.length).to.equal(0)
  })

  it('should not generate span events on end if distributed_tracing is off', function() {
    agent.config.span_events.enabled = true
    agent.config.feature_flag.distributed_tracing = false

    var transaction = new Transaction(agent)
    var parentId = transaction.parentId = 'testParentId'

    var trace = transaction.trace
    var child1 = trace.add('test')
    child1.start()
    var child2 = child1.add('nested')
    child2.start()
    child1.end()
    child2.end()
    trace.root.end()
    trace.end()

    var events = agent.spans.getEvents()
    expect(events.length).to.equal(0)
  })

  it('should send host display name when set by user', function() {
    agent.config.attributes.enabled = true
    agent.config.process_host.display_name = 'test-value'

    var trace = new Trace(new Transaction(agent))

    expect(trace.attributes.get(DESTINATIONS.TRANS_TRACE))
      .deep.equal({'host.displayName': 'test-value'})
  })

  it('should not send host display name when not set by user', function() {
    var trace = new Trace(new Transaction(agent))

    expect(trace.attributes.get(DESTINATIONS.TRANS_TRACE)).deep.equal({})
  })

  describe('when inserting segments', function() {
    var trace = null
    var transaction = null

    beforeEach(function() {
      transaction = new Transaction(agent)
      trace = transaction.trace
    })

    it('should allow child segments on a trace', function() {
      expect(function() { trace.add('Custom/Test17/Child1') }).not.throws()
    })

    it('should return the segment', function() {
      var segment
      expect(function() { segment = trace.add('Custom/Test18/Child1') }).not.throws()
      expect(segment).instanceof(Segment)
    })

    it('should call a function associated with the segment', function(done) {
      var segment = trace.add('Custom/Test18/Child1', function() {
        return done()
      })

      segment.end()
      transaction.end()
    })

    it('should report total time', function() {
      trace.setDurationInMillis(40, 0)
      var child = trace.add('Custom/Test18/Child1')
      child.setDurationInMillis(27, 0)
      var seg = child.add('UnitTest')
      seg.setDurationInMillis(9, 1)
      var seg = child.add('UnitTest1')
      seg.setDurationInMillis(13, 1)
      var seg = child.add('UnitTest2')
      seg.setDurationInMillis(9, 16)
      var seg = child.add('UnitTest2')
      seg.setDurationInMillis(14, 16)
      expect(trace.getTotalTimeDurationInMillis()).equal(48)
    })

    it('should report total time on branched traces', function() {
      trace.setDurationInMillis(40, 0)
      var child = trace.add('Custom/Test18/Child1')
      child.setDurationInMillis(27, 0)
      var seg1 = child.add('UnitTest')
      seg1.setDurationInMillis(9, 1)
      var seg = child.add('UnitTest1')
      seg.setDurationInMillis(13, 1)
      seg = seg1.add('UnitTest2')
      seg.setDurationInMillis(9, 16)
      seg = seg1.add('UnitTest2')
      seg.setDurationInMillis(14, 16)
      expect(trace.getTotalTimeDurationInMillis()).equal(48)
    })

    it('should report the expected trees for trees with uncollected segments',
        function() {
      var expectedTrace = [
        0,
        27,
        "Root",
        {
          "nr_exclusive_duration_millis": 3
        },
        [
          [
            1,
            10,
            "first",
            {
              "nr_exclusive_duration_millis": 9
            },
            [
              [
                16,
                25,
                "first-first",
                {
                  "nr_exclusive_duration_millis": 9
                },
                []
              ]
            ]
          ],
          [
            1,
            14,
            "second",
            {
              "nr_exclusive_duration_millis": 13
            },
            [
              [
                16,
                25,
                "second-first",
                {
                  "nr_exclusive_duration_millis": 9
                },
                []
              ],
              [
                16,
                25,
                "second-second",
                {
                  "nr_exclusive_duration_millis": 9
                },
                []
              ]
            ]
          ]
        ]
      ]
      trace.setDurationInMillis(40, 0)
      var child = trace.add('Root')
      child.setDurationInMillis(27, 0)
      var seg1 = child.add('first')
      seg1.setDurationInMillis(9, 1)
      var seg2 = child.add('second')
      seg2.setDurationInMillis(13, 1)
      var seg = seg1.add('first-first')
      seg.setDurationInMillis(9, 16)
      seg = seg1.add('first-second')
      seg.setDurationInMillis(14, 16)
      seg._collect = false
      seg = seg2.add('second-first')
      seg.setDurationInMillis(9, 16)
      seg = seg2.add('second-second')
      seg.setDurationInMillis(9, 16)
      expect(child.toJSON()).deep.equal(expectedTrace)
    })

    it('should report the expected trees for branched trees', function() {
      var expectedTrace = [
        0,
        27,
        "Root",
        {
          "nr_exclusive_duration_millis": 3
        },
        [
          [
            1,
            10,
            "first",
            {
              "nr_exclusive_duration_millis": 9
            },
            [
              [
                16,
                25,
                "first-first",
                {
                  "nr_exclusive_duration_millis": 9
                },
                []
              ],
              [
                16,
                30,
                "first-second",
                {
                  "nr_exclusive_duration_millis": 14
                },
                []
              ]
            ]
          ],
          [
            1,
            14,
            "second",
            {
              "nr_exclusive_duration_millis": 13
            },
            [
              [
                16,
                25,
                "second-first",
                {
                  "nr_exclusive_duration_millis": 9
                },
                []
              ],
              [
                16,
                25,
                "second-second",
                {
                  "nr_exclusive_duration_millis": 9
                },
                []
              ]
            ]
          ]
        ]
      ]
      trace.setDurationInMillis(40, 0)
      var child = trace.add('Root')
      child.setDurationInMillis(27, 0)
      var seg1 = child.add('first')
      seg1.setDurationInMillis(9, 1)
      var seg2 = child.add('second')
      seg2.setDurationInMillis(13, 1)
      var seg = seg1.add('first-first')
      seg.setDurationInMillis(9, 16)
      seg = seg1.add('first-second')
      seg.setDurationInMillis(14, 16)
      seg = seg2.add('second-first')
      seg.setDurationInMillis(9, 16)
      seg = seg2.add('second-second')
      seg.setDurationInMillis(9, 16)
      expect(child.toJSON()).deep.equal(expectedTrace)
    })

    it('should measure exclusive time vs total time at each level of the graph',
       function() {
      var child = trace.add('Custom/Test18/Child1')

      trace.setDurationInMillis(42)
      child.setDurationInMillis(22, 0)

      expect(trace.getExclusiveDurationInMillis()).equal(20)
    })

    it('should accurately sum overlapping segments', function() {
      trace.setDurationInMillis(42)

      var now = Date.now()

      var child1 = trace.add('Custom/Test19/Child1')
      child1.setDurationInMillis(22, now)

      // add another child trace completely encompassed by the first
      var child2 = trace.add('Custom/Test19/Child2')
      child2.setDurationInMillis(5, now + 5)

      // add another that starts within the first range but that extends beyond
      var child3 = trace.add('Custom/Test19/Child3')
      child3.setDurationInMillis(22, now + 11)

      // add a final child that's entirely disjoint
      var child4 = trace.add('Custom/Test19/Child4')
      child4.setDurationInMillis(4, now + 35)

      expect(trace.getExclusiveDurationInMillis()).equal(5)
    })

    it('should accurately sum partially overlapping segments', function() {
      trace.setDurationInMillis(42)

      var now = Date.now()

      var child1 = trace.add('Custom/Test20/Child1')
      child1.setDurationInMillis(22, now)

      // add another child trace completely encompassed by the first
      var child2 = trace.add('Custom/Test20/Child2')
      child2.setDurationInMillis(5, now + 5)

      /* add another that starts simultaneously with the first range but
       * that extends beyond
       */
      var child3 = trace.add('Custom/Test20/Child3')
      child3.setDurationInMillis(33, now)

      expect(trace.getExclusiveDurationInMillis()).equal(9)
    })

    it('should accurately sum partially overlapping, open-ranged segments', function() {
      trace.setDurationInMillis(42)

      var now = Date.now()

      var child1 = trace.add('Custom/Test21/Child1')
      child1.setDurationInMillis(22, now)

      // add a range that starts at the exact end of the first
      var child2 = trace.add('Custom/Test21/Child2')
      child2.setDurationInMillis(11, now + 22)

      expect(trace.getExclusiveDurationInMillis()).equal(9)
    })

    it('should be limited to 900 children', function() {
      // They will be tagged as _collect = false after the limit runs out.
      for (var i = 0; i < 950; ++i) {
        var segment = trace.add(i.toString(), noop)
        if (i < 900) {
          expect(segment._collect).equal(true)
        } else {
          expect(segment._collect).equal(false)
        }
      }

      expect(trace.root.children.length).equal(950)
      expect(transaction._recorders.length).equal(950)
      trace.segmentCount = 0
      trace.root.children = []
      trace.recorders = []

      function noop() {}
    })
  })

  describe('#addAttribute', function() {
    var trace = null

    beforeEach(function() {
      agent.config.attributes.enabled = true
      trace = new Transaction(agent).trace
    })

    it('does not add attribute if key length limit is exceeded', function() {
      var tooLong = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Cras id lacinia erat. Suspendisse mi nisl, sodales vel est eu,',
        'rhoncus lacinia ante. Nulla tincidunt efficitur diam, eget vulputate',
        'lectus facilisis sit amet. Morbi hendrerit commodo quam, in nullam.'
      ].join(' ')
      trace.addAttribute(DESTINATIONS.ALL, tooLong, 'will fail')
      var attributes = Object.keys(trace.attributes.attributes)
      expect(attributes.length).to.equal(0)
    })
  })

  describe('#generateJSON', function() {
    var details

    beforeEach(function(done) {
      makeTrace(agent, function(err, _details) {
        details = _details
        done(err)
      })
    })

    it('should send response time', function(done) {
      details.transaction.getResponseTimeInMillis = function() {
        return 1234
      }

      details.trace.generateJSON(function(err, json, trace) {
        expect(err).to.not.exist
        expect(json[1]).to.equal(1234)
        expect(trace).to.equal(details.trace)
        done()
      })
    })

    describe('when `simple_compression` is `false`', function() {
      it('should compress the segment arrays', function(done) {
        details.trace.generateJSON(function(err, json) {
          if (err) {
            return done(err)
          }

          expect(json[4])
            .to.match(/^[a-zA-Z0-9\+\/]+={0,2}$/, 'should be base64 encoded')

          codec.decode(json[4], function(err, data) {
            if (err) {
              return done(err)
            }

            expect(data).to.deep.equal(details.rootNode)
            done()
          })
        })
      })
    })

    describe('when `simple_compression` is `true`', function() {
      beforeEach(function() {
        agent.config.simple_compression = true
      })

      it('should not compress the segment arrays', function(done) {
        details.trace.generateJSON(function(err, json) {
          if (err) {
            return done(err)
          }

          expect(json[4]).to.deep.equal(details.rootNode)
          done()
        })
      })
    })
  })
})

function makeTrace(agent, callback) {
  var DURATION = 33
  var URL = '/test?test=value'
  agent.config.attributes.enabled = true
  agent.config.attributes.include = ['request.parameters.*']
  agent.config.emit('attributes.include')

  var transaction = new Transaction(agent)
  transaction.trace.addAttribute(DESTINATIONS.COMMON, 'request.uri', URL)
  transaction.url  = URL
  transaction.verb = 'GET'

  transaction.timer.setDurationInMillis(DURATION)

  var trace = transaction.trace
  var start = trace.root.timer.start
  expect(start, 'root segment\'s start time').above(0)
  trace.setDurationInMillis(DURATION, 0)

  var web = trace.root.add(URL)
  transaction.baseSegment = web
  transaction.finalizeNameFromUri(URL, 200)
  // top-level element will share a duration with the quasi-ROOT node
  web.setDurationInMillis(DURATION, 0)

  var db = web.add('Database/statement/AntiSQL/select/getSome')
  db.setDurationInMillis(14, 3)

  var memcache = web.add('Datastore/operation/Memcache/lookup')
  memcache.setDurationInMillis(20, 8)

  /*
   * Segment data repeats the outermost data, nested, with the scope for the
   * outermost version having its scope always set to 'ROOT'. The null bits
   * are parameters, which are optional, and so far, unimplemented for Node.
   */
  var rootSegment = [
    0,
    DURATION,
    'ROOT',
    {nr_exclusive_duration_millis : 0},
    [
      [
        0,
        DURATION,
        'WebTransaction/NormalizedUri/*',
        {
          'nr_exclusive_duration_millis': 8,
          'request.uri': '/test?test=value',
          'request.parameters.test': 'value'
        },
        [
          // TODO: ensure that the ordering is correct WRT start time
          db.toJSON(),
          memcache.toJSON()
        ]
      ]
    ]
  ]

  var rootNode = [
    trace.root.timer.start / 1000,
    {},
    {
      nr_flatten_leading: false
    },
    rootSegment,
    {
      agentAttributes: {
        'request.uri': '/test?test=value',
        'request.parameters.test': 'value'
      },
      userAttributes: {},
      intrinsics: {}
    },
    []  // FIXME: parameter groups
  ]

  codec.encode(rootNode, function(err, encoded) {
    if (err) {
      return callback(err)
    }

    callback(null, {
      transaction: transaction,
      trace: trace,
      rootSegment: rootSegment,
      rootNode: rootNode,
      expectedEncoding: [
        0,
        DURATION,
        'WebTransaction/NormalizedUri/*', // scope
        '/test',  // URI path
        encoded,  // compressed segment / segment data
        '',       // FIXME: depends on RUM token in session
        null,     // reserved, always NULL
        false,    // FIXME: RUM2 session persistence, not worrying about it for now
        null,     // FIXME: xraysessionid
        null      // syntheticsResourceId
      ]
    })
  })
}
