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
| `@anthropic-ai/sdk` | 0.33.0 | 0.106.0 | 13.19.0 |
| `@apollo/gateway` | 2.3.0 | 2.14.2 | 14.0.0 |
| `@apollo/server` | 4.0.0 | 5.5.1 | 14.0.0 |
| `@aws-sdk/client-bedrock-runtime` | 3.377.0 | 3.1075.0 | 11.13.0 |
| `@aws-sdk/client-dynamodb` | 3.377.0 | 3.1075.0 | 8.7.1 |
| `@aws-sdk/client-sns` | 3.377.0 | 3.1075.0 | 8.7.1 |
| `@aws-sdk/client-sqs` | 3.377.0 | 3.1075.0 | 8.7.1 |
| `@aws-sdk/lib-dynamodb` | 3.377.0 | 3.1075.0 | 8.7.1 |
| `@aws-sdk/smithy-client` | 3.47.0 | 3.374.0 | 8.7.1 |
| `@azure/functions` | 4.7.0 | 4.16.1 | 12.18.0 |
| `@elastic/elasticsearch` | 7.16.0 | 9.4.2 | 11.9.0 |
| `@google/adk` | 1.1.0 | 1.3.0 | 13.20.0 |
| `@google/genai` | 1.1.0 | 2.10.0 | 12.21.0 |
| `@grpc/grpc-js` | 1.4.0 | 1.14.4 | 8.17.0 |
| `@hapi/hapi` | 20.1.2 | 21.4.9 | 9.0.0 |
| `@hapi/vision` | 5.0.0 | 7.0.3 | 9.0.0 |
| `@koa/router` | 12.0.1 | 15.6.0 | 3.2.0 |
| `@langchain/aws` | 0.1.3 | 1.4.2 | 13.8.0 |
| `@langchain/core` | 0.2.0 | 1.2.1 | 11.13.0 |
| `@langchain/langgraph` | 1.0.0 | 1.4.7 | 13.12.0 |
| `@langchain/openai` | 0.2.0 | 1.5.3 | 11.13.0 |
| `@modelcontextprotocol/sdk` | 1.13.0 | 1.29.0 | 13.2.0 |
| `@nestjs/core` | 10.0.0 | 11.1.27 | 10.1.0 |
| `@opensearch-project/opensearch` | 2.1.0 | 3.6.0 | 12.10.0 |
| `@prisma/client` | 5.0.0 | 7.8.0 | 11.0.0 |
| `@smithy/smithy-client` | 2.0.0 | 4.14.3 | 11.0.0 |
| `amqplib` | 0.5.0 | 2.0.1 | 2.0.0 |
| `aws-sdk` | 2.2.48 | 2.1693.0 | 6.2.0 |
| `bluebird` | 3.0.0 | 3.7.2 | 1.27.0 |
| `bunyan` | 1.8.12 | 1.8.15 | 9.3.0 |
| `cassandra-driver` | 4.0.0 | 4.9.0 | 1.7.1 |
| `connect` | 3.0.0 | 3.7.0 | 2.6.0 |
| `express` | 4.15.0 | 5.2.1 | 2.6.0 |
| `fastify` | 4.0.0 | 5.9.0 | 8.5.0 |
| `generic-pool` | 3.0.0 | 3.9.0 | 0.9.0 |
| `ioredis` | 4.0.0 | 5.11.1 | 1.26.2 |
| `iovalkey` | 0.1.0 | 0.3.3 | 13.9.0 |
| `kafkajs` | 2.0.0 | 2.2.4 | 11.19.0 |
| `koa` | 2.0.0 | 3.2.1 | 3.2.0 |
| `memcached` | 2.2.0 | 2.2.2 | 1.26.2 |
| `mongodb` | 4.1.4 | 7.4.0 | 1.32.0 |
| `mysql` | 2.16.0 | 2.18.1 | 1.32.0 |
| `mysql2` | 3.0.0 | 3.22.5 | 1.32.0 |
| `next` | 14.0.0 | 16.2.9 | 12.0.0 |
| `openai` | 4.0.0 | 6.45.0 | 11.13.0 |
| `pg` | 8.2.0 | 8.22.0 | 9.0.0 |
| `pg-native` | 3.0.0 | 3.8.0 | 9.0.0 |
| `pino` | 8.0.0 | 10.3.1 | 8.11.0 |
| `q` | 1.3.0 | 1.5.1 | 1.26.2 |
| `redis` | 3.1.0 | 6.0.1 | 1.31.0 |
| `restify` | 11.0.0 | 11.1.0 | 2.6.0 |
| `superagent` | 3.0.0 | 10.3.0 | 4.9.0 |
| `undici` | 5.0.0 | 8.5.0 | 11.1.0 |
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


### Google ADK

Through the `@google/adk` module, we support the following features:

| Agents | Tools |
| --- | --- |
| ✅ | ✅ |

Models/providers are generally supported transitively by our instrumentation of the provider's module.

| Provider | Supported | Transitively |
| --- | --- | --- |
| Google Gemini | ✅ | ✅ |
### LangChain

The following general features of LangChain are supported:

| Agents via LangGraph | Chains | Tools | Vectorstores |
| --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ |

Models/providers are generally supported transitively by our instrumentation of the provider's module.

| Provider | Supported | Transitively |
| --- | --- | --- |
| Azure OpenAI | ❌ | ❌ |
| Amazon Bedrock | ✅ | ✅ |
| OpenAI | ✅ | ✅ |
### Model Context Protocol SDK

Through the `@modelcontextprotocol/sdk` module, we support:

| Prompt Retrieval | Resource Reading | Tool Calls |
| --- | --- | --- |
| ✅ | ✅ | ✅ |

MCP is provider-agnostic. Any LLM provider that uses MCP tools is supported transitively.

| Provider | Supported | Transitively |
| --- | --- | --- |


### Anthropic

Through the `@anthropic-ai/sdk` module, we support:

| Chat | Completions | Files |
| --- | --- | --- |
| ✅ | ✅ | ❌ |
### Google Gen AI

Through the `@google/genai` module, we support:

| Audio | Cache | Chat | Embeddings | Image | PDF | Text | Video |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
### OpenAI

Through the `openai` module, we support:

| Audio | Chat | Completions | Embeddings | Files | Images |
| --- | --- | --- | --- | --- | --- |
| ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |

