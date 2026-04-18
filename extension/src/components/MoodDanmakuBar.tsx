import { memo, useState } from 'react'
import type { MoodDanmaku } from '../types'

interface MoodDanmakuBarProps {
  data: MoodDanmaku[]
}

/**
 * 趋势图上方：最近 24h 心情弹幕横向循环滚动，悬停暂停
 */
function MoodDanmakuBar({ data }: MoodDanmakuBarProps) {
  const [paused, setPaused] = useState(false)

  if (!data.length) {
    return (
      <div className="h-8 mb-2 flex items-center justify-center border-b border-gray-100 text-xs text-gray-400">
        暂无弹幕，点击「心情弹幕」发一条吧
      </div>
    )
  }

  const loop = [...data, ...data]

  return (
    <div
      className="h-8 mb-2 border-b border-gray-100 overflow-hidden relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex w-max gap-8 items-center h-8 whitespace-nowrap animate-mood-danmaku"
        style={{ animationPlayState: paused ? 'paused' : 'running' }}
      >
        {loop.map((d, i) => (
          <span
            key={`${d.id}-${i}`}
            className="text-sm inline-flex items-center gap-1.5 shrink-0 max-w-[240px]"
            style={{ color: d.color }}
            title={d.content}
          >
            <span className="text-base leading-none shrink-0">{d.emoji || '💬'}</span>
            <span className="truncate">{d.content}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default memo(MoodDanmakuBar)
