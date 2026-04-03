import type { ExtensionMessage, ExtensionResponse } from '../types'
import { api } from '../services/api'

// 设置点击扩展图标时自动打开侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('设置侧边栏行为失败:', error))

/**
 * 从 mowen.cn 域提取 Cookie
 */
async function getMowenCookie(): Promise<string> {
  try {
    const cookies = await chrome.cookies.getAll({ domain: 'note.mowen.cn' })
    // 将所有 cookie 拼接为 "name=value; name2=value2" 格式字符串
    return cookies.map((cookie: chrome.cookies.Cookie) => `${cookie.name}=${cookie.value}`).join('; ')
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
