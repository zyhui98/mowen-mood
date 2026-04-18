import { useRef, useEffect, useState, memo } from 'react'
import type { TrendPoint } from '../types'

interface MoodTrendProps {
  data: TrendPoint[]
  onPointClick?: (uuid: string) => void
}

// 温度范围配置
const TEMP_MIN = -10
const TEMP_MAX = 40
const TEMP_RANGE = TEMP_MAX - TEMP_MIN // 50

// 温度区间颜色配置
const TEMP_ZONES = [
  { min: -10, max: 0, color: 'rgba(99, 102, 241, 0.15)' },   // 蓝紫色
  { min: 0, max: 10, color: 'rgba(59, 130, 246, 0.15)' },    // 蓝色
  { min: 10, max: 20, color: 'rgba(107, 114, 128, 0.15)' },  // 灰色
  { min: 20, max: 30, color: 'rgba(245, 158, 11, 0.15)' },   // 橙色
  { min: 30, max: 40, color: 'rgba(239, 68, 68, 0.15)' },    // 红色
]

// 根据温度获取点的颜色
function getPointColor(temp: number): string {
  if (temp < 0) return '#6366f1'
  if (temp < 10) return '#3b82f6'
  if (temp < 20) return '#6b7280'
  if (temp < 30) return '#f59e0b'
  return '#ef4444'
}

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

/**
 * 心情趋势折线图组件
 * 使用 Canvas API 绘制
 */
function MoodTrend({ data, onPointClick }: MoodTrendProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; title: string }>({
    visible: false,
    x: 0,
    y: 0,
    title: ''
  })
  // 存储数据点的位置信息
  const pointsRef = useRef<Array<{ x: number; y: number; uuid: string; title: string; radius: number }>>([])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 获取容器实际宽度
    const containerWidth = container.clientWidth
    const dpr = window.devicePixelRatio || 1
    
    // 设置 Canvas 尺寸（考虑高清屏）
    const width = containerWidth
    const height = 180
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    // 边距配置
    const padding = { top: 20, right: 20, bottom: 30, left: 40 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // 清空画布
    ctx.clearRect(0, 0, width, height)

    // 绘制温度区间色带
    TEMP_ZONES.forEach(zone => {
      const yTop = padding.top + (TEMP_MAX - zone.max) / TEMP_RANGE * chartHeight
      const yBottom = padding.top + (TEMP_MAX - zone.min) / TEMP_RANGE * chartHeight
      ctx.fillStyle = zone.color
      ctx.fillRect(padding.left, yTop, chartWidth, yBottom - yTop)
    })

    // 绘制网格线
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)'
    ctx.lineWidth = 0.5

    // 水平网格线（每10度一条）
    for (let temp = TEMP_MIN; temp <= TEMP_MAX; temp += 10) {
      const y = padding.top + (TEMP_MAX - temp) / TEMP_RANGE * chartHeight
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()

      // Y轴标签
      ctx.fillStyle = 'rgba(100, 100, 100, 0.8)'
      ctx.font = '10px system-ui'
      ctx.textAlign = 'right'
      ctx.fillText(`${temp}°`, padding.left - 5, y + 3)
    }

    if (!data || data.length === 0) {
      pointsRef.current = []
      return
    }

    // 计算数据点位置
    const points = data.map((point, index) => {
      const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth
      const y = padding.top + (TEMP_MAX - point.mood_score) / TEMP_RANGE * chartHeight
      return { x, y, ...point }
    })

    // 绘制渐变折线
    if (points.length > 1) {
      // 创建渐变
      const gradient = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0)
      points.forEach((point, index) => {
        const color = getPointColor(point.mood_score)
        gradient.addColorStop(index / (points.length - 1), color)
      })

      ctx.strokeStyle = gradient
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.stroke()
    }

    // 绘制数据点
    // 清空之前的数据点位置
    const currentPoints: Array<{ x: number; y: number; uuid: string; title: string; radius: number }> = []
    
    points.forEach((point, index) => {
      const color = getPointColor(point.mood_score)
      
      // 外圈光晕
      ctx.beginPath()
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = `${color}40`
      ctx.fill()

      // 实心点
      ctx.beginPath()
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      // 白色描边
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 1.5
      ctx.stroke()
      
      // 存储数据点位置信息（用于点击和悬停检测）
      currentPoints.push({
        x: point.x,
        y: point.y,
        uuid: point.note_uuid || '',
        title: point.note_title || '无标题',
        radius: 8 // 增大点击区域
      })

      // X轴日期标签（间隔显示避免重叠）
      if (data.length <= 7 || index % Math.ceil(data.length / 7) === 0 || index === data.length - 1) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.7)'
        ctx.font = '9px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(formatDate(point.date), point.x, height - 8)
      }
    })
    
    // 更新数据点位置引用
    pointsRef.current = currentPoints

  }, [data])

  // 处理鼠标移动
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 检查是否悬停在某数据点上
    let found = false
    for (const point of pointsRef.current) {
      const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2)
      if (distance <= point.radius) {
        setTooltip({
          visible: true,
          x: point.x,
          y: point.y,
          title: point.title
        })
        canvas.style.cursor = 'pointer'
        found = true
        break
      }
    }
    
    if (!found) {
      setTooltip(prev => ({ ...prev, visible: false }))
      canvas.style.cursor = 'default'
    }
  }

  // 处理点击
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !onPointClick) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 检查是否点击了某数据点
    for (const point of pointsRef.current) {
      const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2)
      if (distance <= point.radius && point.uuid) {
        onPointClick(point.uuid)
        break
      }
    }
  }

  // 处理鼠标离开
  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }))
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[180px] relative"
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {/* Tooltip 提示 */}
      {tooltip.visible && (
        <div
          className="absolute pointer-events-none bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10 transform -translate-x-1/2 -translate-y-full"
          style={{
            left: tooltip.x,
            top: tooltip.y - 10
          }}
        >
          {tooltip.title}
        </div>
      )}
      {(!data || data.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
          <p className="text-gray-500 text-sm">暂无心情趋势数据</p>
        </div>
      )}
    </div>
  )
}

export default memo(MoodTrend)
