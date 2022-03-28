# The Philosophy of Naming Your Node Agent Transactions

For Express and similar frameworks based on routing with middleware, we follow a transaction naming pattern that can differ from other language agents.

Below is the philosophy, ported from a discussion forum post, for these sorts of frameworks. Some newer frameworks have started diverging from the approach based on how the framework behaves but even in those cases this will help explain some of the philosophy.

The original forum post lives here: [Relic Solution: The Philosophy of Naming Your Node Agent Transactions](https://discuss.newrelic.com/t/relic-solution-the-philosophy-of-naming-your-node-agent-transactions).

---

The Node Agent uses a different naming scheme for transactions than the other APM agents. Other agents use the name of the class or method that handles the response. This provides a very simple and precise name for transactions but it does not jive well with Node web frameworks.

The predominant paradigm of Node web frameworks is middleware. When constructing your web server, you push functions onto a server, possibly along with part of a URL which filters the requests the functions handle. These route handling functions are called middleware and the piece of URL that filters requests is the mounting path. Often these functions have no name so we can’t name the transaction after it.

Thus the Node Agent names its transactions using the mounting paths of middleware. For the most part this is a very simple concept, but it has a few gotchas. We often get support tickets asking why a transaction is named a certain way and why a [metric grouping issue](https://docs.newrelic.com/docs/agents/manage-apm-agents/troubleshooting/metric-grouping-issues) has occurred. In order to reduce confusion, we try to follow certain patterns when developing instrumentation. Our naming philosophy can be broken down into the following Rules of Naming:

1. Names are routes, routes are names.
2. Routes stack.
3. Middleware that responds is the transaction name.
4. Errors don’t reset naming.
5. 404s get special names.
6. Everything else gets the URI.

## The Application

Below is a simple Express application which I’ll be referring to while exploring each of [the Rules](#the-rules) of naming. Express is the most popular web framework for Node, enjoying nearly 20 million downloads a month. The parts of the application will be dissected as each rule is discussed, so don’t worry about understanding every bit of it. Briefly, it is a web server with a two endpoints: a health check mounted on `/ping` and a user lookup mounted on `/users/:userId`. The `:userId` part indicates a route parameter which can take on any value.

```js
const newrelic = require('newrelic');
const express = require('express');
const db = require('./lib/db');

const app = express();
const users = new express.Router();

app.use(function middlewareOne(req, res, next) {
  // This is called for every request to the server.

  // In Express, calling `next()` indicates that this middleware is
  // done.
  next();
});

app.use('/users', function middlewareTwo(req, res, next) {
  // This is only called for requests that begin with `/users`. Both
  // `/users` and `/users/1234` would pass through this middleware.

  next();
});

app.get('/ping', function pingEndpoint(req, res, next) {
  // This endpoint middleware will be called for any request matching
  // exactly `/ping`.

  res.send('pong');

  // Whenever your middleware sends something in Express, it should
  // not call `next()`.
});

// With this line, the `users` router will be used for any requests
// that begin with `/users`, just like `middlewareTwo`.
app.use('/users', users);

users.get('/:userId', function endpoint(req, res, next) {
  // This endpoint middleware will be called for any request matching
  // `/users` followed by some value. For example, `/users/1234`
  // would enter this middleware but `/users` would not.

  db.findUser(req.params.userId, function(err, user) {
    // Errors are handled in Express by passing them to `next()` so
    // that any errorware can take care of them.
    if (err) {
      next(err);
      return;
    }

    // Endpoint middleware should send responses back. Whenever your
    // middleware sends something in Express, it should not call
    // `next()`.
    res.send({user: user});
  });
});

app.use(function errorware(err, req, res, next) {
  // This is an error middleware. In Express, these are denoted by
  // having 4 parameters to the middleware. Yes, that's right, the
  // arity of the function matters.

  res.send(500, 'Oops!');

  // In Express, the errorware should not call `next()` if it handled
  // the error. In our case, it has handled the error by responding
  // with "Oops!".
});

app.listen(8080);
```

## The Rules

### Names Are Routes, Routes Are Names

As already mentioned, the Node Agent uses the route for a given request as the transaction name. This route is defined by the mounting point of the middleware. The mounting point or mount path is the piece of URI used to filter requests that the middleware will handle. From the example above, if the request `GET /ping HTTP/1.1` came, we would name the corresponding transaction get `/ping`. If this were a Python application, the transaction would have been named something like `pingEndpoint` after the function that handled the request.

### Routes Stack

In many web frameworks it is possible to mount routers as middleware on other routers. This is known as the Router Stack. In order to keep track of this, the Node Agent uses a Name Stack. Every time we enter a middleware (i.e. that middleware is called), the route it was mounted on is pushed onto the Name Stack.

From the example above, the `middlewareTwo` middleware is mounted on the application at `'/users'`. When that middleware is entered, we’ll push `/users` onto the Name Stack. When this middleware calls `next()` we’ll pop its name back off the Name Stack.

The reason for this is better illustrated by routers like the users router. This router is mounted on the application as `'/users'` and the endpoint middleware is mounted on it as `'/:userId'`. We will push `/users` and then `/:userId` onto the Name Stack as users and endpoint are entered respectively. If endpoint called `next()` instead of responding, its mount point (`/:userId`) would be popped off. If no middleware on the users router responds, then the router’s mount point (`/users`) would also be popped off the Name Stack as well. Whatever is on the Name Stack when the transaction ends is what the transaction will be named.

### Middleware That Responds Is The Transaction Name

Not all middleware need to respond to the requests they handle. Usually, only one middleware per route does the responding. Often this responding middleware is referred to as the “endpoint” because it is where the request ends. How the Node Agent detects that a response is sent depends on the web framework. For Express it is the middleware that calls `res.send()`.

When this happens, we “freeze” the Name Stack mentioned in Routes Stack. This freezing simply means that no further changes will happen to the Name Stack. This is important because after `res.send()` is called the Router Stack unwinds and all entered middleware exit. If the Name Stack was not frozen we would pop each element off and lose the name of the transaction.

This means that when our endpoint middleware calls `res.send({user: user})` the Name Stack becomes frozen as `['/users', '/:userId']`. At the end of the transaction this Name Stack is joined together and the transaction is named get `/users/:userId`.

### Errors Do Not Reset Naming

Everything falls apart when error handling enters the picture. In most frameworks you provide a single point of error handling. In Express this is usually done by mounting a middleware that takes 4 parameters as the last middleware. Then any middleware which calls `next(err)` will cause the error middleware (or errorware) to execute.

Since there is usually only one error handler, it would not be helpful if we named all transactions that have an error after the error handler’s mount point, even though it is the one that responds. To keep the transaction name more informative we don’t pop the mount point off the Name Stack if the middleware results in an error. This way, when the transaction ends, the mount path of the erroring middleware is used to name the transaction.

In our example above, this could happen if `db.findUser()` results in an error. In that case, endpoint calls `next()` with the error. The Node Agent notices this and does not pop from the Name Stack. Since there is no errorware mounted on the users router, it will also call `next()` with the error internally. Finally, Express will call our errorware middleware which then responds. Since `errorware` calls `res.send()`, the Name Stack will be frozen at that point, with the mount path for endpoint still on it. Thus the transaction will be named get `/users/:userId`.

### 404s Get Special Names

If no middleware sends a response (e.g. none call `res.send()`), then most frameworks will respond with an auto-generated Not Found page. In this situation, the Name Stack mentioned in [Routes Stack](#routes-stack) is empty when the response is sent and the response status code is `404`. When this happens we name the transaction something special: `method (not found)`. For example, the request `POST /this/route/is/not/handled HTTP/1.1` would result in a transaction named `post (not found)`.

Note that if a user middleware responds with a `404` from within a middleware then the [Middleware That Responds Is The Transaction Name](#middleware-that-responds-is-the-transaction-name) rule takes precedence. As mentioned in that rule, the Name Stack is frozen by that middleware and thus will not be empty when this rule is checked.

### Everything Else Gets The URI

There are some edge cases where no middleware will send a response but the result is not a `404`. Like with [404s Get Special Names](#404s-get-special-names), this means the Name Stack is empty when the transaction is named, however the status code will be something other than `404`. This usually is a sign of an uninstrumented feature of either the web framework or some other module. When this happens, we pass the requested URI through transaction and metric naming rules and create a `NormalizedUri` transaction. Often these rules fail to squash all dynamic URI parts and a metric grouping issue explodes.

We’ve often discussed ideas for improving these naming rules, using Markov chains or other predictive algorithms, or taking a page from Browser’s naming schemes. Usually the right solution in the moment is just for us to fix the instrumentation that is failing to name the transactions. This fixes the symptoms for the customer, but does leave the systemic issue lingering.

## Breaking The Rules

The following are examples of applications which break, bend, or otherwise abuse these rules.

### Name Is Not A Route

```js
const newrelic = require('newrelic');
const express = require('express');

const app = express();

app.get('/beep', function(req, res, next) {
  // Use the agent’s API to set the transaction name.
  newrelic.setTransactionName('My Cool Transaction Name');

  res.send('boop');
});

app.listen(8080);
```

Users can name their transactions whatever they like with the agent’s API. These names obviously don’t have to be routes. Custom names are also always rendered with a prefixed “/” so this transaction would be named `/My Cool Transaction Name`.

### Middleware That Responds Is Not The Transaction

```js
const newrelic = require('newrelic');
const express = require('express');

const app = express();

app.get('/beep', function(req, res, next) {
  res.respondWith = 'boop';
  next();
});

app.get('/ping', function(req, res, next) {
  res.respondWith = 'pong';
  next();
});

app.use('/:wat', function(req, res, next) {
  // All responses come from this middleware.
  res.send(res.respondWith);
});

app.listen(8080);
```

All requests to this server will be called get `/:wat`. We have seen support tickets involving this. The idea is that these services have some logic around constructing the response that every endpoint needs. Rather than putting this logic into an earlier middleware or into a function that all endpoints call, they put it into a final middleware.

### Errors Change The Name

```js
const newrelic = require('newrelic');
const express = require('express');

const app = express();

app.get('/foo', function(req, res, next) {
  next(new Error('woops!'));
});

app.use('/:wat', function(err, req, res, next) {
  // Send the response from the error handler.
  res.send(500, 'Oh no!');
});

app.listen(8080);
```

The transaction here could be named get `/foo/:wat` even though the request was `GET /foo HTTP/1.1`. In Express we actually do handle this case, but in other frameworks like Hapi it is harder to detect we’re in an error scenario like this. This can result in customer support tickets from customers confused about oddly named transactions that don’t match with any of their routes.

### 404 Is Not Named Not Found

```js
const newrelic = require('newrelic');
const express = require('express');
const db = require('./lib/db');

const app = express();

app.get('/users/:userId', function(req, res, next) {
  db.findUser(req.params.userId, function(err, user) {
    if (err) {
      next(err);
      return;
    }

    // If the user isn't found, 404!
    if (!user) {
      res.send(404, 'User not found');
    } else {
      res.send({user: user});
    }
  });
});

app.listen(8080);
```

A `404` sent from within this endpoint will be named get `/users/:userId`. This is a feature, but it is important to remember that not all 404s result in (not found).

### Everything Else Gets The URI

```js
const newrelic = require('newrelic');
const express = require('express');
const http = require('http');

const app = express();

const server = http.createServer(function(req, res) {
  // Check for `break` in the request path.
  if (/break/.test(req.path)) {
    res.write('broken');
    res.end();
  } else {
    app(req, res);
  }
});

app.use(function(req, res, next) {
  res.send('working');
});

server.listen(8080);
```

Any request to this server whose path contains break will result in a `NormalizedUri` transaction name. Requests with dynamic parts, such as hexadecimal or base64 encoded blobs will likely result in an metric grouping issue. Our advice is to ignore these transactions either using our [ignore rules](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/api-guides/nodejs-agent-api/#rules-ignore) or by calling [`transaction.ignore()`](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/api-guides/nodejs-agent-api/#transaction-handle-ignore).
