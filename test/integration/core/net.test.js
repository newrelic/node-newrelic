/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const net = require('net')
const helper = require('../../lib/agent_helper')

function id(tx) {
  return tx && tx.id
}

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  ctx.nr.tracer = helper.getTracer()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('createServer', function createServerTest(t, end) {
  const { agent, tracer } = t.nr

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    const server = net.createServer(handler)

    server.listen(4123, function listening() {
      // leave transaction
      tracer.setSegment(null)
      const socket = net.connect({ port: 4123 })
      socket.write('test123')
      socket.end()
    })

    function handler(socket) {
      assert.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      socket.end('test')
      assert.equal(
        tracer.getSegment().name,
        'net.Server.onconnection',
        'child segment should have correct name'
      )

      socket.on('data', function onData(data) {
        assert.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
        assert.equal(data.toString(), 'test123')
        socket.end()
        setTimeout(server.close.bind(server, onClose), 0)
      })
    }

    function onClose() {
      const root = agent.getTransaction().trace.root
      assert.equal(root.children.length, 1, 'should have a single child')
      const child = root.children[0]
      assert.equal(child.name, 'net.Server.onconnection', 'child segment should have correct name')
      assert.ok(child.timer.touched, 'child should started and ended')
      assert.equal(child.children.length, 1, 'child should have a single child segment')
      const timeout = child.children[0]
      assert.equal(timeout.name, 'timers.setTimeout', 'timeout segment should have correct name')
      assert.ok(timeout.timer.touched, 'timeout should started and ended')
      assert.equal(timeout.children.length, 1, 'timeout should have a single callback segment')
      end()
    }
  })
})

test('connect', function connectTest(t, end) {
  const { agent } = t.nr

  const server = net.createServer(function connectionHandler(socket) {
    socket.on('data', function onData(data) {
      assert.equal(data.toString(), 'some data')
      socket.end('end data')
    })
  })

  t.after(function () {
    server.close()
  })

  server.listen(4123, function listening() {
    helper.runInTransaction(agent, transactionWrapper)
  })

  function transactionWrapper(transaction) {
    let count = 0
    const socket = net.createConnection({ port: 4123 })
    socket.on('data', function onData(data) {
      assert.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      assert.equal(data.toString(), 'end data')
      ++count
    })
    socket.on('end', function onEnd() {
      assert.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      assert.equal(count, 1)
      setTimeout(verify, 0)
    })

    socket.on('connect', function onConnet() {
      assert.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      socket.write('some data')
      socket.end()
    })

    function verify() {
      const root = agent.getTransaction().trace.root
      assert.equal(root.children.length, 1, 'should have a single child')
      let connectSegment = root.children[0]
      assert.equal(
        connectSegment.name,
        'net.createConnection',
        'connect segment should have correct name'
      )
      assert.ok(connectSegment.timer.touched, 'connect should started and ended')

      // Depending on the version of Node there may be another connection segment
      // floating in the trace.
      if (connectSegment.children[0].name === 'net.Socket.connect') {
        connectSegment = connectSegment.children[0]
      }

      assert.equal(connectSegment.children.length, 2, 'connect should have a two child segment')
      const dnsSegment = connectSegment.children[0]
      const timeoutSegment = connectSegment.children[1]

      assert.equal(dnsSegment.name, 'dns.lookup', 'dns segment should have correct name')
      assert.ok(dnsSegment.timer.touched, 'dns segment should started and ended')
      assert.equal(dnsSegment.children.length, 1, 'dns should have a single callback segment')
      assert.equal(
        timeoutSegment.name,
        'timers.setTimeout',
        'timeout segment should have correct name'
      )
      assert.ok(timeoutSegment.timer.touched, 'timeout should started and ended')
      assert.equal(
        timeoutSegment.children.length,
        1,
        'timeout should have a single callback segment'
      )
      end()
    }
  }
})

test('createServer and connect', function createServerTest(t, end) {
  const { agent, tracer } = t.nr

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    const server = net.createServer(handler)

    server.listen(4123, function listening() {
      const socket = net.connect({ port: 4123 })
      socket.write('test123')
      socket.end()
    })

    function handler(socket) {
      assert.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      socket.end('test')
      assert.equal(
        tracer.getSegment().name,
        'net.Server.onconnection',
        'child segment should have correct name'
      )

      socket.on('data', function onData(data) {
        assert.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
        assert.equal(data.toString(), 'test123')
        socket.end()
        server.close(onClose)
      })
    }

    function onClose() {
      const root = agent.getTransaction().trace.root
      assert.equal(root.children.length, 2, 'should have 2 children')
      let clientSegment = root.children[0]
      assert.equal(clientSegment.name, 'net.connect', 'server segment should have correct name')
      assert.ok(clientSegment.timer.touched, 'server should started and ended')

      // Depending on the version of Node there may be another connection segment
      // floating in the trace.
      if (clientSegment.children[0].name === 'net.Socket.connect') {
        clientSegment = clientSegment.children[0]
      }

      assert.equal(clientSegment.children.length, 1, 'clientSegment should only have one child')
      const dnsSegment = clientSegment.children[0]
      if (dnsSegment) {
        assert.equal(dnsSegment.name, 'dns.lookup', 'dnsSegment is named properly')
      } else {
        assert.ok(0, 'did not have children, prevent undefined property lookup')
      }

      const serverSegment = root.children[1]
      assert.equal(
        serverSegment.name,
        'net.Server.onconnection',
        'server segment should have correct name'
      )
      assert.ok(serverSegment.timer.touched, 'server should started and ended')
      assert.equal(serverSegment.children.length, 0, 'should not have any server segments')
      end()
    }
  })
})
