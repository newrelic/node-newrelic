# OpenTelemetry Metrics

The [OpenTelemetry Metrics API](https://opentelemetry.io/docs/specs/otel/metrics/api/)
can be used to generate metrics and ship them to New Relic. The Node.js agent
includes automatic configuration of the metrics API to accomplish this task.
In order to associate metrics with the instrumented application we must wait
for the agent's bootup sequence to complete before metrics can be shipped
to New Relic. This is handled automatically by collecting metrics in memory
until the bootup sequence is complete, and then all collected metrics are
flushed.

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

const server = require('fastify')({
  logger: {
    level: 'info'
  }
})

server.route({
  path: '/',
  method: 'GET',
  handler (req, res) {
    this.metrics['test-counter'].add(1)
    res.send({ hello: 'world' })
  }
})

server.decorate('metrics', {
  'test-counter': metrics.getMeter('test-meter').createCounter('test-counter')
})

server.listen({ port: 8080 })
```

We altered this application in the following ways:

1. We imported the OpenTelemetry API.
1. We defined our counter, and then started the server.

However, a more robust method would be to wait for the agent to finish
booting before generating any metrics. This avoids any potential issues with
metrics being recorded prior to the metrics client being ready to ship data.
To do so, we'd update our application like so:

```js
'use strict'

const otel = require('@opentelemetry/api')
const metrics = otel.metrics

const server = require('fastify')({
  logger: {
    level: 'info'
  }
})

server.route({
  path: '/',
  method: 'GET',
  handler (req, res) {
    this.metrics['test-counter'].add(1)
    res.send({ hello: 'world' })
  }
})

const newrelic = require('newrelic')
newrelic.agent.on('otel-metrics-bootstrapped', () => {
  server.decorate('metrics', {
    'test-counter': metrics.getMeter('test-meter').createCounter('test-counter')
  })
  server.listen({ port: 8080 })
})
```
We altered this application in the following ways:

1. We imported the New Relic Node.js agent API.
1. We used the agent API to wait for the agent to have completed its booting
   process.
1. After the agent finished booting, we defined our counter, and then
   started the server.
