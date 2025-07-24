'use strict'
const Subscriber = require('../base')
const logger = require('../../logger').child({ component: 'openai-subscriber' })
const { AI } = require('../../metrics/names')
const { OPENAI } = AI
const {
  addLlmMeta,
  recordEmbeddingMessage
} = require('./utils')

class OpenAIEmbeddings extends Subscriber {
  constructor(agent) {
    super(agent, 'openai:nr_embeddingsCreate')
    this.events = ['asyncEnd']
    this.requireActiveTx = true
  }

  get enabled() {
    return this.config.ai_monitoring.enabled === true
  }

  handler(data, ctx) {
    const segment = this._agent.tracer.createSegment({
      name: OPENAI.EMBEDDING,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    const newCtx = ctx.enterSegment({ segment })
    return newCtx
  }

  asyncEnd(data) {
    const ctx = this._agent.tracer.getContext()
    if (!ctx?.segment || !ctx?.transaction) {
      return
    }
    const { arguments: args, error: err } = data
    let { result: response } = data
    const [ request ] = args
    const agent = this._agent
    const { segment, transaction } = ctx
    recordEmbeddingMessage({
      agent,
      logger,
      segment,
      transaction,
      request,
      response,
      headers: ctx.extras?.headers,
      err
    })
    addLlmMeta({ agent, transaction })
  }
}

const embeddingConfig = [
  {
    channelName: 'nr_embeddingsCreate',
    module: { name: 'openai', versionRange: '>=4.0.0', filePath: 'resources/embeddings.js' },
    functionQuery: {
      className: 'Embeddings',
      methodName: 'create',
      kind: 'Async'
    }
  }
]

module.exports = {
  embeddingConfig,
  OpenAIEmbeddings
}
