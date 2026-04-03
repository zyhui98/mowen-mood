import { memo } from 'react'

interface WeatherBackgroundProps {
  weatherType?: string
}

/**
 * 透明背景组件
 * 用于侧栏模式，背景完全透明以适配目标页面
 */
function WeatherBackground(_props: WeatherBackgroundProps) {
  return (
    <div className="absolute inset-0 z-0 opacity-0">
      {/* 背景已设为透明 */}
    </div>
  )
}

export default memo(WeatherBackground)
