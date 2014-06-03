/*
 *
 * CONSTANTS
 *
 */

var ORIGINAL = '__NR_original';
var RESERVED = [ // http://es5.github.io/#x7.6.1.2
  // always (how would these even get here?)
  'class', 'enum', 'extends', 'super', 'const', 'export', 'import',
  // strict
  'implements', 'let', 'private', 'public', 'yield', 'interface',
  'package', 'protected', 'static'
];

/**
 * ES5 strict mode disallows some identifiers that are allowed in non-strict
 * code. Mangle function names that are on that list of keywords so they're
 * non-objectionable in strict mode (which is currently enabled everywhere
 * inside the agent, as well as at many customer sites).
 *
 * If you really need to crawl your Express app's middleware stack, change
 * your test to use name.indexOf('whatever') === 0 as the predicate instead
 * of name === 'whatever'. It's a little slower, but you shouldn't be doing
 * that anyway.
 *
 * @param {string} name The candidate function name
 *
 * @returns {string} A safe (potentially mangled) function name.
 */
function mangle(name) {
  if (RESERVED.indexOf(name) !== -1) return name + '_';

  return name;
}

/**
 * Problem:
 *
 * 1. Express determines whether middleware functions are error handlers by
 *    testing their arity. Not cool.
 * 2. Downstream Express users rely upon being able to iterate over their
 *    middleware stack to find specific middleware functions. Sorta less
 *    uncool, but still a pain.
 *
 * Solution:
 *
 * Use eval. This once. For this one specific purpose. Not anywhere else for
 * any reason.
 */
function wrapHandle(handle, tracer) {
  var arglist
    , name = ''
    ;

  // reiterated: testing function arity is stupid
  switch (handle.length) {
    case 2:
      arglist = '(req, res)';
      break;

      case 3:
      arglist = '(req, res, next)';
      break;

    // don't break other error handlers
    case 4:
      arglist = '(err, req, res, next)';
      break;

    default:
      arglist = '()';
  }

  if (handle.name) name = mangle(handle.name);

  // leave this function anonymous due to connect madness
  var template = function () {
    var args = tracer.slice(arguments)
      , last = args.length - 1
      ;

    if (typeof args[last] === 'function') {
      args[last] = tracer.callbackProxy(args[last]);
    }

    handle.apply(this, args);
  };

  // I am a bad person and this makes me feel bad. We use eval because we need
  // to insert the function with a specific name to allow for lookups.
  // jshint evil:true
  var wrapped = eval(
    '(function(){return function ' + name + arglist +
    template.toString().substring(11) + '}())'
  );
  wrapped[ORIGINAL] = handle;
  // jshint evil:false

  return wrapped;
}

/**
 * Middleware wrapper
 *
 * This takes 5 arguments, 4 of which are passed in by the instrumentation,
 * the last being the function being wrapped.
 *
 * `route` is the whether what is being added is a route (and therefore
 * already instrumented) or if it is a middleware.
 *
 * `interceptor` is the full error interceptor object.
 *
 * `sentinel` is the inner error interceptor function.
 *
 * Only one of those two should be set. Either you pass in an `interceptor`
 * and you are doing connect instrumentation, or you pass `sentinel` and are
 * doing express 4+ instrumentation.
 *
 * `tracer` is the `agent.tracer` object.
 *
 * `use` is the middleware adding function.
 */
function wrapMiddlewareStack(route, interceptor, sentinel, tracer, use) {
  return function cls_wrapMiddlewareStack() {
    var myInterceptor = interceptor || null;
    if (this.stack && this.stack.length) {
      this.stack = this.stack.filter(function cb_filter(m) {
        if (interceptor !== null) {
          return m !== interceptor;
        }
        // If we are looking for a sentinel and find it, then store the
        // interceptor so we don't have to make a new one based on the sentinel.
        if (sentinel !== null) {
          if (m.handle !== sentinel) {
            return true;
          } else {
            myInterceptor = m;
            return false;
          }
        }
      });
    }

    if (myInterceptor === null) {
      // call use to create a Layer object, then pop it off and store it.
      use.call(this, '/', sentinel);
      if (this.stack[this.stack.length-1].handle.name === 'sentinel') {
        myInterceptor = this.stack.pop();
      }
    }

    /* We allow `use` to go through the arguments so it can reject bad things
     * for us so we don't have to also do argument type checking.
     */
    var app = use.apply(this, arguments);

    // If there is no stack after calling `use` short circuit.
    if (!this.stack) return app;

    /* Express adds routes to the same stack as middlewares. We need to wrap
     * that adder too but we only want to wrap the middlewares that are
     * added, not the Router.
     */
    if (!route) {
      // wrap most recently added unwrapped handler
      var top = this.stack[this.stack.length-1];
      if (top) {
          if (top.handle &&
              typeof top.handle === 'function' &&
              !top.handle[ORIGINAL]) {
            top.handle = wrapHandle(top.handle, tracer);
          }
      }
    }

    /* Give the error tracer a better chance of intercepting errors by
     * putting it before the first error handler (a middleware that takes 4
     * parameters, in express's world). Error handlers tend to be placed
     * towards the end of the middleware chain and sometimes don't pass
     * errors along. Don't just put the interceptor at the beginning because
     * we want to allow as many middleware functions to execute as possible
     * before the interceptor is run, to increase error coverage.
     *
     * NOTE: This is heuristic, and works because interceptor propagates
     *       errors instead of terminating the middleware chain.
     *       Ignores routes.
     */
    var spliced = false;
    for (var i = 0; i < this.stack.length; i++) {
      var middleware = this.stack[i];
      // Check to see if it is an error handler middleware
      if (middleware &&
          middleware.handle &&
          middleware.handle.length === 4) {
        this.stack.splice(i, 0, myInterceptor);
        spliced = true;
        break;
      }
    }
    if (!spliced) this.stack.push(myInterceptor);

    // don't break chaining
    return app;
  };
}

module.exports.wrapMiddlewareStack = wrapMiddlewareStack;
