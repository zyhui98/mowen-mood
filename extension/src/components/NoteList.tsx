import { memo, useRef, useEffect } from 'react'
import type { Note } from '../types'

interface NoteListProps {
  notes: Note[]
  onLoadMore?: () => void
  loadingMore?: boolean
  hasMore?: boolean
}

// 根据温度获取标签颜色
function getTempColor(temp: number | null): string {
  if (temp === null) return '#9ca3af' // 灰色（未分析）
  if (temp < 0) return '#6366f1'      // 蓝紫色
  if (temp < 10) return '#3b82f6'     // 蓝色
  if (temp < 20) return '#6b7280'     // 灰色
  if (temp < 30) return '#f59e0b'     // 橙色
  return '#ef4444'                     // 红色
}

// 根据温度获取标签背景色（浅色）
function getTempBgColor(temp: number | null): string {
  if (temp === null) return 'rgba(156, 163, 175, 0.15)'
  if (temp < 0) return 'rgba(99, 102, 241, 0.15)'
  if (temp < 10) return 'rgba(59, 130, 246, 0.15)'
  if (temp < 20) return 'rgba(107, 114, 128, 0.15)'
  if (temp < 30) return 'rgba(245, 158, 11, 0.15)'
  return 'rgba(239, 68, 68, 0.15)'
}

// 格式化相对时间
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return diffMins <= 1 ? '刚刚' : `${diffMins}分钟前`
    }
    return `${diffHours}小时前`
  }
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`
  return `${Math.floor(diffDays / 365)}年前`
}

// 获取天气 emoji
function getWeatherEmoji(weatherType: string | null): string {
  switch (weatherType) {
    case 'storm': return '🌨️'
    case 'rain': return '🌧️'
    case 'cloudy': return '⛅'
    case 'sunny': return '☀️'
    case 'hot': return '🔥'
    default: return ''
  }
}

interface NoteItemProps {
  note: Note
}

/**
 * 单条笔记项组件
 */
function NoteItem({ note }: NoteItemProps) {
  const tempColor = getTempColor(note.mood_score)
  const tempBgColor = getTempBgColor(note.mood_score)
  const weatherEmoji = getWeatherEmoji(note.weather_type)
  const tempDisplay = note.mood_score !== null ? `${note.mood_score}°C` : '--'

  // 点击跳转到笔记详情页
  const handleClick = () => {
    if (!note.uuid) {
      console.warn('笔记缺少 uuid，无法跳转')
      return
    }

    const url = `https://note.mowen.cn/detail/${note.uuid}`
    
    // 检测是否在 Chrome 扩展环境
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      // 在新标签页打开
      chrome.tabs.create({ url })
    } else {
      // 开发环境或非扩展环境，使用 window.open
      window.open(url, '_blank')
    }
  }

  return (
    <div 
      onClick={handleClick}
      className="note-item group p-3 rounded-xl bg-white hover:bg-gray-50 hover:shadow-md transition-all duration-200 cursor-pointer shadow-sm border border-gray-100"
    >
      {/* 温度标签 - 放在顶部 */}
      <div className="flex items-center justify-between mb-2">
        <div 
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
          style={{ 
            backgroundColor: tempBgColor,
            color: tempColor,
          }}
        >
          <span>{tempDisplay}</span>
          {weatherEmoji && <span>{weatherEmoji}</span>}
        </div>
        <span className="text-[10px] text-gray-400">
          {formatRelativeTime(note.published_at || note.created_at)}
        </span>
      </div>

      {/* 标题 */}
      <h3 className="text-sm font-medium text-gray-800 leading-tight mb-1.5 line-clamp-2">
        {note.title || '无标题'}
      </h3>

      {/* 摘要 */}
      {(note.summary || note.content) && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mb-2">
          {note.summary || note.content?.slice(0, 80) || '暂无内容'}
        </p>
      )}

      {/* 心情标签和原因 */}
      {(note.mood_label || note.reason) && (
        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          {note.mood_label && (
            <span 
              className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100"
            >
              {note.mood_label}
            </span>
          )}
          {note.reason && (
            <span 
              className="inline-block px-2 py-0.5 rounded-md text-[10px] bg-gray-50 text-gray-600 border border-gray-100"
            >
              {note.reason}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 笔记列表组件 - 支持分页加载
 */
function NoteList({ notes, onLoadMore, loadingMore, hasMore }: NoteListProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // 监听滚动事件，实现无限滚动
  useEffect(() => {
    const listElement = listRef.current
    if (!listElement || !onLoadMore) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = listElement
      // 距离底部 100px 时触发加载更多
      if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loadingMore) {
        onLoadMore()
      }
    }

    listElement.addEventListener('scroll', handleScroll)
    return () => listElement.removeEventListener('scroll', handleScroll)
  }, [onLoadMore, hasMore, loadingMore])

  if (!notes || notes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">暂无笔记数据</p>
        <p className="text-gray-400 text-xs mt-1">请先同步笔记</p>
      </div>
    )
  }

  return (
    <div ref={listRef} className="note-list h-full space-y-2 overflow-y-auto custom-scrollbar pr-1">
      {notes.map((note) => (
        <NoteItem key={note.id} note={note} />
      ))}
      {/* 加载更多提示 */}
      {loadingMore && (
        <div className="py-3 text-center">
          <span className="text-xs text-gray-400">加载中...</span>
        </div>
      )}
      {/* 没有更多数据提示 */}
      {!hasMore && notes.length > 0 && (
        <div className="py-3 text-center">
          <span className="text-xs text-gray-400">没有更多了</span>
        </div>
      )}
    </div>
  )
}

export default memo(NoteList)
