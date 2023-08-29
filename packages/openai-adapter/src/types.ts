export interface ChatCompletionResponse {
    choices: Array<{
        index: number;
        finish_reason: string | null;
        delta: { content?: string; role?: string, function_call?: ChatCompletionRequestMessageFunctionCall };
        message: ChatCompletionResponseMessage
    }>;
    id: string;
    object: string;
    created: number;
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ChatCompletionResponseMessage {
    role: string,
    content?: string,
    name?: string,
    function_call?: ChatCompletionRequestMessageFunctionCall
}


export interface ChatCompletionFunctions {
    'name': string;
    'description'?: string;
    'parameters'?: { [key: string]: any; };
}

export interface ChatCompletionRequestMessageFunctionCall {
    'name'?: string;
    'arguments'?: string;
}

/**
 * 
 * @export
 * @interface CreateEmbeddingResponse
 */
export interface CreateEmbeddingResponse {
    /**
     * 
     * @type {string}
     * @memberof CreateEmbeddingResponse
     */
    'object': string;
    /**
     * 
     * @type {string}
     * @memberof CreateEmbeddingResponse
     */
    'model': string;
    /**
     * 
     * @type {Array<CreateEmbeddingResponseDataInner>}
     * @memberof CreateEmbeddingResponse
     */
    'data': Array<CreateEmbeddingResponseDataInner>;
    /**
     * 
     * @type {CreateEmbeddingResponseUsage}
     * @memberof CreateEmbeddingResponse
     */
    'usage': CreateEmbeddingResponseUsage;
}

export interface CreateEmbeddingRequest {
    model: string;
    input: string | string[];
}

/**
 * 
 * @export
 * @interface CreateEmbeddingResponseDataInner
 */
export interface CreateEmbeddingResponseDataInner {
    /**
     * 
     * @type {number}
     * @memberof CreateEmbeddingResponseDataInner
     */
    'index': number;
    /**
     * 
     * @type {string}
     * @memberof CreateEmbeddingResponseDataInner
     */
    'object': string;
    /**
     * 
     * @type {Array<number>}
     * @memberof CreateEmbeddingResponseDataInner
     */
    'embedding': Array<number>;
}
/**
 * 
 * @export
 * @interface CreateEmbeddingResponseUsage
 */
export interface CreateEmbeddingResponseUsage {
    /**
     * 
     * @type {number}
     * @memberof CreateEmbeddingResponseUsage
     */
    'prompt_tokens': number;
    /**
     * 
     * @type {number}
     * @memberof CreateEmbeddingResponseUsage
     */
    'total_tokens': number;
}

export type ChatCompletionResponseMessageRoleEnum = "system" | 'assistant' | 'user' | 'function'