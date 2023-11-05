/* eslint-disable no-template-curly-in-string */
import { Message, RenderMessage, RenderOptions } from '../types'
import { Renderer } from '../render'
import { marked } from 'marked'
import { createLogger } from '../utils/logger'
import { readFileSync, writeFileSync } from 'fs'
import { Context, h, Logger } from 'koishi'
import { Config } from '../config'
import markedKatex from 'marked-katex-extension'
import qrcode from 'qrcode'
import hljs from 'highlight.js'
import { markedHighlight } from 'marked-highlight'
import { chathubFetch } from '../utils/request'
import type { Page } from 'puppeteer-core'

let logger: Logger

export default class ImageRenderer extends Renderer {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    private __page: Page

    constructor(
        protected readonly ctx: Context,
        protected readonly config: Config
    ) {
        super(ctx, config)
        logger = createLogger(ctx)

        marked.use(
            markedKatex({
                throwOnError: false,
                displayMode: false,
                output: 'html'
            }),
            markedHighlight({
                langPrefix: 'hljs language-',
                highlight(code, lang) {
                    return `<pre><code class="hljs">${
                        hljs.highlightAuto(code, [lang]).value
                    }</code></pre>`
                }
            })
        )

        ctx.on('dispose', async () => {
            await this.__page.close()
        })
    }

    private async _page() {
        if (!this.__page) {
            this.__page = await this.ctx.puppeteer.page()
        }

        return this.__page
    }

    async render(
        message: Message,
        options: RenderOptions
    ): Promise<RenderMessage> {
        const markdownText = message.content
        const page = await this._page()

        // eslint-disable-next-line n/no-path-concat
        const templateHtmlPath = __dirname + '/../../resources/template.html'
        // eslint-disable-next-line n/no-path-concat
        const outTemplateHtmlPath = __dirname + '/../../resources/out.html'
        const templateHtml = readFileSync(templateHtmlPath).toString()

        const qrcode = await this._textToQrcode(markdownText)

        // ${content} => markdownText'
        const outTemplateHtml = templateHtml
            .replace('${content}', this._renderMarkdownToHtml(markdownText))
            .replace('${qr_data}', qrcode)

        writeFileSync(outTemplateHtmlPath, outTemplateHtml)

        await page.reload()
        await page.goto('file://' + outTemplateHtmlPath, {
            waitUntil: 'networkidle0',
            timeout: 20 * 1000
        })

        const app = await page.$('body')
        // screenshot

        const clip = await app.boundingBox()
        const screenshot = await page.screenshot({ clip })

        return {
            element: h.image(screenshot, 'image/png')
        }
    }

    private _renderMarkdownToHtml(text: string): string {
        return marked.parse(text, {
            gfm: true
        })
    }

    private async _textToQrcode(markdownText: string): Promise<string> {
        const response = await chathubFetch(
            'https://pastebin.mozilla.org/api/',
            {
                method: 'POST',
                body: new URLSearchParams({
                    expires: '86400',
                    format: 'url',
                    lexer: '_markdown',
                    content: markdownText
                })
            }
        )

        const url = await response.text()

        logger.debug('pastebin url: ' + url)

        const qrcodeDataURL = await new Promise<string>((resolve, reject) => {
            qrcode.toDataURL(url, { errorCorrectionLevel: 'H' }, (err, url) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(url)
                }
            })
        })

        return qrcodeDataURL
    }
}
