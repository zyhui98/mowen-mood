import { memo } from 'react'
import type { MoodAnalysisResult } from '../types'

interface ShareMoodProps {
  onAnalyze: () => void
  isDetailPage: boolean
  isLoading: boolean
  result: MoodAnalysisResult | null
}

// 获取天气描述
function getWeatherLabel(weatherType: string): string {
  switch (weatherType) {
    case 'storm': return '暴风雪'
    case 'rain': return '下雨'
    case 'cloudy': return '多云'
    case 'sunny': return '晴天'
    case 'hot': return '烈日'
    default: return '未知'
  }
}

// 获取天气图标
function getWeatherIcon(weatherType: string): string {
  switch (weatherType) {
    case 'storm': return '🌨️'
    case 'rain': return '🌧️'
    case 'cloudy': return '⛅'
    case 'sunny': return '☀️'
    case 'hot': return '🔥'
    default: return '❓'
  }
}

// 获取温度颜色
function getTempColor(temp: number): string {
  if (temp < 0) return '#6366f1'
  if (temp < 10) return '#3b82f6'
  if (temp < 20) return '#6b7280'
  if (temp < 30) return '#f59e0b'
  return '#ef4444'
}

/**
 * 加载动画组件
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center gap-2">
      <svg className="animate-spin h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span className="text-gray-600">分析中...</span>
    </div>
  )
}

/**
 * 分析结果卡片组件
 */
function ResultCard({ result }: { result: MoodAnalysisResult }) {
  const tempColor = getTempColor(result.mood_score)
  
  // 如果笔记不涉及心情
  if (!result.is_mood_related) {
    return (
      <div className="result-card mt-3 p-4 rounded-xl bg-gray-100 animate-fade-in">
        <div className="flex items-center gap-2 text-gray-500">
          <span className="text-xl">📝</span>
          <span className="text-sm">这篇笔记不涉及心情描述</span>
        </div>
      </div>
    )
  }

  return (
    <div className="result-card mt-3 p-4 rounded-xl bg-gray-100 animate-fade-in">
      {/* 温度和天气 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-1">
          <span 
            className="text-3xl font-bold"
            style={{ color: tempColor }}
          >
            {result.mood_score}°C
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10">
          <span className="text-lg">{getWeatherIcon(result.weather_type)}</span>
          <span className="text-sm text-white/80">{getWeatherLabel(result.weather_type)}</span>
        </div>
      </div>

      {/* 心情标签 */}
      <div className="mb-3">
        <span 
          className="inline-block px-3 py-1 rounded-full text-sm font-medium"
          style={{ 
            backgroundColor: `${tempColor}25`,
            color: tempColor,
          }}
        >
          {result.mood_label}
        </span>
      </div>

      {/* 分析原因 */}
      <div className="text-xs text-gray-500 leading-relaxed">
        <p>{result.reason}</p>
      </div>
    </div>
  )
}

/**
 * 共享心情组件
 * 仅在笔记详情页显示
 */
function ShareMood({ onAnalyze, isDetailPage, isLoading, result }: ShareMoodProps) {
  // 不在详情页时不显示
  if (!isDetailPage) {
    return null
  }

  return (
    <div className="share-mood py-2">
      {/* 分析按钮 */}
      <button
        onClick={onAnalyze}
        disabled={isLoading}
        className={`
          w-full py-2.5 px-4 rounded-xl
          font-medium text-sm
          transition-all duration-300
          ${isLoading 
            ? 'bg-gray-300 cursor-not-allowed text-gray-600' 
            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] shadow-lg shadow-orange-500/30 text-white'
          }
        `}
      >
        {isLoading ? <LoadingSpinner /> : '共享笔记心情'}
      </button>

      {/* 分析结果 */}
      {result && !isLoading && <ResultCard result={result} />}
    </div>
  )
}

export default memo(ShareMood)
