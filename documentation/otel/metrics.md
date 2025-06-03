# OpenTelemetry Metrics

The [OpenTelemetry Metrics API](https://opentelemetry.io/docs/specs/otel/metrics/api/)
can be used to generate metrics and ship them to New Relic. The Node.js agent
includes automatic configuration of the metrics API to accomplish this task.
However, in order for the data to be correctly attached to the instrumented
application, a bit of extra setup is needed.

Consider this basic [Fastify](https://fastify.dev/) application:

```js
'use strict'

const server = require('fastify')({
  logger: {
    level: 'info'
  }
})

server.route({
  path: '/',
  method: 'GET',
  handler (req, res) {
    res.send({ hello: 'world' })
  }
})

server.listen({ port: 8080 })
```

Assuming we want to add a counter to the handler, we would modify the
application like so:

```js
'use strict'

const otel = require('@opentelemetry/api')
const metrics = otel.metrics
let counter

const server = require('fastify')({
  logger: {
    level: 'info'
  }
})

server.route({
  path: '/',
  method: 'GET',
  handler (req, res) {
    counter.add(1)
    res.send({ hello: 'world' })
  }
})

const newrelic = require('newrelic')
newrelic.agent.on('started', () => {
  counter = metrics.getMeter('test-meter').createCounter('test-counter')
  server.listen({ port: 8080 })
})
```

We altered this application in the following ways:

1. We imported the OpenTelemetry API.
1. We imported the New Relic Node.js agent API.
1. We used the agent API to wait for the agent to have completed its booting
  process.
1. After the agent finished booting, we defined our counter, and then
  started the server.
