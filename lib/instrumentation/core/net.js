'use strict'

var wrap = require('../../shimmer').wrapMethod

module.exports = initialize

function initialize(agent, net) {
  wrap(net.Server.prototype, 'net.Server.prototype', '_listen2', wrapListen2)
  wrap(net.Socket.prototype, 'net.Socket.prototype', 'connect', wrapConnect)

  function wrapListen2(original) {
    return function wrappedListen2() {
      var segment = agent.tracer.getSegment()
      var emit = this.emit

      if (!segment || !emit) return original.apply(this, arguments)

      this.emit = wrappedEmit

      return original.apply(this, arguments)

      function wrappedEmit(ev, socket) {
        if (ev !== 'connection' || !socket || !socket._handle) {
          return emit.apply(this, arguments)
        }

        var child = agent.tracer.createSegment('net.Server.onconnection', null, segment)

        if (socket._handle.onread) {
          socket._handle.onread = agent.tracer.bindFunction(socket._handle.onread, child)
        }

        return agent.tracer.bindFunction(emit, child, true).apply(this, arguments)
      }
    }
  }

  function wrapConnect(original) {
    return function connectWrapper() {
      if (!agent.getTransaction()) return original.apply(this, arguments)
      var socket = this
      var args = normalizeConnectArgs(arguments)
      return agent.tracer.addSegment(
        'net.Socket.connect',
        null,
        null,
        true,
        wrappedConnect
      )

      function wrappedConnect(child) {
        if (args[1]) args[1] = agent.tracer.bindFunction(args[1], child)
        var result = original.apply(socket, args)
        if (socket._handle) {
          socket._handle.onread = agent.tracer.bindFunction(socket._handle.onread, child)
        }
        agent.tracer.bindEmitter(socket, child)
        return result
      }
    }
  }
}

// taken from node master on 2013/10/30
function normalizeConnectArgs(args) {
  var options = {}

  function toNumber(x) {
    return (x = Number(x)) >= 0 ? x : false
  }
  if (typeof args[0] === 'object' && args[0] !== null) {
    // connect(options, [cb])
    options = args[0]
  } else if (typeof args[0] === 'string' && toNumber(args[0]) === false) {
    // connect(path, [cb]);
    options.path = args[0]
  } else {
    // connect(port, [host], [cb])
    options.port = args[0]
    if (typeof args[1] === 'string') {
      options.host = args[1]
    }
  }

  var cb = args[args.length - 1]
  return typeof cb === 'function' ? [options, cb] : [options]
}
