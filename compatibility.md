## Instrumented modules

After installation, the agent automatically instruments with our catalog of
supported Node.js libraries and frameworks. This gives you immediate access to
granular information specific to your web apps and servers.  For unsupported
frameworks or libraries, you'll need to instrument the agent yourself using the
[Node.js agent API](https://newrelic.github.io/node-newrelic/API.html).

**Note**: The latest supported version may not reflect the most recent supported
version.

| Package name | Minimum supported version | Latest supported version | Introduced in* |
| --- | --- | --- | --- |
| `@apollo/gateway` | 2.3.0 | 2.8.1 | `@newrelic/apollo-server-plugin@1.0.0` |
| `@apollo/server` | 4.0.0 | 4.10.4 | `@newrelic/apollo-server-plugin@2.1.0` |
| `@aws-sdk/client-bedrock-runtime` | 3.0.0 | 3.602.0 | 11.13.0 |
| `@aws-sdk/client-dynamodb` | 3.0.0 | 3.602.0 | 8.7.1 |
| `@aws-sdk/client-sns` | 3.0.0 | 3.600.0 | 8.7.1 |
| `@aws-sdk/client-sqs` | 3.0.0 | 3.600.0 | 8.7.1 |
| `@aws-sdk/lib-dynamodb` | 3.0.0 | 3.602.0 | 8.7.1 |
| `@aws-sdk/smithy-client` | 3.0.0 | 3.374.0 | 8.7.1 |
| `@elastic/elasticsearch` | 7.16.0 | 8.14.0 | 11.9.0 |
| `@grpc/grpc-js` | 1.4.0 | 1.10.9 | 8.17.0 |
| `@hapi/hapi` | 20.1.2 | 21.3.10 | 9.0.0 |
| `@koa/router` | 2.0.0 | 12.0.1 | 3.2.0 |
| `@langchain/core` | 0.1.17 | 0.2.9 | 11.13.0 |
| `@nestjs/cli` | 8.0.0 | 10.3.2 | 10.1.0 |
| `@prisma/client` | 5.0.0 | 5.15.1 | 11.0.0 |
| `@smithy/smithy-client` | 3.0.0 | 3.1.4 | 11.0.0 |
| `amqplib` | 0.5.0 | 0.10.4 | 2.0.0 |
| `apollo-server` | 2.14.0 | 3.13.0 | `@newrelic/apollo-server-plugin@1.0.0` |
| `apollo-server-express` | 2.14.0 | 3.13.0 | `@newrelic/apollo-server-plugin@1.0.0` |
| `apollo-server-fastify` | 2.14.0 | 3.13.0 | `@newrelic/apollo-server-plugin@1.0.0` |
| `apollo-server-hapi` | 3.0.0 | 3.13.0 | `@newrelic/apollo-server-plugin@1.0.0` |
| `apollo-server-koa` | 2.14.0 | 3.13.0 | `@newrelic/apollo-server-plugin@1.0.0` |
| `apollo-server-lambda` | 2.14.0 | 3.13.0 | `@newrelic/apollo-server-plugin@1.0.0` |
| `aws-sdk` | 2.2.48 | 2.1646.0 | 6.2.0 |
| `bluebird` | 2.0.0 | 3.7.2 | 1.27.0 |
| `bunyan` | 1.8.12 | 1.8.15 | 9.3.0 |
| `cassandra-driver` | 3.4.0 | 4.7.2 | 1.7.1 |
| `connect` | 2.0.0 | 3.7.0 | 2.6.0 |
| `director` | 1.2.0 | 1.2.8 | 2.0.0 |
| `express` | 4.6.0 | 4.19.2 | 2.6.0 |
| `fastify` | 2.0.0 | 4.28.0 | 8.5.0 |
| `generic-pool` | 2.4.0 | 3.9.0 | 0.9.0 |
| `ioredis` | 3.0.0 | 5.4.1 | 1.26.2 |
| `kafkajs` | 2.0.0 | 2.2.4 | 11.19.0 |
| `koa` | 2.0.0 | 2.15.3 | 3.2.0 |
| `koa-route` | 2.0.0 | 4.0.1 | 3.2.0 |
| `koa-router` | 2.0.0 | 12.0.1 | 3.2.0 |
| `memcached` | 2.2.0 | 2.2.2 | 1.26.2 |
| `mongodb` | 2.1.0 | 6.7.0 | 1.32.0 |
| `mysql` | 2.2.0 | 2.18.1 | 1.32.0 |
| `mysql2` | 2.0.0 | 3.10.1 | 1.32.0 |
| `next` | 13.0.0 | 14.2.4 | `@newrelic/next@0.7.0` |
| `openai` | 4.0.0 | 4.52.0 | 11.13.0 |
| `pg` | 8.2.0 | 8.12.0 | 9.0.0 |
| `pg-native` | 2.0.0 | 3.1.0 | 9.0.0 |
| `pino` | 7.0.0 | 9.2.0 | 8.11.0 |
| `q` | 1.3.0 | 1.5.1 | 1.26.2 |
| `redis` | 2.0.0 | 4.6.14 | 1.31.0 |
| `restify` | 5.0.0 | 11.1.0 | 2.6.0 |
| `superagent` | 2.0.0 | 9.0.2 | 4.9.0 |
| `undici` | 4.7.0 | 6.19.2 | 11.1.0 |
| `when` | 3.7.0 | 3.7.8 | 1.26.2 |
| `winston` | 3.0.0 | 3.13.0 | 8.11.0 |

*When package is not specified, support is within the `newrelic` package.

## AI Monitoring Support

The Node.js agent supports the following AI platforms and integrations.

### Amazon Bedrock

Through the `@aws-sdk/client-bedrock-runtime` module, we support:

| Model | Image | Text | Vision |
| --- | --- | --- | --- |
| AI21 Labs Jurassic-2 | ❌ | ✅ | - |
| Amazon Titan | ❌ | ✅ | - |
| Anthropic Claude | ❌ | ✅ | ❌ |
| Cohere | ❌ | ✅ | - |
| Meta Llama2 | ❌ | ✅ | - |

Note: if a model supports streaming, we also instrument the streaming variant.


### Langchain

The following general features of Langchain are supported:

| Agents | Chains | Tools | Vectorstores |
| --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ |

Models/providers are generally supported transitively by our instrumentation of the provider's module.

| Provider | Supported | Transitively |
| --- | --- | --- |
| Azure OpenAI | ❌ | ❌ |
| Amazon Bedrock | ❌ | ❌ |
| OpenAI | ✅ | ✅ |


### OpenAI

Through the `openai` module, we support:

| Audio | Chat | Completions | Embeddings | Files | Images |
| --- | --- | --- | --- | --- | --- |
| ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |

