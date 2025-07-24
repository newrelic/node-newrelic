const { OpenAIResponses, OpenAIChatCompletions, chatConfig } = require('./chat')
const { OpenAIEmbeddings, embeddingConfig } = require('./embeddings')
const { OpenAIClientSubscriber, clientConfig } = require('./client')

const openaiConfig = {
  package: 'openai',
  instrumentations: [...chatConfig, ...clientConfig, ...embeddingConfig],
}

module.exports = {
  openaiConfig,
  OpenAIChatCompletions,
  OpenAIClientSubscriber,
  OpenAIEmbeddings,
  OpenAIResponses,
}
