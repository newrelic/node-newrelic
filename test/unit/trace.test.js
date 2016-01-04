'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../lib/agent_helper')
var codec = require('../../lib/util/codec')
var Segment = require('../../lib/transaction/trace/segment')
var Trace = require('../../lib/transaction/trace')
var Transaction = require('../../lib/transaction')


describe('Trace', function () {
  var agent

  beforeEach(function () {
    agent = helper.loadMockedAgent()
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it('should always be bound to a transaction', function () {
    // fail
    var transam
    expect(function () {
      transam = new Trace()
    }).throws(/must be associated with a transaction/)

    // succeed
    var transaction = new Transaction(agent)
    var tt = new Trace(transaction)
    expect(tt.transaction).instanceof(Transaction)
  })

  it('should have the root of a Segment tree', function () {
    var tt = new Trace(new Transaction(agent))
    expect(tt.root).instanceof(Segment)
  })

  it('should be the primary interface for adding segments to a trace', function () {
    var transaction = new Transaction(agent)
    var trace = transaction.trace

    expect(function () { trace.add('Custom/Test17/Child1') }).not.throws()
  })

  it('should produce a transaction trace in the collector\'s expected format',
     function (done) {
    var DURATION = 33
    var URL = '/test?test=value'
    agent.config.capture_params = true

    var transaction = new Transaction(agent)
    transaction.url  = URL
    transaction.verb = 'GET'

    transaction.timer.setDurationInMillis(DURATION)

    var trace = transaction.trace
    var start = trace.root.timer.start
    expect(start, 'root segment\'s start time').above(0)
    trace.setDurationInMillis(DURATION, 0)

    var web = trace.root.add(URL)
    transaction.setName(URL, 200)
    web.markAsWeb(URL)
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
          {nr_exclusive_duration_millis : 8, test : 'value'},
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
        nr_flatten_leading : false
      },
      rootSegment,
      {
        agentAttributes: {
          test : 'value'
        },
        userAttributes: {

        },
        intrinsics: {}
      },
      []  // FIXME: parameter groups
    ]

    codec.encode(rootNode, function (err, encoded) {
      if (err) return done(err)

      // See docs on Transaction.generateJSON for what goes in which field.
      var expected = [
        0,
        DURATION,
        'WebTransaction/NormalizedUri/*',  // scope
        '/test',                    // URI path
        encoded, // compressed segment / segment data
        '',                         // FIXME: depends on RUM token in session
        null,                       // reserved, always NULL
        false,                      // FIXME: RUM2 session persistence, not
                                    //        worrying about it for now
        null,                       // FIXME: xraysessionid
        null                        // syntheticsResourceId
      ]

      transaction.trace.generateJSON(function cb_generateJSON(err, traceJSON) {
        if (err) return done(err)

        codec.decode(traceJSON[4], function (derr, reconstituted) {
          if (derr) return done(derr)

          expect(reconstituted, 'reconstituted trace segments').deep.equal(rootNode)
          expect(traceJSON,     'full trace JSON').deep.equal(expected)

          helper.unloadAgent(agent)
          return done()
        })
      })
    })
  })

  it('should send host display name when set by user', function () {
    agent.config.process_host.display_name = 'test-value'

    var trace = new Trace(new Transaction(agent))

    expect(trace.parameters).deep.equal({'host.displayName': 'test-value'})
  })

  it('should not send host display name when not set by user', function () {
    var trace = new Trace(new Transaction(agent))

    expect(trace.parameters).deep.equal({})
  })

  it('should produce human-readable JSON of the entire trace graph')

  describe('when inserting segments', function () {
    var trace
      , transaction


    beforeEach(function () {
      transaction = new Transaction(agent)
      trace       = transaction.trace
    })

    it('should require a name for the new segment', function () {
      expect(function () { trace.add(); }).throws(/must be named/)
    })

    it('should allow child segments on a trace', function () {
      expect(function () { trace.add('Custom/Test17/Child1'); }).not.throws()
    })

    it('should return the segment', function () {
      var segment
      expect(function () { segment = trace.add('Custom/Test18/Child1'); }).not.throws()
      expect(segment).instanceof(Segment)
    })

    it('should call a function associated with the segment',
       function (done) {
      var segment = trace.add('Custom/Test18/Child1', function () {
        return done()
      })

      segment.end()
      transaction.end()
    })

    it('should report total time', function () {
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

    it('should report total time on branched traces', function () {
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
        function () {
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

    it('should report the expected trees for branched trees', function () {
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
       function () {
      var child = trace.add('Custom/Test18/Child1')

      trace.setDurationInMillis(42)
      child.setDurationInMillis(22, 0)

      expect(trace.getExclusiveDurationInMillis()).equal(20)
    })

    it('should accurately sum overlapping segments', function () {
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

    it('should accurately sum partially overlapping segments', function () {
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

    it('should accurately sum partially overlapping, open-ranged segments', function () {
      trace.setDurationInMillis(42)

      var now = Date.now()

      var child1 = trace.add('Custom/Test21/Child1')
      child1.setDurationInMillis(22, now)

      // add a range that starts at the exact end of the first
      var child2 = trace.add('Custom/Test21/Child2')
      child2.setDurationInMillis(11, now + 22)

      expect(trace.getExclusiveDurationInMillis()).equal(9)
    })

    it('should be limited to 900 children', function () {
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

      function noop(){}
    })
  })

  describe('generateJSON', function() {
    it('sends response time', function(done) {
      var transaction = new Transaction(agent)
      var tt = new Trace(transaction)

      transaction.getResponseTimeInMillis = function() {
        return 1234
      }

      tt.generateJSON(function(error, json, trace) {
        expect(json[1]).equal(1234)
        done()
      })
    })
  })
})
