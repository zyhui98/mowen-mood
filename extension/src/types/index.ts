// 天气类型
export type WeatherType = 'storm' | 'rain' | 'cloudy' | 'sunny' | 'hot'

// 心情标签
export type MoodLabel = '极度悲伤' | '难过' | '低落' | '平静' | '轻松' | '愉快' | '开心' | '兴奋' | '极度兴奋'

// 笔记数据
export interface Note {
  id: number
  uuid: string
  title: string
  content: string
  summary: string
  mood_score: number | null
  weather_type: WeatherType | null
  mood_label: string | null
  reason: string | null
  analyzed_at: string | null
  published_at: string | null
  created_at: string
  /** 墨问作者 uid，用于「我的」筛选 */
  author_uid?: string | null
}

// 心情记录
export interface MoodRecord {
  id: number
  note_uuid: string
  mood_score: number
  mood_label: MoodLabel
  analysis_reason: string
  created_at: string
}

// 趋势数据点
export interface TrendPoint {
  date: string
  mood_score: number
  weather_type: WeatherType
  note_title: string
  note_uuid: string
}

// 心情分析结果
export interface MoodAnalysisResult {
  is_mood_related: boolean
  mood_score: number
  mood_label: string
  weather_type: WeatherType
  reason: string
}

// API 响应格式
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// 插件消息类型（用于 background 和 popup 之间通信）
export interface ExtensionMessage {
  type: 'GET_COOKIE' | 'GET_CURRENT_NOTE' | 'ANALYZE_NOTE' | 'SYNC_NOTES' | 'FETCH_MOWEN_UID'
  payload?: any
}

export interface ExtensionResponse {
  success: boolean
  data?: any
  error?: string
}
