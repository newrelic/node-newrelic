'use strict'

function getQuery(shim, original, name, args) {
  var config = args[0]
  var statement
  if (config && (typeof config === 'string' || config instanceof String)) {
    statement = config
  } else if (config && config.text) {
    statement = config.text
  } else {
    // Won't be matched by parser, but should be handled properly
    statement = 'Other'
  }
  return statement
}

module.exports = function initialize(agent, pgsql, moduleName, shim) {
  shim.setDatastore(shim.POSTGRES)
  // allows for native wrapping to not happen if not necessary
  // when env var is true

  if (process.env.NODE_PG_FORCE_NATIVE) {
    return instrumentPGNative(pgsql)
  }

  // wrapping for native
  function instrumentPGNative(pg) {
    var constructors = [
        pg,
        pg.pools
      ]

    constructors.forEach(function cb_forEach(obj) {
      shim.wrapReturn(obj, 'Client', wrapClient)
    })
  }

  function wrapClient(shim, fn, fnName, connection) {
    if (typeof connection === 'undefined') connection = this

    shim.recordQuery(connection, 'query', {
      callback: shim.LAST,
      query: getQuery,
      stream: 'row',
      extras: {
        host: connection.host,
        port: connection.port
      },
      internal: false
    })

    shim.record(connection, 'connect', function pgConnectNamer() {
      return {
        name: 'connect',
        callback: shim.LAST
      }
    })
  }

  // The pg module defines "native" getter which sets up the native client lazily
  // (only when called).  We replace the getter, so that we can instrument the native
  // client.  The original getter replaces itself with the instance of the native
  // client, so only instrument if the getter exists (otherwise assume already
  // instrumented).
  var origGetter = pgsql.__lookupGetter__('native')
  if (origGetter) {
    delete pgsql.native
    pgsql.__defineGetter__('native', function getNative() {
      var temp = origGetter()
      instrumentPGNative(temp)
      return temp
    })
  }

  // wrapping for JS
  shim.recordQuery(
    pgsql && pgsql.Client && pgsql.Client.prototype,
    'query',
    {
      callback: shim.LAST,
      query: getQuery,
      stream: 'row',
      internal: false
    }
  )
}
