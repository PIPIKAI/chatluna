import { Context } from 'koishi'
import { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat'
import { Config } from '.'
// import start
import { apply as faiss } from './vectorstore/faiss'
import { apply as lancedb } from './vectorstore/lancedb'
import { apply as redis } from './vectorstore/redis'// import end

export async function vectorStore(
    ctx: Context,
    config: Config,
    plugin: ChatLunaPlugin
) {
    type VectorStore = (
        ctx: Context,
        config: Config,
        plugin: ChatLunaPlugin
    ) => PromiseLike<void> | void

    const middlewares: VectorStore[] =
        // middleware start
[
faiss,
lancedb,
redis,
]// middleware end

    for (const middleware of middlewares) {
        await middleware(ctx, config, plugin)
    }
}
