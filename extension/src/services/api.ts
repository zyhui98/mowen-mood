import type { ApiResponse, Note, TrendPoint, MoodAnalysisResult } from '../types'

const API_BASE = 'http://127.0.0.1:5001/api'

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
   * 同步笔记（传入 cookie）
   */
  syncNotes(cookie: string): Promise<ApiResponse<{ total: number; synced: number; skipped: number }>> {
    return request<{ total: number; synced: number; skipped: number }>('/notes/sync', {
      method: 'POST',
      body: JSON.stringify({ cookie }),
    })
  },

  /**
   * 获取笔记列表（支持分页）
   */
  getNotes(limit: number = 10, offset: number = 0): Promise<ApiResponse<{notes: Note[], total: number, hasMore: boolean}>> {
    return request<{notes: Note[], total: number, hasMore: boolean}>(`/notes?limit=${limit}&offset=${offset}`)
  },

  /**
   * 获取心情趋势
   */
  getMoodTrend(): Promise<ApiResponse<TrendPoint[]>> {
    return request<TrendPoint[]>('/mood/trend')
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
