import { ChatGenerationChunk } from '@langchain/core/outputs'
import {
    EmbeddingsRequester,
    EmbeddingsRequestParams,
    ModelRequester,
    ModelRequestParams
} from 'koishi-plugin-chatluna/llm-core/platform/api'
import { ClientConfig } from 'koishi-plugin-chatluna/llm-core/platform/config'
import {
    ChatLunaError,
    ChatLunaErrorCode
} from 'koishi-plugin-chatluna/utils/error'
import { sseIterable } from 'koishi-plugin-chatluna/utils/sse'
import * as fetchType from 'undici/types/fetch'
import { Config, logger } from '.'
import {
    ChatCompletionResponse,
    ChatCompletionResponseMessageRoleEnum,
    CreateEmbeddingResponse
} from './types'
import {
    convertDeltaToMessageChunk,
    formatToolsToOpenAITools,
    langchainMessageToOpenAIMessage
} from './utils'
import { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat'

export class OpenAIRequester
    extends ModelRequester
    implements EmbeddingsRequester
{
    constructor(
        private _config: ClientConfig,
        private _pluginConfig: Config,
        private _plugin: ChatLunaPlugin
    ) {
        super()
    }

    async *completionStream(
        params: ModelRequestParams
    ): AsyncGenerator<ChatGenerationChunk> {
        try {
            let url = 'chat/completions'
            if (this._pluginConfig.provider !== 'auto') {
                url += '?provider=' + this._pluginConfig.provider
            }
            const response = await this._post(
                url,
                {
                    model: params.model,
                    messages: langchainMessageToOpenAIMessage(
                        params.input,
                        params.model
                    ),
                    stream: true
                },
                {
                    signal: params.signal
                }
            )
            logger.debug('response:', response)

            const iterator = sseIterable(response)
            logger.debug('iterator:')

            let content = ''

            const findTools = params.tools != null
            let defaultRole: ChatCompletionResponseMessageRoleEnum = 'assistant'

            let errorCount = 0

            for await (const event of iterator) {
                const chunk = event.data
                if (chunk === '[DONE]') {
                    return
                }
                logger.debug(' chunk: ' + chunk)

                try {
                    const data = JSON.parse(chunk) as ChatCompletionResponse

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if ((data as any).error) {
                        throw new ChatLunaError(
                            ChatLunaErrorCode.API_REQUEST_FAILED,
                            new Error(
                                'error when calling openai completion, Result: ' +
                                    chunk
                            )
                        )
                    }

                    const choice = data.choices?.[0]
                    if (!choice) {
                        continue
                    }

                    const { delta } = choice
                    const messageChunk = convertDeltaToMessageChunk(
                        delta,
                        defaultRole
                    )

                    defaultRole = (
                        (delta.role?.length ?? 0) > 0 ? delta.role : defaultRole
                    ) as ChatCompletionResponseMessageRoleEnum

                    if (!findTools) {
                        content = content + messageChunk.content
                        messageChunk.content = content
                    }

                    const generationChunk = new ChatGenerationChunk({
                        message: messageChunk,
                        text: messageChunk.content as string
                    })

                    yield generationChunk
                } catch (e) {
                    if (errorCount > 5) {
                        logger.error('error with chunk', chunk)
                        throw new ChatLunaError(
                            ChatLunaErrorCode.API_REQUEST_FAILED,
                            e
                        )
                    } else {
                        errorCount++
                        continue
                    }
                }
            }
        } catch (e) {
            if (e instanceof ChatLunaError) {
                throw e
            } else {
                throw new ChatLunaError(ChatLunaErrorCode.API_REQUEST_FAILED, e)
            }
        }
    }

    async embeddings(
        params: EmbeddingsRequestParams
    ): Promise<number[] | number[][]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let data: CreateEmbeddingResponse | string

        try {
            const response = await this._post('embeddings', {
                input: params.input,
                model: params.model
            })

            data = await response.text()

            data = JSON.parse(data as string) as CreateEmbeddingResponse

            if (data.data && data.data.length > 0) {
                return (data as CreateEmbeddingResponse).data.map(
                    (it) => it.embedding
                )
            }

            throw new Error(
                'error when calling openai embeddings, Result: ' +
                    JSON.stringify(data)
            )
        } catch (e) {
            const error = new Error(
                'error when calling openai embeddings, Result: ' +
                    JSON.stringify(data)
            )

            logger.debug(e)

            throw new ChatLunaError(ChatLunaErrorCode.API_REQUEST_FAILED, error)
        }
    }

    async getModels(): Promise<string[]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let data: any
        try {
            const response = await this._get('models')
            data = await response.text()
            data = JSON.parse(data as string)
            if (data.data?.length < 1) {
                // remove the aoi key and request again
                const response = await this._get('models', {
                    'Content-Type': 'application/json'
                })
                data = await response.text()
                data = JSON.parse(data as string)
            }
            const res = (<Record<string, any>[]>data.data).map(
                (model) => model.id
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return res
        } catch (e) {
            throw new Error(
                'error when listing openai models, Result: ' +
                    JSON.stringify(data)
            )
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _post(url: string, data: any, params: fetchType.RequestInit = {}) {
        const requestUrl = this._concatUrl(url)
        logger.debug('_post:', requestUrl)

        for (const key in data) {
            if (data[key] == null) {
                delete data[key]
            }
        }

        const body = JSON.stringify(data)

        logger.debug('_post body:', body)

        const req_res = this._plugin.fetch(requestUrl, {
            body,
            headers: this._buildHeaders(),
            method: 'POST'
        })

        return req_res
    }

    private _get(
        url: string,
        headers: Record<string, string> = this._buildHeaders()
    ) {
        const requestUrl = this._concatUrl(url)
        logger.debug('get:', requestUrl)
        return this._plugin.fetch(requestUrl, {
            method: 'GET',
            headers
        })
    }

    private _buildHeaders() {
        const result = {
            'Content-Type': 'application/json'
        }

        // if (Object.keys(this._pluginConfig.additionCookies).length > 0) {
        //     result['Cookie'] = Object.keys(this._pluginConfig.additionCookies)
        //         .map((key) => {
        //             return `${key}=${this._pluginConfig.additionCookies[key]}`
        //         })
        //         .join('; ')
        // }

        return result
    }

    private _concatUrl(url: string): string {
        const apiEndPoint = this._config.apiEndpoint

        if (apiEndPoint.endsWith('/')) {
            return apiEndPoint + url
        }

        return apiEndPoint + '/' + url
    }

    async init(): Promise<void> {}

    async dispose(): Promise<void> {}
}
