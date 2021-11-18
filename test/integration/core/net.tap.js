/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const net = require('net')
const helper = require('../../lib/agent_helper')

function id(tx) {
  return tx && tx.id
}

test('createServer', function createServerTest(t) {
  const { agent, contextManager } = setupAgent(t)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    const server = net.createServer(handler)

    server.listen(4123, function listening() {
      // leave transaction
      contextManager.setContext(null)
      const socket = net.connect({ port: 4123 })
      socket.write('test123')
      socket.end()
    })

    function handler(socket) {
      t.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      socket.end('test')
      t.equal(
        contextManager.getContext().name,
        'net.Server.onconnection',
        'child segment should have correct name'
      )

      socket.on('data', function onData(data) {
        t.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
        t.equal(data.toString(), 'test123')
        socket.end()
        setTimeout(server.close.bind(server, onClose), 0)
      })
    }

    function onClose() {
      const root = agent.getTransaction().trace.root
      t.equal(root.children.length, 1, 'should have a single child')
      const child = root.children[0]
      t.equal(child.name, 'net.Server.onconnection', 'child segment should have correct name')
      t.ok(child.timer.touched, 'child should started and ended')
      t.equal(child.children.length, 1, 'child should have a single child segment')
      const timeout = child.children[0]
      t.equal(timeout.name, 'timers.setTimeout', 'timeout segment should have correct name')
      t.ok(timeout.timer.touched, 'timeout should started and ended')
      t.equal(timeout.children.length, 1, 'timeout should have a single callback segment')
      t.end()
    }
  })
})

test('connect', function connectTest(t) {
  const { agent } = setupAgent(t)

  const server = net.createServer(function connectionHandler(socket) {
    socket.on('data', function onData(data) {
      t.equal(data.toString(), 'some data')
      socket.end('end data')
    })
  })

  t.teardown(function () {
    server.close()
  })

  server.listen(4123, function listening() {
    helper.runInTransaction(agent, transactionWrapper)
  })

  function transactionWrapper(transaction) {
    let count = 0
    const socket = net.createConnection({ port: 4123 })
    socket.on('data', function onData(data) {
      t.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      t.equal(data.toString(), 'end data')
      ++count
    })
    socket.on('end', function onEnd() {
      t.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      t.equal(count, 1)
      setTimeout(verify, 0)
    })

    socket.on('connect', function onConnet() {
      t.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      socket.write('some data')
      socket.end()
    })

    function verify() {
      if (!t.passing()) {
        return t.end()
      }

      const root = agent.getTransaction().trace.root
      t.equal(root.children.length, 1, 'should have a single child')
      let connectSegment = root.children[0]
      t.equal(
        connectSegment.name,
        'net.createConnection',
        'connect segment should have correct name'
      )
      t.ok(connectSegment.timer.touched, 'connect should started and ended')

      // Depending on the version of Node there may be another connection segment
      // floating in the trace.
      if (connectSegment.children[0].name === 'net.Socket.connect') {
        connectSegment = connectSegment.children[0]
      }

      t.equal(connectSegment.children.length, 2, 'connect should have a two child segment')
      const dnsSegment = connectSegment.children[0]
      const timeoutSegment = connectSegment.children[1]

      t.equal(dnsSegment.name, 'dns.lookup', 'dns segment should have correct name')
      t.ok(dnsSegment.timer.touched, 'dns segment should started and ended')
      t.equal(dnsSegment.children.length, 1, 'dns should have a single callback segment')
      t.equal(timeoutSegment.name, 'timers.setTimeout', 'timeout segment should have correct name')
      t.ok(timeoutSegment.timer.touched, 'timeout should started and ended')
      t.equal(timeoutSegment.children.length, 1, 'timeout should have a single callback segment')
      t.end()
    }
  }
})

test('createServer and connect', function createServerTest(t) {
  const { agent, contextManager } = setupAgent(t)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    const server = net.createServer(handler)

    server.listen(4123, function listening() {
      const socket = net.connect({ port: 4123 })
      socket.write('test123')
      socket.end()
    })

    function handler(socket) {
      t.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      socket.end('test')
      t.equal(
        contextManager.getContext().name,
        'net.Server.onconnection',
        'child segment should have correct name'
      )

      socket.on('data', function onData(data) {
        t.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
        t.equal(data.toString(), 'test123')
        socket.end()
        server.close(onClose)
      })
    }

    function onClose() {
      const root = agent.getTransaction().trace.root
      t.equal(root.children.length, 2, 'should have 2 children')
      let clientSegment = root.children[0]
      t.equal(clientSegment.name, 'net.connect', 'server segment should have correct name')
      t.ok(clientSegment.timer.touched, 'server should started and ended')

      // Depending on the version of Node there may be another connection segment
      // floating in the trace.
      if (clientSegment.children[0].name === 'net.Socket.connect') {
        clientSegment = clientSegment.children[0]
      }

      t.equal(clientSegment.children.length, 1, 'clientSegment should only have one child')
      const dnsSegment = clientSegment.children[0]
      if (dnsSegment) {
        t.equal(dnsSegment.name, 'dns.lookup', 'dnsSegment is named properly')
      } else {
        t.fail('did not have children, prevent undefined property lookup')
      }

      const serverSegment = root.children[1]
      t.equal(
        serverSegment.name,
        'net.Server.onconnection',
        'server segment should have correct name'
      )
      t.ok(serverSegment.timer.touched, 'server should started and ended')
      t.equal(serverSegment.children.length, 0, 'should not have any server segments')
      t.end()
    }
  })
})

function setupAgent(t) {
  const agent = helper.instrumentMockedAgent()
  const contextManager = helper.getContextManager()

  t.teardown(function tearDown() {
    helper.unloadAgent(agent)
  })

  return {
    agent,
    contextManager
  }
}
