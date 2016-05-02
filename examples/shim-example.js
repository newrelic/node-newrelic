
newrelic = require('newrelic')

// -------------------------- //
// ---                    --- //
// --- RESTIFY IMPERATIVE --- //
// ---                    --- //
// -------------------------- //

// Add our instrumentation function to the agent.
newrelic.instrument('restify', function(shim, restify) {
  // A flag for one-off execution.
  var protoWrapped = false

  // Wrapping createServer to get at the return value.
  shim.wrap(restify, 'createServer', function(shim, createServer) {
    return function wrappedCreateServer() {
      var server = createServer.apply(this, arguments)

      // Checking the once flag.
      if (!protoWrapped) {
        protoWrapped = true
        shim.wrap(Object.getPrototypeOf(server), wrapProto)
      }

      return server
    }
  })

  function wrapProto(shim, proto) {
    // Wrap _run to hook into the start of requests to name the transaction.
    shim.wrap(proto, '_run', function wrapRun(shim, run) {
      return function wrappedRun(req, res, route) {
        // Extract the name from the route and store the current segment.
        shim.getTransaction().partialName = getRouteName(route)
        shim.storeSegment(req)

        // Now call the real run.
        return run.apply(this, arguments)
      }
    })

    // Wrap methods on the prototype.
    shim.wrap(proto, ['del', ..., 'post'], function wrapVerb(shim, verb, name) {
      return function wrappedVerb() {
        // Iterate over the arguments which may be middleware or endpoints.
        // XXX  Determining route name actually requires passing a reference
        //      and using the return value to set it.
        var argLength = arguments.length
        var args = new Array(argLength)
        var routeName = getRouteName(...)
        for (var i = 0; i < argLength; ++i) {
          args[i] = shim.record(arguments[i], makeRecordNamer(i == argLength - 1))

          // // Wrap up the arguments.
          // var segmentName = (i == argLength - 1) ? name + routeName : 'Middleware'
          // args[i] = shim.wrap(arguments[i], wrapMiddleware, [segmentName])
        }

        // Apply the function.
        return verb.apply(this, args)
      }
    })

    shim.wrap(proto, 'use', function wrapUse(shim, use) {
      return function wrappedUse() {
        // Iterate over the arguments which are all middlware.
        var argLength = arguments.length
        var args = new Array(argLength)
        for (var i = 0; i < argLength; ++i) {
          args[i] = shim.record(arguments[i], makeRecordNamer(false))

          // // Wrap each middleware
          // args[i] = shim.wrap(arguments[i], wrapMiddleware, ['Middelware'])
        }

        // Apply the function.
        return use.apply(this, args)
      }
    })
  }

  function makeRecordNamer(isRouteHandler) {
    return function recordNamer(shim, handler, handlerName, args) {
      return {
        name: isRouteHandler ? 'MyAwesomeRoute' : 'MyAwesomeMiddleware',
        metric: isRouteHandler ? ROUTE_METRIC : MIDDLEWARE_METRIC,
        parent: shim.getSegment(args[0]), // args[0]  === req
        callback: -1                      // args[-1] === next
      }
    }
  }

  // function wrapMiddleware(shim, handler, handlerName, segmentName) {
  //   // Only wrap functions.
  //   if (!shim.isFunction(handler)) {
  //     return handler
  //   }
  //   return function wrappedHandler() {
  //     // Convert the arguments to an array.
  //     var lastIndex = arguments.length - 1
  //     var args = shim.toArray(arguments)
  //
  //     // Create a new segment and bind it to the handler's `next` callback.
  //     var segment = shim.createSegment(segmentName + ' ' + handlerName)
  //     args[lastIndex] = shim.bindSegment(args[lastIndex], segment)
  //
  //     // Apply the actual handler with our segment.
  //     return shim.applySegment(handler, segment, this, args)
  //   }
  // }
})

// -------------------------------------------------------------------------- //

// --------------------------- //
// ---                     --- //
// --- RESTIFY DECLARATIVE --- //
// ---                     --- //
// --------------------------- //

// Add our instrumentation function to the agent.
newrelic.instrument('restify', {
  // Wrapping createServer to get at the return value.
  'createServer': {
    '$return': {
      '$proto': {
        // A flag for one-off execution.
        '$once': true,

        // XXX: No wrapping for _run which sets the transaction name.

        // Wrap methods on the prototype.
        '$wrap': {
          '$properties': ['del', ..., 'post'],
          // Wrap up the arguments.
          '$spec': {'$eachArgument': {'$segment': true}}

          // XXX: No distinction between middleware and route endpoints.
          // XXX: No good way to specify context-aware segment name.
        },

        // Wrap each middleware
        'use': {'$eachArgument': {'$segment': true}}
      }
    }
  }
})

// -------------------------------------------------------------------------- //

// --------------------- //
// ---               --- //
// --- RESTIFY MIXED --- //
// ---               --- //
// --------------------- //

// Add our instrumentation function to the agent.
newrelic.instrument('restify', [
  // Wrapping createServer to get at the return value.
  ['wrap', 'createServer', [
    ['return', [
      ['prototype', [
        // A flag for one-off execution.
        ['once'],

        // Wrap _run to hook into the start of requests to name the transaction.
        ['wrap', '_run', [
          ['arguments', function(shim, run, ctx, args) {
            //          0    1     2      3    4
            // args = [req, res, route, chain, cb]

            // Extract the name from the route and store the current segment.
            shim.getTransaction().partialName = getRouteName(args[2])
            shim.storeSegment(args[0])
          }]
        ]],

        // Wrap methods on the prototype.
        ['wrap', ['del', ..., 'post'], [
          ['cache', [
            // Wrap up the arguments.
            ['eachArgument', function(shim, handler, handlerName, cache, i, total) {
              var segMaker = makeHandlerSegmentNamer((i == total - 1), cache)
              return shim.wrap(handler, {'$segment': segMaker, '$callback': -1})
            }],

            // Extract the actual route name from the return value.
            ['return', function(shim, routeId, _, cache) {
              cache.routeName = getRouteName(this.router.mounts[routeId])
            }]
          ]],
        ]],

        ['wrap', 'use', [
          // Wrap each middleware
          ['eachArgument', [
            ['segment', makeHandlerSegmentNamer()],
            ['callback', -1]
          ]]
        ]]
      ]]
    ]]
  ]]
])


// Add our instrumentation function to the agent.
newrelic.instrument('restify', {
  // Wrapping createServer to get at the return value.
  'createServer': {
    '$return': {
      '$proto': {
        // A flag for one-off execution.
        '$once': true,

        // Wrap _run to hook into the start of requests to name the transaction.
        '$wrappings': [{
          '$properties': '_run',
          '$spec': {
            '$arguments': function(shim, run, ctx, args) {
              //          0    1     2      3    4
              // args = [req, res, route, chain, cb]

              // Extract the name from the route and store the current segment.
              shim.getTransaction().partialName = getRouteName(args[2])
              shim.storeSegment(args[0])
            }
          }
        }, {
          // Wrap methods on the prototype.
          '$properties': ['del', ..., 'post'],
          '$spec': {
            '$cache': true,

            // Wrap up the arguments.
            '$eachArgument': function(shim, handler, handlerName, $cache, i, total) {
              var segMaker = makeHandlerSegmentNamer((i == total - 1), $cache)
              return shim.wrap(handler, {'$segment': segMaker, '$callback': -1})
            },

            // Extract the actual route name from the return value.
            '$return': function(shim, routeId, _, $cache) {
              $cache.routeName = getRouteName(this.router.mounts[routeId])
            }
          }
        }, {
          // Wrap each middleware
          '$properties': 'use',
          '$spec': {
            '$eachArgument': {
              '$segment': makeHandlerSegmentNamer(),
              '$callback': -1
            }
          }
        }]
      }
    }
  }
})

function makeHandlerSegmentNamer(isMiddleware, $cache) {
  return function handlerSegmentNamer(shim, handler, _, args) {
    //          0    1    2
    // args = [req, res, next]
    return {
      name: (isMiddleware ? $cache.routeName : '') || shim.getName(handler),
      parent: shim.getSegment(args[0])
    }
  }
}
