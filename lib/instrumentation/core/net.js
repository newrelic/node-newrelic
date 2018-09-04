'use strict'

module.exports = function initialize(agent, net, moduleName, shim) {
  shim.wrap(net, ['connect', 'createConnection'], wrapCreate)
  function wrapCreate(shim, fn, name) {
    return function wrappedCreateConnection() {
      const segment = shim.getActiveSegment()
      if (!segment) {
        return fn.apply(this, arguments)
      }

      const child = shim.createSegment('net.' + name, null, segment)
      const sock = shim.applySegment(fn, child, true, this, arguments)
      wrapSocket(sock, child)
      return sock
    }
  }

  const serverProto = net.Server.prototype

  shim.wrap(serverProto, ['listen', 'close'], function wrapNoRecord(shim, fn) {
    return function wrappedNoRecord() {
      if (!shim.getActiveSegment()) {
        return fn.apply(this, arguments)
      }

      const args = shim.argsToArray.apply(shim, arguments)
      const cbIndex = args.length - 1

      shim.bindSegment(args, cbIndex)

      return fn.apply(this, args)
    }
  })

  shim.wrap(serverProto, '_listen2', wrapListen2)
  shim.wrap(net.Socket.prototype, 'connect', wrapConnect)

  function wrapListen2(shim, fn) {
    return function wrappedListen2() {
      const segment = shim.getActiveSegment()
      const emit = this.emit

      if (!segment || !emit) return fn.apply(this, arguments)

      this.emit = wrappedEmit

      return fn.apply(this, arguments)

      function wrappedEmit(ev, socket) {
        if (ev !== 'connection' || !socket || !socket._handle) {
          return emit.apply(this, arguments)
        }

        const child = shim.createSegment('net.Server.onconnection', segment)

        if (socket._handle.onread) {
          shim.bindSegment(socket._handle, 'onread', child)
        }

        return shim.applySegment(emit, child, true, this, arguments)
      }
    }
  }

  function wrapConnect(shim, fn) {
    return function connectWrapper() {
      if (!agent.getTransaction()) {
        return fn.apply(this, arguments)
      }

      const socket = this
      const args = normalizeConnectArgs(arguments)

      const segment = shim.createSegment('net.Socket.connect')

      if (args[1]) {
        args[1] = shim.bindSegment(args[1], segment)
      }

      const result = shim.applySegment(fn, segment, true, this, args)

      if (socket._handle) {
        shim.bindSegment(socket._handle, 'onread', segment)
      }
      shim.bindSegment(socket, 'emit', segment)

      return result
    }
  }

  function wrapSocket(sock, segment) {
    shim.wrap(sock, 'emit', function emitWrapper(shim, fn) {
      return shim.bindSegment(fn, segment)
    })
  }
}

// taken from node master on 2013/10/30
function normalizeConnectArgs(args) {
  let options = Object.create(null)

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

  const cb = args[args.length - 1]
  return typeof cb === 'function' ? [options, cb] : [options]
}
