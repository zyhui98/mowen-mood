import type { ExtensionMessage, ExtensionResponse } from '../types'

/**
 * 检测当前是否在墨问笔记详情页
 * URL 格式: https://note.mowen.cn/detail/${uuid}
 */
function isNoteDetailPage(): boolean {
  return window.location.pathname.startsWith('/detail/')
}

/**
 * 从 URL 提取笔记 UUID
 */
function getNoteUUID(): string | null {
  const match = window.location.pathname.match(/\/detail\/([^\/]+)/)
  return match ? match[1] : null
}

/**
 * 监听来自 popup 的消息
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: ExtensionResponse) => void) => {
    if (message.type === 'GET_CURRENT_NOTE') {
      sendResponse({
        success: true,
        data: {
          isDetailPage: isNoteDetailPage(),
          uuid: getNoteUUID(),
          url: window.location.href,
        },
      })
    }
    return true
  }
)

// 页面加载时的检测日志
if (isNoteDetailPage()) {
  console.log('墨问心情 - 检测到笔记详情页:', getNoteUUID())
} else {
  console.log('墨问心情 - Content Script loaded')
}
