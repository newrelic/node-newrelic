### Pre-requisite

{@tutorial Instrumentation-Basics}

### Introduction

This tutorial covers basic concepts of the Messaging instrumentation API.

Modules that interact with message brokers will typically provide:

* a function to publish a message
* a function to receive (consume) messages

Publishing a message typically occurs as a part of an existing transaction. For example, an Express server receives an HTTP request, publishes a message to a message broker, and responds to the HTTP request. In this case, the interesting information to capture would be how long the publish operation took as well as any identifying information about the publish operation, such as the name of the queue we were publishing to.

``` javascript
var client = createMessageBrokerClient()

// express server
var app = express()

app.get('/', function(req, res) {
  client.publish('queueName', 'some message', function(err) {
    res.end()
  })
})
```

Consuming messages can take two forms: Either the client pulls a message from a queue, or it subscribes to receive messages as they become available (pub/sub pattern).

Pulling a message from the queue is a one-off operation, which is typically part of an existing transaction (similar to the publish example above). With the pub/sub pattern, the application is continuously listening to incoming messages, and therefore receiving a message does not necessarily occur inside an existing transaction. Instead, it is comparable to receiving an HTTP request, and can be thought of as a start of a new transaction.

Here is an example of a client subscribing to receive messages:

``` javascript
var client = createMessageBrokerClient()

client.subscribe('queueName', function consumeMessage(message) {
  // get current transaction, in order to later signal that it should be ended
  var transaction = newrelic.getTransaction()

  // do something with the message and when done, end the transaction
  processMessage(message, function(err) {
    transaction.end()
  })
})
```

Every time `consumeMessage` is called, we want to record the duration and other details about the operation. Since the calls are not part of an existing web transaction, the API will automatically start a new transaction.

### The Instrumentation Function

Now that we have established what to instrument, let's start writing our instrumentation. First, we need to create a function that will contain our instrumentation:

```js
function instrumentMyMessageBroker(shim, messageBrokerModule, moduleName) {
}
```

The instrumentation function receives the following arguments:

* [shim]{@link MessageShim}

  The API object that contains methods for performing instrumentation.

* messageBrokerModule

  The loaded module that should be instrumented.

* moduleName

  The name of the loaded module. This is useful if the same instrumentation function was used to instrument multiple modules.

The function can be included in the application code itself, or it can live in a separate instrumentation module. In either case, we need to register it in our application code in order for the agent to use it. This is done in our application by calling {@link API#instrumentMessages}:

```js
var newrelic = require('newrelic')
newrelic.instrumentMessages('myMessageBroker', instrumentMyMessageBroker)
```

As a result, the agent will call our instrumentation function when the message broker module is required in the user's application code. For more details, see {@tutorial Instrumentation-Basics}.

### Specifying the Message Broker

Now that we have bootstrapped our instrumentation function, we can proceed with its implementation.

The first thing the instrumentation should specify is the name of the message broker that the library being instrumented applies to. The value is used as a part of the metric names.

```js
  shim.setLibrary(shim.RABBITMQ)
```

<div style="text-align:center">
  ![transaction breakdown](./messaging-breakdown-table.png)
</div>

### Producing Messages

An application can publish a message to the broker. When this happens as part of a transaction, the agent can record this call to the broker as a separate segment in the transaction trace.

```js
var Client = myMessageBrokerModule.Client

shim.recordProduce(Client.prototype, 'publish', function(shim, fn, name, args) {
  // get queue name from args
  var queuName = args[0]
  return {
    destinationName: queueName,
    destinationType: shim.QUEUE
  }
})
```

The call would be displayed in the transaction trace as:

<div style="text-align:center">
  ![transaction trace with produce segment](./messaging-produce-segment.png)
</div>

The agent will also record a metric that can be be queried in Insights. The format of the metric is:  `MessageBroker/[libraryName]/Queue/Produce/Named/[queueName]`.

### Consuming Messages

An application can consume messages from the broker's queues. The mechanism for consuming messages can vary based on the broker and type of queues. Messages can either be consumed by the client explicitly asking for a message (e.g. a worker-queue pattern), or it can subscribe to a queue and receive messages as they become available (pub/sub pattern).

We want to record the handler function that is registered in user's code. In order to get to the function, we need to wrap the consume function first.

#### Pull pattern

Let's assume that the client has a method `getMessage`. When the client calls this, the message broker returns a message from the requested queue. The instrumentation of this method would like this:

``` js
var Client = myMessageBrokerModule.Client

shim.recordConsume(Client.prototype, 'getMessage', function(shim, fn, name, args) {
  // ... get details from args
  return {
    destinationName: name,
    destinationType: type
  }
})
```

The call would be displayed in the transaction trace as:

<div style="text-align:center">
  ![transaction trace with consume segment](./messaging-consume-segment.png)
</div>

The agent will also record a metric that can be be queried in Insights. The format of the metric is `MessageBroker/[libraryName]/Queue/Produce/Named/[queueName]`.

#### Pub/sub pattern

For listening to messages sent by the broker, let's assume that the client has a `subscribe` method, which registers a function for processing messages when they are received. The instrumentation in this case would like This:

``` js
var Client = myMessageBrokerModule.Client

shim.recordSubscribedConsume(Client.prototype, 'subscribe', {
  queue: shim.FIRST,
  consumer: shim.LAST,
  wrapper: function(shim, consumer, name, queue) {
    return shim.recordConsume(consumer, function(shim, fn, name, args) {
      // ... get details from args
      return {
        destinationName: name,
        destinationType: type
      }
    })
  }
})
```

There are two parts to this. First, we instrument the method for subscribing to a queue by calling [`recordSubscribedConsume`]{@link MessageShim#recordSubscribedConsume}. Here we tell the instrumentation which argument is the name of the queue, and which is the message handler function (referred to as `consumer`). The `wrapper` parameter is a function used to wrap the consumer function. Here we simply use the [`recordConsume`]{@link MessageShim#recordConsume} API method, which will work the same as in the case pulling messages on demand.

### Questions?

We have an extensive [help site](https://support.newrelic.com/) as well as
[documentation](https://docs.newrelic.com/). If you can't find your answers
there, please drop us a line on the [community forum](https://discuss.newrelic.com/).
