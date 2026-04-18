import type { ApiResponse, Note, TrendPoint, MoodAnalysisResult, MoodDanmaku } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE

/**
 * 统一请求处理函数
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        data: data.data ?? null,
        message: data.message || `HTTP error: ${response.status}`,
      }
    }

    return data as ApiResponse<T>
  } catch (error) {
    return {
      success: false,
      data: null as T,
      message: error instanceof Error ? error.message : '网络请求失败',
    }
  }
}

/**
 * 后端 API 调用封装
 */
export const api = {
  /**
   * 健康检查
   */
  health(): Promise<ApiResponse<{ status: string }>> {
    return request<{ status: string }>('/health')
  },

  /**
   * 获取笔记列表（支持分页）
   * @param authorUid 传入则只拉取该作者的笔记（「我的」）
   */
  getNotes(limit: number = 10, offset: number = 0, authorUid?: string): Promise<ApiResponse<{notes: Note[], total: number, hasMore: boolean}>> {
    let path = `/notes?limit=${limit}&offset=${offset}`
    if (authorUid) {
      path += `&author_uid=${encodeURIComponent(authorUid)}`
    }
    return request<{notes: Note[], total: number, hasMore: boolean}>(path)
  },

  /**
   * 获取心情趋势
   * @param authorUid 传入则只统计该作者的笔记心情（「我的」）
   */
  getMoodTrend(authorUid?: string): Promise<ApiResponse<TrendPoint[]>> {
    let path = '/mood/trend'
    if (authorUid) {
      path += `?author_uid=${encodeURIComponent(authorUid)}`
    }
    return request<TrendPoint[]>(path)
  },

  /**
   * 最近一段时间内的心情弹幕（默认 24 小时）
   */
  getMoodDanmaku(hours: number = 24, authorUid?: string): Promise<ApiResponse<MoodDanmaku[]>> {
    let path = `/mood/danmaku?hours=${hours}`
    if (authorUid) {
      path += `&author_uid=${encodeURIComponent(authorUid)}`
    }
    return request<MoodDanmaku[]>(path)
  },

  /**
   * 发布心情弹幕
   */
  postMoodDanmaku(payload: {
    content: string
    color: string
    emoji: string
    author_uid?: string | null
  }): Promise<ApiResponse<{ ok: boolean }>> {
    return request<{ ok: boolean }>('/mood/danmaku', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  /**
   * 分析单篇笔记心情
   */
  analyzeMood(cookie: string, uuid: string): Promise<ApiResponse<MoodAnalysisResult>> {
    return request<MoodAnalysisResult>('/mood/analyze', {
      method: 'POST',
      body: JSON.stringify({ cookie, uuid }),
    })
  },
}
