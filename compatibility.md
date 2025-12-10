## Instrumented modules

After installation, the agent automatically instruments with our catalog of
supported Node.js libraries and frameworks. This gives you immediate access to
granular information specific to your web apps and servers.  For unsupported
frameworks or libraries, you'll need to instrument the agent yourself using the
[Node.js agent API](https://newrelic.github.io/node-newrelic/API.html).

**Note**: The latest published version may not reflect the most recent version
supported by the agent.

| Package name | Minimum supported version | Latest published version | Introduced in* |
| --- | --- | --- | --- |
| `@apollo/gateway` | 2.3.0 | 2.12.2 | `@newrelic/apollo-server-plugin@1.0.0` |
| `@apollo/server` | 4.0.0 | 5.2.0 | `@newrelic/apollo-server-plugin@2.1.0` |
| `@aws-sdk/client-bedrock-runtime` | 3.474.0 | 3.948.0 | 11.13.0 |
| `@aws-sdk/client-dynamodb` | 3.0.0 | 3.948.0 | 8.7.1 |
| `@aws-sdk/client-sns` | 3.0.0 | 3.948.0 | 8.7.1 |
| `@aws-sdk/client-sqs` | 3.0.0 | 3.948.0 | 8.7.1 |
| `@aws-sdk/lib-dynamodb` | 3.377.0 | 3.948.0 | 8.7.1 |
| `@aws-sdk/smithy-client` | 3.47.0 | 3.374.0 | 8.7.1 |
| `@azure/functions` | 4.7.0 | 4.10.0 | 12.18.0 |
| `@elastic/elasticsearch` | 7.16.0 | 9.2.0 | 11.9.0 |
| `@google/genai` | 1.1.0 | 1.32.0 | 12.21.0 |
| `@grpc/grpc-js` | 1.4.0 | 1.14.2 | 8.17.0 |
| `@hapi/hapi` | 20.1.2 | 21.4.4 | 9.0.0 |
| `@koa/router` | 12.0.1 | 15.0.0 | 3.2.0 |
| `@langchain/core` | 0.1.17 | 1.1.4 | 11.13.0 |
| `@modelcontextprotocol/sdk` | 1.13.0 | 1.24.3 | 13.2.0 |
| `@nestjs/cli` | 9.0.0 | 11.0.14 | 10.1.0 |
| `@opensearch-project/opensearch` | 2.1.0 | 3.5.1 | 12.10.0 |
| `@prisma/client` | 5.0.0 | 7.1.0 | 11.0.0 |
| `@smithy/smithy-client` | 2.0.0 | 4.9.10 | 11.0.0 |
| `amqplib` | 0.5.0 | 0.10.9 | 2.0.0 |
| `aws-sdk` | 2.2.48 | 2.1693.0 | 6.2.0 |
| `bluebird` | 2.0.0 | 3.7.2 | 1.27.0 |
| `bunyan` | 1.8.12 | 1.8.15 | 9.3.0 |
| `cassandra-driver` | 3.4.0 | 4.8.0 | 1.7.1 |
| `connect` | 3.0.0 | 3.7.0 | 2.6.0 |
| `express` | 4.15.0 | 5.2.1 | 2.6.0 |
| `fastify` | 3.0.0 | 5.6.2 | 8.5.0 |
| `generic-pool` | 3.0.0 | 3.9.0 | 0.9.0 |
| `ioredis` | 4.0.0 | 5.8.2 | 1.26.2 |
| `kafkajs` | 2.0.0 | 2.2.4 | 11.19.0 |
| `koa` | 2.0.0 | 3.1.1 | 3.2.0 |
| `koa-route` | 3.0.0 | 4.0.1 | 3.2.0 |
| `koa-router` | 12.0.1 | 14.0.0 | 3.2.0 |
| `memcached` | 2.2.0 | 2.2.2 | 1.26.2 |
| `mongodb` | 4.1.4 | 7.0.0 | 1.32.0 |
| `mysql` | 2.16.0 | 2.18.1 | 1.32.0 |
| `mysql2` | 2.0.0 | 3.15.3 | 1.32.0 |
| `next` | 13.4.19 | 16.0.8 | 12.0.0 |
| `openai` | 4.0.0 | 6.10.0 | 11.13.0 |
| `pg` | 8.2.0 | 8.16.3 | 9.0.0 |
| `pg-native` | 3.0.0 | 3.5.2 | 9.0.0 |
| `pino` | 8.0.0 | 10.1.0 | 8.11.0 |
| `q` | 1.3.0 | 1.5.1 | 1.26.2 |
| `redis` | 3.1.0 | 5.10.0 | 1.31.0 |
| `restify` | 11.0.0 | 11.1.0 | 2.6.0 |
| `superagent` | 3.0.0 | 10.2.3 | 4.9.0 |
| `undici` | 5.0.0 | 7.16.0 | 11.1.0 |
| `when` | 3.7.0 | 3.7.8 | 1.26.2 |
| `winston` | 3.0.0 | 3.19.0 | 8.11.0 |

*When package is not specified, support is within the `newrelic` package.

## AI Monitoring Support

The Node.js agent supports the following AI platforms and integrations.

### Amazon Bedrock

Through the `@aws-sdk/client-bedrock-runtime` module, we support all models (text-only) through the `Converse` API; for `InvokeModel` API, we support the following models:

| Model | Image | Text | Vision |
| --- | --- | --- | --- |
| Amazon Titan | ❌ | ✅ | - |
| Anthropic Claude | ❌ | ✅ | ❌ |
| Cohere | ❌ | ✅ | - |
| Meta Llama3 | ❌ | ✅ | - |

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
### Google GenAI

Through the `@google/genai` module, we support:

| Audio | Cache | Chat | Embeddings | Image | PDF | Text | Video |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

