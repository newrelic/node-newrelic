'use strict'

const DatastoreShim = require('../../../lib/shim/datastore-shim')
const expect = require('chai').expect
const helper = require('../../lib/agent_helper')
const https = require('https')
const SpanEvent = require('../../../lib/spans/span-event')

describe('SpanEvent', () => {
  describe('#constructor()', () => {
    it('should construct an empty span event', () => {
      const span = new SpanEvent()
      expect(span).to.be.an.instanceOf(SpanEvent)
      expect(span).to.have.property('type', 'Span')
      expect(span).to.have.property('category', SpanEvent.CATEGORIES.GENERIC)

      const emptyProps = [
        'traceId',
        'guid',
        'parentId',
        'grandparentId',
        'appLocalRootId',
        'sampled',
        'priority',
        'name',
        'timestamp',
        'duration'
      ]
      emptyProps.forEach((prop) => expect(span).to.have.property(prop, null))
    })
  })

  describe('.fromSegment()', () => {
    let agent = null
    let shim = null
    beforeEach(() => {
      agent = helper.instrumentMockedAgent()
      shim = new DatastoreShim(agent, 'test-data-store', '', 'TestStore')
    })

    afterEach(() => helper.unloadAgent(agent))

    it('should create a generic span with a random segment', (done) => {
      helper.runInTransaction(agent, (tx) => {
        tx.sampled = true
        tx.priority = 42

        setTimeout(() => {
          const seg = agent.tracer.getTransaction().trace.root.children[0]
          const span = SpanEvent.fromSegment(seg, 'parent', 'grandparent')

          // Should have all the normal properties.
          expect(span).to.be.an.instanceOf(SpanEvent)
          expect(span).to.have.property('type', 'Span')
          expect(span).to.have.property('category', SpanEvent.CATEGORIES.GENERIC)
          expect(span).to.have.property('traceId', tx.id)
          expect(span).to.have.property('guid', seg.id)
          expect(span).to.have.property('parentId', 'parent')
          expect(span).to.have.property('grandparentId', 'grandparent')
          expect(span).to.have.property('appLocalRootId', tx.id)
          expect(span).to.have.property('sampled', true)
          expect(span).to.have.property('priority', 42)
          expect(span).to.have.property('name', 'timers.setTimeout')
          expect(span).to.have.property('timestamp', seg.timer.start)
          expect(span).to.have.property('duration').within(0.03, 0.07)

          // Should have no externals properties.
          expect(span).to.not.have.property('externalLibrary')
          expect(span).to.not.have.property('externalUri')
          expect(span).to.not.have.property('externalProcedure')

          // Should have no datastore properties.
          expect(span).to.not.have.property('datastoreProduct')
          expect(span).to.not.have.property('datastoreCollection')
          expect(span).to.not.have.property('datastoreOperation')
          expect(span).to.not.have.property('datastoreHost')
          expect(span).to.not.have.property('datastorePortPathOrId')
          expect(span).to.not.have.property('datastoreName')

          done()
        }, 50)
      })
    })

    it('should create a external span with a external segment', (done) => {
      helper.runInTransaction(agent, (tx) => {
        tx.sampled = true
        tx.priority = 42

        https.get('https://example.com?foo=bar', (res) => {
          res.resume()
          res.on('end', () => {
            const seg = agent.tracer.getTransaction().trace.root.children[0]
            const span = SpanEvent.fromSegment(seg, 'parent', 'grandparent')

            // Should have all the normal properties.
            expect(span).to.be.an.instanceOf(SpanEvent)
            expect(span).to.be.an.instanceOf(SpanEvent.ExternalSpanEvent)
            expect(span).to.have.property('type', 'Span')
            expect(span).to.have.property('category', SpanEvent.CATEGORIES.EXTERNAL)
            expect(span).to.have.property('traceId', tx.id)
            expect(span).to.have.property('guid', seg.id)
            expect(span).to.have.property('parentId', 'parent')
            expect(span).to.have.property('grandparentId', 'grandparent')
            expect(span).to.have.property('appLocalRootId', tx.id)
            expect(span).to.have.property('sampled', true)
            expect(span).to.have.property('priority', 42)
            expect(span).to.have.property('name', 'External/example.com:443/')
            expect(span).to.have.property('timestamp', seg.timer.start)
            expect(span).to.have.property('duration').within(0.01, 2)

            // Should have (most) externals properties.
            expect(span).to.have.property('externalLibrary', 'http')
            expect(span).to.have.property('externalUri', 'https://example.com:443/')
            expect(span).to.not.have.property('externalProcedure')

            // Should have no datastore properties.
            expect(span).to.not.have.property('datastoreProduct')
            expect(span).to.not.have.property('datastoreCollection')
            expect(span).to.not.have.property('datastoreOperation')
            expect(span).to.not.have.property('datastoreHost')
            expect(span).to.not.have.property('datastorePortPathOrId')
            expect(span).to.not.have.property('datastoreName')

            done()
          })
        })
      })
    })

    it('should create an datastore span with an datastore segment', (done) => {
      const dsConn = {myDbOp: (cb) => setTimeout(cb, 50)}
      shim.recordOperation(dsConn, 'myDbOp', {
        callback: shim.FIRST,
        parameters: {
          host: 'my-db-host',
          port_path_or_id: '/path/to/db.sock',
          database_name: 'my-database'
        }
      })

      helper.runInTransaction(agent, (tx) => {
        tx.sampled = true
        tx.priority = 42

        dsConn.myDbOp(() => {
          const seg = agent.tracer.getTransaction().trace.root.children[0]
          const span = SpanEvent.fromSegment(seg, 'parent', 'grandparent')

          // Should have all the normal properties.
          expect(span).to.be.an.instanceOf(SpanEvent)
          expect(span).to.be.an.instanceOf(SpanEvent.DatastoreSpanEvent)
          expect(span).to.have.property('type', 'Span')
          expect(span).to.have.property('category', SpanEvent.CATEGORIES.DATASTORE)
          expect(span).to.have.property('traceId', tx.id)
          expect(span).to.have.property('guid', seg.id)
          expect(span).to.have.property('parentId', 'parent')
          expect(span).to.have.property('grandparentId', 'grandparent')
          expect(span).to.have.property('appLocalRootId', tx.id)
          expect(span).to.have.property('sampled', true)
          expect(span).to.have.property('priority', 42)
          expect(span).to.have.property('name', 'Datastore/operation/TestStore/myDbOp')
          expect(span).to.have.property('timestamp', seg.timer.start)
          expect(span).to.have.property('duration').within(0.03, 0.7)

          // Should have no externals properties.
          expect(span).to.not.have.property('externalLibrary')
          expect(span).to.not.have.property('externalUri')
          expect(span).to.not.have.property('externalProcedure')

          // Should have (some) datastore properties.
          expect(span).to.not.have.property('datastoreProduct')
          expect(span).to.not.have.property('datastoreCollection')
          expect(span).to.not.have.property('datastoreOperation')
          expect(span).to.have.property('datastoreHost', 'my-db-host')
          expect(span).to.have.property('datastorePortPathOrId', '/path/to/db.sock')
          expect(span).to.have.property('datastoreName', 'my-database')

          done()
        })
      })
    })
  })
})
