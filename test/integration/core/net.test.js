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
      const children = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(children.length, 2, 'should have a single child')
      const child = children[1]
      const childChildren = transaction.trace.getChildren(child.id)
      assert.equal(child.name, 'net.Server.onconnection', 'child segment should have correct name')
      assert.ok(child.timer.touched, 'child should started and ended')
      assert.equal(childChildren.length, 0)
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

    socket.on('connect', function onConnect() {
      assert.equal(id(agent.getTransaction()), id(transaction), 'should maintain tx')
      socket.write('some data')
      socket.end()
    })

    function verify() {
      const transaction = agent.getTransaction()
      const children = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(children.length, 1, 'should have a single child')
      let connectSegment = children[0]
      assert.equal(
        connectSegment.name,
        'net.createConnection',
        'connect segment should have correct name'
      )
      assert.ok(connectSegment.timer.touched, 'connect should started and ended')
      let connectChildren = transaction.trace.getChildren(connectSegment.id)

      // Depending on the version of Node there may be another connection segment
      // floating in the trace.
      if (connectChildren[0].name === 'net.Socket.connect') {
        connectSegment = connectChildren[0]
      }
      connectChildren = transaction.trace.getChildren(connectSegment.id)

      assert.equal(connectChildren.length, 1, 'connect should have one child segment')
      const [dnsSegment] = connectChildren

      assert.equal(dnsSegment.name, 'dns.lookup', 'dns segment should have correct name')
      assert.ok(dnsSegment.timer.touched, 'dns segment should started and ended')
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
      const transaction = agent.getTransaction()
      const children = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(children.length, 2, 'should have 2 children')
      let clientSegment = children[0]
      assert.equal(clientSegment.name, 'net.connect', 'server segment should have correct name')
      assert.ok(clientSegment.timer.touched, 'server should started and ended')
      let clientChildren = transaction.trace.getChildren(clientSegment.id)

      // Depending on the version of Node there may be another connection segment
      // floating in the trace.
      if (clientChildren[0].name === 'net.Socket.connect') {
        clientSegment = clientChildren[0]
      }
      clientChildren = transaction.trace.getChildren(clientSegment.id)

      assert.equal(clientChildren.length, 1, 'clientSegment should only have one child')
      const [dnsSegment] = clientChildren
      if (dnsSegment) {
        assert.equal(dnsSegment.name, 'dns.lookup', 'dnsSegment is named properly')
      } else {
        assert.ok(0, 'did not have children, prevent undefined property lookup')
      }

      const serverSegment = children[1]
      assert.equal(
        serverSegment.name,
        'net.Server.onconnection',
        'server segment should have correct name'
      )
      assert.ok(serverSegment.timer.touched, 'server should started and ended')
      const serverChildren = transaction.trace.getChildren(serverSegment.id)
      assert.equal(serverChildren.length, 0, 'should not have any server segments')
      end()
    }
  })
})

test('connect outside of a transaction', function (t, end) {
  const { agent } = t.nr
  // No runInTransaction wrapper -- net.connect must work normally when there
  // is no active transaction.
  assert.equal(agent.getTransaction(), null, 'precondition: no active transaction')

  const server = net.createServer(function connectionHandler(socket) {
    socket.on('data', function onData(data) {
      assert.equal(data.toString(), 'some data')
      socket.end('end data')
    })
  })

  t.after(function () {
    server.close()
  })

  server.listen(4124, function listening() {
    const socket = net.connect({ port: 4124 })
    socket.on('data', function onData(data) {
      assert.equal(data.toString(), 'end data')
    })
    socket.on('end', function onEnd() {
      assert.equal(agent.getTransaction(), null, 'should still have no transaction')
      end()
    })
    socket.on('connect', function onConnect() {
      socket.write('some data')
      socket.end()
    })
  })
})

test('socket.connect called directly', function (t, end) {
  const { agent, tracer } = t.nr

  const server = net.createServer(function connectionHandler(socket) {
    socket.end()
  })

  t.after(function () {
    server.close()
  })

  server.listen(4125, function listening() {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      const socket = new net.Socket()
      let segmentInCallback = null
      socket.connect(4125, function onConnect() {
        assert.equal(
          id(agent.getTransaction()),
          id(transaction),
          'connect callback should run in the correct transaction'
        )
        segmentInCallback = tracer.getSegment()
        socket.end()
      })
      socket.on('close', function onClose() {
        const children = transaction.trace.getChildren(transaction.trace.root.id)
        assert.equal(children.length, 1, 'should have a single child')
        const connectSegment = children[0]
        assert.equal(
          connectSegment.name,
          'net.Socket.connect',
          'connect segment should have correct name'
        )
        assert.ok(connectSegment.timer.touched, 'connect segment should have started and ended')
        assert.equal(
          segmentInCallback,
          connectSegment,
          'connect callback should run bound to the connect segment'
        )
        end()
      })
    })
  })
})

test('socket.connect called directly outside of a transaction', function (t, end) {
  const { agent } = t.nr
  assert.equal(agent.getTransaction(), null, 'precondition: no active transaction')

  const server = net.createServer(function connectionHandler(socket) {
    socket.end()
  })

  t.after(function () {
    server.close()
  })

  server.listen(4126, function listening() {
    const socket = new net.Socket()
    socket.connect(4126, function onConnect() {
      socket.end()
    })
    socket.on('close', function onClose() {
      assert.equal(agent.getTransaction(), null, 'should still have no transaction')
      end()
    })
  })
})

test('server accepts a connection outside of a transaction', function (t, end) {
  const { agent } = t.nr
  assert.equal(agent.getTransaction(), null, 'precondition: no active transaction')

  const server = net.createServer(function connectionHandler(socket) {
    assert.equal(agent.getTransaction(), null, 'should not create a transaction')
    socket.on('data', function onData(data) {
      assert.equal(data.toString(), 'some data')
      socket.end('end data')
    })
  })

  t.after(function () {
    server.close()
  })

  server.listen(4127, function listening() {
    const socket = net.connect({ port: 4127 })
    socket.on('data', function onData(data) {
      assert.equal(data.toString(), 'end data')
    })
    socket.on('end', function onEnd() {
      assert.equal(agent.getTransaction(), null, 'should still have no transaction')
      end()
    })
    socket.on('connect', function onConnect() {
      socket.write('some data')
      socket.end()
    })
  })
})

test('socket.connect called directly binds data events to the connect segment', function (t, end) {
  const { agent, tracer } = t.nr

  const server = net.createServer(function connectionHandler(socket) {
    socket.end('some data')
  })

  t.after(function () {
    server.close()
  })

  server.listen(4130, function listening() {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      const socket = new net.Socket()
      let segmentInDataHandler = null

      socket.connect(4130)
      socket.on('data', function onData(data) {
        assert.equal(data.toString(), 'some data')
        segmentInDataHandler = tracer.getSegment()
      })
      socket.on('close', function onClose() {
        const children = transaction.trace.getChildren(transaction.trace.root.id)
        assert.equal(children.length, 1, 'should have a single child')
        const connectSegment = children[0]
        assert.equal(
          connectSegment.name,
          'net.Socket.connect',
          'connect segment should have correct name'
        )
        assert.equal(
          segmentInDataHandler,
          connectSegment,
          'data event (delivered via _handle.onread) should run bound to the connect segment'
        )
        end()
      })
    })
  })
})

test('accepted connection binds data events to the onconnection segment', function (t, end) {
  const { agent, tracer } = t.nr

  helper.runInTransaction(agent, function transactionWrapper() {
    const server = net.createServer(function connectionHandler(socket) {
      const onconnectionSegment = tracer.getSegment()
      assert.equal(
        onconnectionSegment.name,
        'net.Server.onconnection',
        'precondition: connection handler should run in the onconnection segment'
      )

      socket.on('data', function onData(data) {
        assert.equal(data.toString(), 'test123')
        assert.equal(
          tracer.getSegment(),
          onconnectionSegment,
          'data event (delivered via _handle.onread) should run bound to the onconnection segment'
        )
        socket.end()
        server.close(function onClose() {
          end()
        })
      })
    })

    server.listen(4131, function listening() {
      const socket = net.connect({ port: 4131 })
      socket.write('test123')
    })
  })
})

test('net.connect binds socket events to the correct connect segment', function (t, end) {
  const { agent, tracer } = t.nr

  const server = net.createServer(function connectionHandler(socket) {
    socket.end('end data')
  })

  t.after(function () {
    server.close()
  })

  server.listen(4132, function listening() {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      const socket = net.createConnection({ port: 4132 })
      let segmentInConnectHandler = null
      let segmentInDataHandler = null

      socket.on('connect', function onConnect() {
        segmentInConnectHandler = tracer.getSegment()
      })
      socket.on('data', function onData(data) {
        assert.equal(data.toString(), 'end data')
        segmentInDataHandler = tracer.getSegment()
      })
      socket.on('end', function onEnd() {
        const children = transaction.trace.getChildren(transaction.trace.root.id)
        assert.equal(children.length, 1, 'should have a single child')
        let connectSegment = children[0]
        assert.equal(
          connectSegment.name,
          'net.createConnection',
          'outer segment should have correct name'
        )

        // Depending on the version of Node there may be another connection
        // segment floating in the trace. When present, that nested segment is
        // the one socket events are actually bound to -- `wrapConnect`'s own
        // emit binding (set up while the inner segment is active) wraps on
        // top of the one `wrapCreate`/`wrapSocket` set up for the outer one.
        const connectChildren = transaction.trace.getChildren(connectSegment.id)
        if (connectChildren[0] && connectChildren[0].name === 'net.Socket.connect') {
          connectSegment = connectChildren[0]
        }

        assert.equal(
          segmentInConnectHandler,
          connectSegment,
          'connect event should run bound to the innermost connect segment'
        )
        assert.equal(
          segmentInDataHandler,
          connectSegment,
          'data event should run bound to the innermost connect segment'
        )
        end()
      })
    })
  })
})

test('listen binds its callback to the segment active when listen was called', function (t, end) {
  const { agent, tracer } = t.nr

  helper.runInTransaction(agent, function transactionWrapper() {
    const server = net.createServer()

    t.after(function () {
      server.close()
    })

    const activeSegment = tracer.getSegment()
    assert.ok(activeSegment, 'precondition: should have an active segment')

    server.listen(4128, function listening() {
      assert.equal(
        tracer.getSegment(),
        activeSegment,
        'listen callback should run bound to the segment active when listen was called'
      )
      end()
    })
  })
})

test('close binds its callback to the segment active when close was called', function (t, end) {
  const { agent, tracer } = t.nr

  helper.runInTransaction(agent, function transactionWrapper() {
    const server = net.createServer()

    server.listen(4129, function listening() {
      const activeSegment = tracer.getSegment()
      assert.ok(activeSegment, 'precondition: should have an active segment')

      server.close(function closed() {
        assert.equal(
          tracer.getSegment(),
          activeSegment,
          'close callback should run bound to the segment active when close was called'
        )
        end()
      })
    })
  })
})
