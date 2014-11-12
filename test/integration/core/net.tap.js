'use strict'

var test = require('tap').test
var net = require('net')
var helper = require('../../lib/agent_helper')

test('createServer', function createServerTest(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var server = net.createServer(handler)

    server.listen(4123, function listening() {
      // leave transaction
      agent.tracer.segment = null
      var socket = net.connect({port: 4123})
      socket.write('test123')
    })

    function handler(socket) {
      t.equal(transaction, agent.getTransaction())
      socket.end('test')
      t.equal(
        agent.tracer.getSegment().name,
        'net.Server.onconnection',
        'child segment should have correct name'
      )

      socket.on('data', function onData(data) {
        t.equal(transaction, agent.getTransaction())
        t.equal(data.toString(), 'test123')
        socket.end()
        setTimeout(server.close.bind(server, onClose), 0)
      })
    }

    function onClose() {
      var root = agent.getTransaction().trace.root
      t.equal(root.children.length, 1, 'should have a single child')
      var child = root.children[0]
      t.equal(
        child.name,
        'net.Server.onconnection',
        'child segment should have correct name'
      )
      t.ok(child.timer.touched, 'child should started and ended')
      t.equal(
        child.children.length,
        1,
        'child should have a single child segment'
      )
      var timeout = child.children[0]
      t.equal(
        timeout.name,
        'timers.setTimeout',
        'timeout segment should have correct name'
      )
      t.ok(timeout.timer.touched, 'timeout should started and ended')
      t.equal(
        timeout.children.length,
        1,
        'timeout should have a single callback segment'
      )
      t.end()
    }
  })
})

test('connect', function connectTest(t) {
  var agent = setupAgent(t)

  var server = net.createServer(function connectionHandler(socket) {
    socket.on('data', function onData(data) {
      t.equal(data.toString(), 'some data')
      socket.end('end data')
      server.close()
    })
  })

  server.listen(4123, function listening() {
    helper.runInTransaction(agent, transactionWrapper)
  })

  function transactionWrapper(transaction) {
    var count = 0
    var socket = net.createConnection({port: 4123})
    socket.on('data', function onData(data) {
      t.equal(agent.getTransaction(), transaction)
      t.equal(data.toString(), 'end data')
      ++count
    })
    socket.on('end', function onEnd() {
      t.equal(agent.getTransaction(), transaction)
      t.equal(count, 1)
      setTimeout(verify, 0)
    })

    socket.on('connect', function onConnet() {
      t.equal(agent.getTransaction(), transaction)
      socket.write('some data')
    })

    function verify() {
      var root = agent.getTransaction().trace.root
      t.equal(root.children.length, 1, 'should have a single child')
      var connectSegment = root.children[0]
      t.equal(
        connectSegment.name,
        'net.Socket.connect',
        'connect segment should have correct name'
      )
      t.ok(connectSegment.timer.touched, 'connect should started and ended')

      var timeoutSegment
      // 0.12 has dns lookup, 0.10 and under does not
      if (connectSegment.children.length > 1) {
        t.equal(
          connectSegment.children.length,
          2,
          'connect should have a two child segment'
        )
        var dnsSegment = connectSegment.children[0]
        timeoutSegment = connectSegment.children[1]

        t.equal(
          dnsSegment.name,
          'dns.lookup',
          'dns segment should have correct name'
        )
        t.ok(dnsSegment.timer.touched, 'dns segment should started and ended')
        t.equal(
          dnsSegment.children.length,
          1,
          'dns should have a single callback segment'
        )
      } else {
        t.equal(
          connectSegment.children.length,
          1,
          'connect should have a single child segment'
        )
        timeoutSegment = connectSegment.children[0]
      }
      t.equal(
        timeoutSegment.name,
        'timers.setTimeout',
        'timeout segment should have correct name'
      )
      t.ok(timeoutSegment.timer.touched, 'timeout should started and ended')
      t.equal(
        timeoutSegment.children.length,
        1,
        'timeout should have a single callback segment'
      )
      t.end()
    }
  }
})

test('createServer and connect', function createServerTest(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var server = net.createServer(handler)

    server.listen(4123, function listening() {
      var socket = net.connect({port: 4123})
      socket.write('test123')
    })

    function handler(socket) {
      t.equal(transaction, agent.getTransaction())
      socket.end('test')
      t.equal(
        agent.tracer.getSegment().name,
        'net.Server.onconnection',
        'child segment should have correct name'
      )

      socket.on('data', function onData(data) {
        t.equal(transaction, agent.getTransaction())
        t.equal(data.toString(), 'test123')
        socket.end()
        server.close(onClose)
      })
    }

    function onClose() {
      var root = agent.getTransaction().trace.root
      t.equal(root.children.length, 2, 'should have 2 children')
      var clientSegment = root.children[0]
      t.equal(
        clientSegment.name,
        'net.Socket.connect',
        'server segment should have correct name'
      )
      t.ok(clientSegment.timer.touched, 'server should started and ended')

      // 0.12 gets a DNS segment, 0.10 or less doesn't, yay conditional tests.
      if (clientSegment.children.length > 0) {
        t.equal(
          clientSegment.children.length,
          1,
          'clientSegment should only have one child'
        )
        var dnsSegment = clientSegment.children[0]
        if (dnsSegment) {
          t.equal(
            dnsSegment.name,
            'dns.lookup',
            'dnsSegment is named properly'
          )
        } else {
          t.fail('did not have children, prevent undefined property lookup')
        }
      } else {
        t.equal(
          clientSegment.children.length,
          0,
          'should not have any server segments'
        )
      }
      var serverSegment = root.children[1]
      t.equal(
        serverSegment.name,
        'net.Server.onconnection',
        'server segment should have correct name'
      )
      t.ok(serverSegment.timer.touched, 'server should started and ended')
      t.equal(
        serverSegment.children.length,
        0,
        'should not have any server segments'
      )
      t.end()
    }
  })
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function tearDown() {
    helper.unloadAgent(agent)
  })
  return agent
}
