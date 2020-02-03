'use strict'

const DatastoreShim = require('../../../lib/shim/datastore-shim')
const expect = require('chai').expect
const helper = require('../../lib/agent_helper')
const https = require('https')
const SpanEvent = require('../../../lib/spans/span-event')


describe('SpanEvent', () => {
  describe('#constructor()', () => {
    it('should construct an empty span event', () => {
      const attrs = {}
      const span = new SpanEvent(attrs)
      expect(span).to.be.an.instanceOf(SpanEvent)
      expect(span).property('attributes').to.equal(attrs)
      expect(span).to.have.property('intrinsics')
      expect(span.intrinsics).to.have.property('type', 'Span')
      expect(span.intrinsics).to.have.property('category', SpanEvent.CATEGORIES.GENERIC)

      const emptyProps = [
        'traceId',
        'guid',
        'parentId',
        'transactionId',
        'sampled',
        'priority',
        'name',
        'timestamp',
        'duration'
      ]
      emptyProps.forEach((prop) => expect(span.intrinsics).to.have.property(prop, null))
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
          const span = SpanEvent.fromSegment(seg, 'parent')

          // Should have all the normal properties.
          expect(span).to.be.an.instanceOf(SpanEvent)
          expect(span).to.have.property('intrinsics')
          expect(span.intrinsics).to.have.property('type', 'Span')
          expect(span.intrinsics)
            .to.have.property('category', SpanEvent.CATEGORIES.GENERIC)
          expect(span.intrinsics).to.have.property('traceId', tx.traceId)
          expect(span.intrinsics).to.have.property('guid', seg.id)
          expect(span.intrinsics).to.have.property('parentId', 'parent')
          expect(span.intrinsics).to.have.property('transactionId', tx.id)
          expect(span.intrinsics).to.have.property('sampled', true)
          expect(span.intrinsics).to.have.property('priority', 42)
          expect(span.intrinsics).to.have.property('name', 'timers.setTimeout')
          expect(span.intrinsics).to.have.property('timestamp', seg.timer.start)
          expect(span.intrinsics).to.have.property('duration').within(0.03, 0.07)
          // Generic should not have 'span.kind' or 'component'
          expect(span.intrinsics).to.have.property('span.kind', null)
          expect(span.intrinsics).to.have.property('component', null)

          expect(span).to.have.property('attributes')
          const attributes = span.attributes

          // Should have no http properties.
          expect(attributes).to.not.have.property('externalLibrary')
          expect(attributes).to.not.have.property('externalUri')
          expect(attributes).to.not.have.property('externalProcedure')

          // Should have no datastore properties.
          expect(attributes).to.not.have.property('db.statement')
          expect(attributes).to.not.have.property('db.instance')
          expect(attributes).to.not.have.property('peer.hostname')
          expect(attributes).to.not.have.property('peer.address')

          done()
        }, 50)
      })
    })

    it('should create an http span with a external segment', (done) => {
      helper.runInTransaction(agent, (tx) => {
        tx.sampled = true
        tx.priority = 42

        https.get('https://example.com?foo=bar', (res) => {
          res.resume()
          res.on('end', () => {
            const seg = agent.tracer.getTransaction().trace.root.children[0]
            const span = SpanEvent.fromSegment(seg, 'parent')

            // Should have all the normal properties.
            expect(span).to.be.an.instanceOf(SpanEvent)
            expect(span).to.be.an.instanceOf(SpanEvent.HttpSpanEvent)
            expect(span).to.have.property('intrinsics')
            expect(span.intrinsics).to.have.property('type', 'Span')
            expect(span.intrinsics)
              .to.have.property('category', SpanEvent.CATEGORIES.HTTP)
            expect(span.intrinsics).to.have.property('traceId', tx.traceId)
            expect(span.intrinsics).to.have.property('guid', seg.id)
            expect(span.intrinsics).to.have.property('parentId', 'parent')
            expect(span.intrinsics).to.have.property('transactionId', tx.id)
            expect(span.intrinsics).to.have.property('sampled', true)
            expect(span.intrinsics).to.have.property('priority', 42)
            expect(span.intrinsics).to.have.property('name', 'External/example.com:443/')
            expect(span.intrinsics).to.have.property('timestamp', seg.timer.start)
            expect(span.intrinsics).to.have.property('duration').within(0.01, 2)
            // Should have type-specific intrinsics
            expect(span.intrinsics).to.have.property('component', 'http')
            expect(span.intrinsics).to.have.property('span.kind', 'client')

            expect(span).to.have.property('attributes')
            const attributes = span.attributes

            // Should have (most) http properties.
            expect(attributes).to.have.property('http.url', 'https://example.com:443/')
            expect(attributes).to.have.property('http.method')

            // Should have no datastore properties.
            expect(attributes).to.not.have.property('db.statement')
            expect(attributes).to.not.have.property('db.instance')
            expect(attributes).to.not.have.property('peer.hostname')
            expect(attributes).to.not.have.property('peer.address')

            done()
          })
        })
      })
    })

    it('should create an datastore span with an datastore segment', (done) => {
      agent.config.distributed_tracing.enabled = true
      agent.config.transaction_tracer.record_sql = 'raw'
      const dsConn = {myDbOp: (query, cb) => setTimeout(cb, 50)}
      let longQuery = ''
      while (Buffer.byteLength(longQuery, 'utf8') < 2001) {
        longQuery += 'a'
      }
      shim.recordQuery(dsConn, 'myDbOp', {
        callback: shim.LAST,
        query: shim.FIRST,
        parameters: {
          host: 'my-db-host',
          port_path_or_id: '/path/to/db.sock',
          database_name: 'my-database',
          collection: 'my-collection'
        }
      })

      shim.setParser((query) => {
        return {
          collection: 'test',
          operation: 'test',
          query
        }
      })

      helper.runInTransaction(agent, (tx) => {
        tx.sampled = true
        tx.priority = 42

        dsConn.myDbOp(longQuery, () => {
          tx.end()
          const seg = tx.trace.root.children[0]
          const span = SpanEvent.fromSegment(seg, 'parent')

          // Should have all the normal properties.
          expect(span).to.be.an.instanceOf(SpanEvent)
          expect(span).to.be.an.instanceOf(SpanEvent.DatastoreSpanEvent)
          expect(span).to.have.property('intrinsics')
          expect(span.intrinsics).to.have.property('type', 'Span')
          expect(span.intrinsics)
            .to.have.property('category', SpanEvent.CATEGORIES.DATASTORE)
          expect(span.intrinsics).to.have.property('traceId', tx.traceId)
          expect(span.intrinsics).to.have.property('guid', seg.id)
          expect(span.intrinsics).to.have.property('parentId', 'parent')
          expect(span.intrinsics).to.have.property('transactionId', tx.id)
          expect(span.intrinsics).to.have.property('sampled', true)
          expect(span.intrinsics).to.have.property('priority', 42)
          expect(span.intrinsics)
            .to.have.property('name', 'Datastore/statement/TestStore/test/test')
          expect(span.intrinsics).to.have.property('timestamp', seg.timer.start)
          expect(span.intrinsics).to.have.property('duration').within(0.03, 0.7)
          // Should have (most) type-specific intrinsics
          expect(span.intrinsics).to.have.property('component', 'TestStore')
          expect(span.intrinsics).to.have.property('span.kind', 'client')

          expect(span).to.have.property('attributes')
          const attributes = span.attributes

          // Should have no http properties.
          expect(attributes).to.not.have.property('http.url')
          expect(attributes).to.not.have.property('http.method')

          // Should have (most) datastore properties.
          expect(attributes).to.have.property('db.instance')
          expect(attributes).to.have.property('db.collection', 'my-collection')
          expect(attributes).to.have.property('peer.hostname', 'my-db-host')
          expect(attributes)
            .to.have.property('peer.address', 'my-db-host:/path/to/db.sock')
          expect(attributes).to.have.property('db.statement')
          // Testing query truncation
          const statement = attributes['db.statement']
          expect(statement.endsWith('...')).to.be.true
          expect(Buffer.byteLength(statement, 'utf8')).to.equal(2000)

          done()
        })
      })
    })

    it('should serialize intrinsics to proper format with toJSON method',
      (done) => {
        helper.runInTransaction(agent, (tx) => {
          tx.priority = 42
          tx.sample = true

          setTimeout(() => {
            const seg = agent.tracer.getSegment()
            const span = SpanEvent.fromSegment(seg, 'parent')

            const payload = span.toJSON()

            expect(payload[0]).to.have.property('type', 'Span')
            expect(payload[0]).to.have.property('traceId', tx.traceId)
            expect(payload[0]).to.have.property('guid', seg.id)
            expect(payload[0]).to.have.property('parentId', 'parent')
            expect(payload[0]).to.have.property('transactionId', tx.id)
            expect(payload[0]).to.have.property('priority', 42)
            expect(payload[0]).to.have.property('name')
            expect(payload[0]).to.have.property('category', 'generic')
            expect(payload[0]).to.have.property('timestamp')
            expect(payload[0]).to.have.property('duration')

            done()
          }, 10)
        })
      })
  })
})
