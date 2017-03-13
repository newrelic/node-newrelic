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

// taken from node master on 2017/03/13
function toNumber(x) {
  return (x = Number(x)) >= 0 ? x : false
}

function isPipeName(s) {
  return typeof s === 'string' && toNumber(s) === false
}

function normalizeConnectArgs(args) {
  if (args.length === 0) {
    return [{}, null]
  }

  var arg0 = args[0]
  var options = {}
  if (typeof arg0 === 'object' && arg0 !== null) {
    // (options[...][, cb])
    options = arg0
  } else if (isPipeName(arg0)) {
    // (path[...][, cb])
    options.path = arg0
  } else {
    // ([port][, host][...][, cb])
    options.port = arg0
    if (args.length > 1 && typeof args[1] === 'string') {
      options.host = args[1]
    }
  }

  var cb = args[args.length - 1]
  return (typeof cb === 'function') ? [options, cb] : [options, null]
}
