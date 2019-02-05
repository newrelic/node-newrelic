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
        'transactionId',
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
          const span = SpanEvent.fromSegment(seg, 'parent')

          // Should have all the normal properties.
          expect(span).to.be.an.instanceOf(SpanEvent)
          expect(span).to.have.property('type', 'Span')
          expect(span).to.have.property('category', SpanEvent.CATEGORIES.GENERIC)
          expect(span).to.have.property('traceId', tx.id)
          expect(span).to.have.property('guid', seg.id)
          expect(span).to.have.property('parentId', 'parent')
          expect(span).to.have.property('transactionId', tx.id)
          expect(span).to.have.property('sampled', true)
          expect(span).to.have.property('priority', 42)
          expect(span).to.have.property('name', 'timers.setTimeout')
          expect(span).to.have.property('timestamp', seg.timer.start)
          expect(span).to.have.property('duration').within(0.03, 0.07)

          // Should have no http properties.
          expect(span).to.not.have.property('externalLibrary')
          expect(span).to.not.have.property('externalUri')
          expect(span).to.not.have.property('externalProcedure')

          // Should have no datastore properties.
          expect(span).to.not.have.property('component')
          expect(span).to.not.have.property('db.statement')
          expect(span).to.not.have.property('db.instance')
          expect(span).to.not.have.property('peer.hostname')
          expect(span).to.not.have.property('peer.address')
          expect(span).to.not.have.property('span.kind')

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
            expect(span).to.have.property('type', 'Span')
            expect(span).to.have.property('category', SpanEvent.CATEGORIES.HTTP)
            expect(span).to.have.property('traceId', tx.id)
            expect(span).to.have.property('guid', seg.id)
            expect(span).to.have.property('parentId', 'parent')
            expect(span).to.have.property('transactionId', tx.id)
            expect(span).to.have.property('sampled', true)
            expect(span).to.have.property('priority', 42)
            expect(span).to.have.property('name', 'External/example.com:443/')
            expect(span).to.have.property('timestamp', seg.timer.start)
            expect(span).to.have.property('duration').within(0.01, 2)

            // Should have (most) http properties.
            expect(span).to.have.property('component', 'http')
            expect(span).to.have.property('http.url', 'https://example.com:443/')
            expect(span).to.not.have.property('http.method')
            expect(span).to.have.property('span.kind', 'client')

            // Should have no datastore properties.
            expect(span).to.not.have.property('db.statement')
            expect(span).to.not.have.property('db.instance')
            expect(span).to.not.have.property('peer.hostname')
            expect(span).to.not.have.property('peer.address')

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
        }
      })

      shim.setParser((query) => {
        return {
          collection: 'test',
          operation: 'test',
          query: query
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
          expect(span).to.have.property('type', 'Span')
          expect(span).to.have.property('category', SpanEvent.CATEGORIES.DATASTORE)
          expect(span).to.have.property('traceId', tx.id)
          expect(span).to.have.property('guid', seg.id)
          expect(span).to.have.property('parentId', 'parent')
          expect(span).to.have.property('transactionId', tx.id)
          expect(span).to.have.property('sampled', true)
          expect(span).to.have.property('priority', 42)
          expect(span)
            .to.have.property('name', 'Datastore/statement/TestStore/test/test')
          expect(span).to.have.property('timestamp', seg.timer.start)
          expect(span).to.have.property('duration').within(0.03, 0.7)

          // Should have no http properties.
          expect(span).to.not.have.property('http.url')
          expect(span).to.not.have.property('http.method')

          // Should have (most) datastore properties.
          expect(span).to.not.have.property('component')
          expect(span).to.have.property('db.instance')
          expect(span).to.have.property('peer.hostname', 'my-db-host')
          expect(span).to.have.property('peer.address', 'my-db-host:/path/to/db.sock')
          expect(span).to.have.property('span.kind', 'client')
          expect(span).to.have.property('db.statement')
          // Testing query truncation
          const statement = span['db.statement']
          expect(statement.endsWith('...')).to.be.true
          expect(Buffer.byteLength(statement, 'utf8')).to.equal(2000)

          done()
        })
      })
    })
  })
})
