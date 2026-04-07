'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const pino = require('pino')

const version = require('pino/package.json').version
const [major, minor] = version.split('.').map((v) => parseInt(v, 10))
const supportsNativeChannel = major > 9 || (major === 9 && minor >= 10)
const skipIfUnsupported = !supportsNativeChannel && 'requires pino v9.10.0+'

function setupAgent(t) {
 const agent = helper.loadMockedAgent({
    application_logging: {
      enabled: true,
      local_decorating: { enabled: true }
    },
    distributed_tracing: { enabled: true }
 })

 t.teardown(() => helper.unloadAgent(agent))

 return agent
}

function createStream(logs) {
 return {
    write: (line) => logs.push(line)
 }
}

tap.test('log lines are correlated with transactions', { skip: skipIfUnsupported }, (t) => {
 const agent = setupAgent(t)
 const logs = []
 const logger = pino({ level: 'info' }, createStream(logs))
 let ids
 helper.runInTransaction(agent, (tx) => {
    ids = {
      traceId: tx.traceId,
      transactionId: tx.id,
      spanId: tx.trace.root && tx.trace.root.id
    }

    logger.info('test message')
    tx.end()
 })

 t.ok(logs.length)

 const log = JSON.parse(logs[0])
 t.equal(log.msg, 'test message')
 t.equal(log['trace.id'], ids.traceId)
 t.equal(log['transaction.id'], ids.transactionId)

 if (ids.spanId) {
    t.equal(log['span.id'], ids.spanId)
 } else {
    t.ok(log['span.id'])
 }

 t.end()
})

tap.test('child logger and multistream preserve decoration', { skip: skipIfUnsupported }, (t) => {
 const agent = setupAgent(t)
 const logs = []
 const stream = createStream(logs)
 const logger = pino({ level: 'info' }, pino.multistream([{ stream }]))
 const child = logger.child({ child: true })

 helper.runInTransaction(agent, (tx) => {
    child.info('child message')
    tx.end()
 })

 t.ok(logs.length)

 const log = JSON.parse(logs[0])
 t.equal(log.child, true)
 t.equal(log.msg, 'child message')
 t.ok(log['trace.id'])
 t.ok(log['span.id'])
 t.ok(log['transaction.id'])

 t.end()
})
