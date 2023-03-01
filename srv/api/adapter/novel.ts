import needle from 'needle'
import { config } from '../../config'
import { logger } from '../../logger'
import { sanitise, trimResponse } from '../chat/common'
import { badWordIds } from './novel-bad-words'
import { ModelAdapter } from './type'

const novelUrl = `https://api.novelai.net/ai/generate`

const statuses: Record<number, string> = {
  400: 'Invalid payload',
  401: 'Invalid API key',
  402: 'You need an active subscription',
}

const base = {
  model: 'krake-v2',
  parameters: {
    generate_until_sentence: true,
    max_length: config.kobold.maxLength,
    min_length: 8,
    order: [0, 1, 2, 3],
    prefix: 'vanilla',
    repetition_penalty: 1.08,
    // repetition_penalty_frequency: 0,
    // repetition_penalty_presence: 0,
    // repetition_penalty_slope: 3.33,
    // repetition_penalty_range: 2048,
    // tail_free_sampling: 0.879,
    stop_sequences: [[25], [27]],
    temperature: 0.63,
    top_k: 0,
    top_a: 0.0,
    top_p: 0.9,
    use_cache: false,
    use_string: true,
    bad_word_ids: badWordIds,
  },
}

export const handleNovel: ModelAdapter = async function* ({ char, members, user, prompt }) {
  if (!user.novelApiKey) {
    yield { error: 'Novel API key not set' }
    return
  }

  const body = { ...base, input: prompt }

  const endTokens = ['***', 'Scenario:', '----']

  const response = await needle('post', novelUrl, body, {
    json: true,
    timeout: 2000,
    response_timeout: 10000,
    headers: { Authorization: `Bearer ${user.novelApiKey}` },
  }).catch((err) => ({ err }))

  if ('err' in response) {
    yield { error: response.err.message }
    return
  }

  logger.warn(response.body, 'Novel response')
  const status = response.statusCode || 0
  if (statuses[status]) {
    yield { error: statuses[status] }
    return
  }

  if (status >= 400) {
    yield { error: response.statusMessage! }
    return
  }

  const parsed = sanitise(response.body.output)
  const trimmed = trimResponse(parsed, char, members, endTokens)
  yield trimmed ? trimmed.response : parsed
}
