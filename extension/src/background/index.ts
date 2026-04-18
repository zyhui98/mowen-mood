import type { ExtensionMessage, ExtensionResponse } from '../types'
import { api } from '../services/api'
import { extractUidFromProfileJson, MOWEN_PROFILE_URL } from '../utils/mowenUid'

// 设置点击扩展图标时自动打开侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('设置侧边栏行为失败:', error))

/**
 * 合并 note / user 子域 Cookie（profile 接口需带上登录态）
 */
async function getMowenCookie(): Promise<string> {
  try {
    const [noteCookies, userCookies] = await Promise.all([
      chrome.cookies.getAll({ domain: 'note.mowen.cn' }),
      chrome.cookies.getAll({ domain: 'user.mowen.cn' }),
    ])
    const byName = new Map<string, string>()
    for (const c of [...noteCookies, ...userCookies]) {
      byName.set(c.name, c.value)
    }
    return [...byName.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  } catch (error) {
    console.error('获取 Cookie 失败:', error)
    return ''
  }
}

/**
 * 监听来自 popup 和 content script 的消息
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: ExtensionResponse) => void) => {
    // 使用立即执行的异步函数处理消息
    (async () => {
      try {
        switch (message.type) {
          case 'GET_COOKIE': {
            // 返回当前 mowen.cn 的 Cookie
            const cookie = await getMowenCookie()
            sendResponse({
              success: true,
              data: { cookie },
            })
            break
          }

          case 'FETCH_MOWEN_UID': {
            const cookie = (message.payload as { cookie?: string } | undefined)?.cookie?.trim()
            if (!cookie) {
              sendResponse({ success: false, error: '缺少 cookie' })
              break
            }
            const res = await fetch(MOWEN_PROFILE_URL, {
              method: 'GET',
              headers: {
                accept: 'application/json, text/plain, */*',
                'accept-language': 'zh-CN,zh;q=0.9',
                'content-type': 'application/json',
                origin: 'https://note.mowen.cn',
                referer: 'https://note.mowen.cn/',
                'user-agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
                'x-mo-ver-wxa': '1.69.3',
                Cookie: cookie,
              },
            })
            const text = await res.text()
            let data: unknown
            try {
              data = JSON.parse(text)
            } catch {
              sendResponse({
                success: false,
                error: `profile 响应非 JSON (HTTP ${res.status})`,
              })
              break
            }
            if (!res.ok) {
              sendResponse({
                success: false,
                error: `profile HTTP ${res.status}`,
                data: { raw: data },
              })
              break
            }
            const uid = extractUidFromProfileJson(data)
            if (uid) {
              sendResponse({ success: true, data: { uid } })
            } else {
              sendResponse({
                success: false,
                error: 'profile 响应中未找到 uid',
                data: { raw: data },
              })
            }
            break
          }

          case 'SYNC_NOTES': {
            // 获取 cookie 后调用后端 syncNotes API
            const cookie = await getMowenCookie()
            if (!cookie) {
              sendResponse({
                success: false,
                error: '未找到墨问笔记登录信息，请先登录 note.mowen.cn',
              })
              break
            }

            const result = await api.syncNotes(cookie)
            sendResponse({
              success: result.success,
              data: result.data,
              error: result.message,
            })
            break
          }

          case 'ANALYZE_NOTE': {
            // 获取 cookie 后调用后端 analyzeMood API
            const { uuid } = message.payload || {}
            if (!uuid) {
              sendResponse({
                success: false,
                error: '缺少笔记 UUID',
              })
              break
            }

            const cookie = await getMowenCookie()
            if (!cookie) {
              sendResponse({
                success: false,
                error: '未找到墨问笔记登录信息，请先登录 note.mowen.cn',
              })
              break
            }

            const result = await api.analyzeMood(cookie, uuid)
            sendResponse({
              success: result.success,
              data: result.data,
              error: result.message,
            })
            break
          }

          default:
            sendResponse({
              success: false,
              error: `未知的消息类型: ${message.type}`,
            })
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '处理消息时发生错误',
        })
      }
    })()

    // 返回 true 以支持异步 sendResponse
    return true
  }
)

// 启动日志
console.log('墨问心情 - Background Service Worker loaded')
