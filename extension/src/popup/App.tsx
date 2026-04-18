import { useState, useEffect, useCallback } from 'react'
import type { Note, TrendPoint, MoodAnalysisResult, WeatherType, ExtensionMessage, ExtensionResponse } from '../types'
import { api } from '../services/api'
import { parseMowenUidFromCookie } from '../utils/mowenUid'

/** 优先请求 user.mowen.cn profile，失败则解析 Cookie 中 JWT */
async function getMowenUid(cookie: string): Promise<string | null> {
  if (!cookie.trim()) return null
  if (isChromeExtension()) {
    const res = await sendMessage({ type: 'FETCH_MOWEN_UID', payload: { cookie } })
    if (res.success && res.data?.uid) {
      return res.data.uid as string
    }
  }
  return parseMowenUidFromCookie(cookie)
}
import WeatherBackground from '../components/WeatherBackground'
import MoodTrend from '../components/MoodTrend'
import NoteList from '../components/NoteList'
import ShareMood from '../components/ShareMood'

type ViewScope = 'mowen' | 'mine'

// 根据最新温度计算当前天气类型
function getWeatherType(moodScore: number | null): WeatherType {
  if (moodScore === null) return 'cloudy'
  if (moodScore < 0) return 'storm'
  if (moodScore < 10) return 'rain'
  if (moodScore < 20) return 'cloudy'
  if (moodScore < 30) return 'sunny'
  return 'hot'
}

// 检测是否在 Chrome 扩展环境
function isChromeExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.sendMessage
}

// 发送消息到 background script
async function sendMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  if (!isChromeExtension()) {
    // 开发环境返回模拟数据
    console.log('[Dev Mode] Message:', message)
    return { success: false, error: '开发环境不支持 Chrome API' }
  }
  
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: ExtensionResponse) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message })
      } else {
        resolve(response || { success: false, error: '无响应' })
      }
    })
  })
}

async function fetchMowenCookie(): Promise<string> {
  if (!isChromeExtension()) return ''
  const res = await sendMessage({ type: 'GET_COOKIE' })
  if (res.success && res.data?.cookie) return res.data.cookie as string
  return ''
}

/**
 * 主应用组件
 */
function App() {
  // 状态管理
  const [viewScope, setViewScope] = useState<ViewScope>('mine')
  const [myUid, setMyUid] = useState<string | null>(null)
  const [myUidLoading, setMyUidLoading] = useState(() => isChromeExtension())
  const [notes, setNotes] = useState<Note[]>([])
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('cloudy')
  const [isDetailPage, setIsDetailPage] = useState(false)
  const [currentNoteUuid, setCurrentNoteUuid] = useState<string | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<MoodAnalysisResult | null>(null)
  const [refreshingNotes, setRefreshingNotes] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  /** 当前用户 uid：profile 接口优先，失败再解析 _MWT */
  const resolveAuthorUidForMine = useCallback(async (): Promise<string | null> => {
    if (myUid) return myUid
    const cookie = await fetchMowenCookie()
    if (!cookie) return null
    const uid = await getMowenUid(cookie)
    if (uid) setMyUid(uid)
    return uid
  }, [myUid])

  // 解析当前用户 id（预加载，便于切换「我的」时已有 uid）
  useEffect(() => {
    if (!isChromeExtension()) {
      setMyUidLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const cookie = await fetchMowenCookie()
      if (cancelled) return
      if (!cookie) {
        setMyUidLoading(false)
        return
      }
      const uid = await getMowenUid(cookie)
      if (!cancelled && uid) {
        setMyUid(uid)
      }
      if (!cancelled) setMyUidLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 加载数据（笔记 + 心情趋势图）；silent 用于定时刷新，不整页 loading、不弹错误条
  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true

    let authorParam: string | undefined
    if (viewScope === 'mine') {
      if (myUidLoading && !myUid) {
        if (!silent) setLoading(true)
        return
      }
      const uid =
        myUid ?? (await resolveAuthorUidForMine())
      if (!uid) {
        if (!silent) {
          setLoading(false)
          setNotes([])
          setTrendData([])
          setHasMore(false)
          setCurrentWeather('cloudy')
        }
        return
      }
      authorParam = uid
    }

    if (!silent) {
      setLoading(true)
      setError(null)
    }

    try {
      const [notesRes, trendRes] = await Promise.all([
        api.getNotes(10, 0, authorParam),
        api.getMoodTrend(authorParam),
      ])

      if (notesRes.success && notesRes.data) {
        setNotes(notesRes.data.notes || [])
        setHasMore(notesRes.data.hasMore || false)
      } else {
        console.warn('获取笔记失败:', notesRes.message)
      }

      if (trendRes.success) {
        setTrendData(trendRes.data || [])
        // 根据最新趋势数据设置天气
        if (trendRes.data && trendRes.data.length > 0) {
          const latestScore = trendRes.data[trendRes.data.length - 1].mood_score
          setCurrentWeather(getWeatherType(latestScore))
        }
      } else {
        console.warn('获取趋势数据失败:', trendRes.message)
      }
    } catch (err) {
      if (silent) {
        console.error('定时刷新失败:', err)
      } else {
        setError('加载数据失败，请检查后端服务是否运行')
        console.error('加载数据失败:', err)
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [viewScope, myUid, myUidLoading, resolveAuthorUidForMine])

  // 仅刷新笔记列表（重新从第一页加载）
  const refreshNotes = useCallback(async () => {
    if (viewScope === 'mine' && myUidLoading && !myUid) return
    let authorParam: string | undefined
    if (viewScope === 'mine') {
      const uid = myUid ?? (await resolveAuthorUidForMine())
      if (!uid) return
      authorParam = uid
    }
    setRefreshingNotes(true)
    try {
      const notesRes = await api.getNotes(10, 0, authorParam)
      if (notesRes.success && notesRes.data) {
        setNotes(notesRes.data.notes || [])
        setHasMore(notesRes.data.hasMore || false)
      }
    } catch (err) {
      console.error('刷新笔记失败:', err)
    } finally {
      setRefreshingNotes(false)
    }
  }, [viewScope, myUid, myUidLoading, resolveAuthorUidForMine])

  // 加载更多笔记
  const loadMoreNotes = useCallback(async () => {
    if (loadingMore || !hasMore) return
    if (viewScope === 'mine' && myUidLoading && !myUid) return

    let authorParam: string | undefined
    if (viewScope === 'mine') {
      const uid = myUid ?? (await resolveAuthorUidForMine())
      if (!uid) return
      authorParam = uid
    }

    setLoadingMore(true)
    try {
      const offset = notes.length
      const notesRes = await api.getNotes(10, offset, authorParam)
      if (notesRes.success && notesRes.data) {
        setNotes(prev => [...prev, ...(notesRes.data.notes || [])])
        setHasMore(notesRes.data.hasMore || false)
      }
    } catch (err) {
      console.error('加载更多笔记失败:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [notes.length, hasMore, loadingMore, viewScope, myUid, myUidLoading, resolveAuthorUidForMine])

  // 检测当前页面是否是笔记详情页
  const checkCurrentPage = useCallback(async () => {
    if (!isChromeExtension()) {
      setIsDetailPage(false)
      setCurrentNoteUuid(null)
      return
    }

    try {
      // 侧栏模式：获取当前活跃的 tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      
      console.log('[检测页面] tab URL:', tab?.url)
      
      if (!tab?.url) {
        setIsDetailPage(false)
        setCurrentNoteUuid(null)
        return
      }

      // 检查是否在墨问笔记详情页
      const match = tab.url.match(/note\.mowen\.cn\/detail\/([^\/]+)/)
      if (match) {
        const newUuid = match[1]
        setIsDetailPage(true)
        setCurrentNoteUuid(newUuid)
        console.log('[检测页面] 检测到笔记详情, UUID:', newUuid)
        
        // 如果 UUID 变化了，清除之前的分析结果
        if (newUuid !== currentNoteUuid) {
          setAnalysisResult(null)
        }
      } else {
        setIsDetailPage(false)
        setCurrentNoteUuid(null)
        console.log('[检测页面] 非笔记详情页')
      }
    } catch (err) {
      console.error('检测当前页面失败:', err)
      setIsDetailPage(false)
      setCurrentNoteUuid(null)
    }
  }, [currentNoteUuid])

  // 拉取列表与趋势（勿与 checkCurrentPage 同 effect，避免切换浏览器 tab 重复请求）
  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    checkCurrentPage()
  }, [checkCurrentPage])

  // 监听 tab 切换事件，重新检测当前页面
  useEffect(() => {
    if (!isChromeExtension()) return

    const handleTabChange = () => {
      checkCurrentPage()
    }

    // 监听 tab 切换
    chrome.tabs.onActivated.addListener(handleTabChange)
    // 监听 tab URL 变化
    chrome.tabs.onUpdated.addListener(handleTabChange)

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange)
      chrome.tabs.onUpdated.removeListener(handleTabChange)
    }
  }, [checkCurrentPage])

  // 每 1 分钟自动刷新笔记列表 + 心情趋势图
  useEffect(() => {
    const interval = setInterval(() => {
      loadData({ silent: true })
    }, 60000)

    return () => clearInterval(interval)
  }, [loadData])

  // 共享心情处理
  const handleAnalyze = useCallback(async () => {
    if (!currentNoteUuid) {
      setError('无法获取当前笔记信息')
      return
    }

    setAnalysisLoading(true)
    setAnalysisResult(null)

    try {
      // 通过 background 获取 cookie 并分析
      const response = await sendMessage({
        type: 'ANALYZE_NOTE',
        payload: { uuid: currentNoteUuid },
      })

      if (response.success && response.data) {
        setAnalysisResult(response.data as MoodAnalysisResult)
        // 刷新数据
        await loadData()
      } else {
        setError(response.error || '分析失败')
      }
    } catch (err) {
      setError('分析请求失败')
      console.error('分析失败:', err)
    } finally {
      setAnalysisLoading(false)
    }
  }, [currentNoteUuid, loadData])

  return (
    <div className="h-screen relative overflow-hidden flex flex-col">
      {/* 动态天气背景 */}
      <WeatherBackground weatherType={currentWeather} />

      {/* 内容层 */}
      <div className="relative z-10 flex flex-col h-full">
        {/* 顶部：我的 / 墨问 切换 */}
        <header className="flex-shrink-0 px-4 py-3 flex items-center">
          <div className="flex rounded-lg bg-gray-200/90 p-0.5 shadow-inner">
            <button
              type="button"
              onClick={() => setViewScope('mine')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewScope === 'mine'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              我的
            </button>
            <button
              type="button"
              onClick={() => setViewScope('mowen')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewScope === 'mowen'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              墨问
            </button>
          </div>
        </header>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-50 backdrop-blur-sm">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* 心情趋势图区域 */}
        <section className="flex-shrink-0 px-4 pb-3">
          <div className="rounded-xl bg-white shadow p-3 overflow-hidden">
            {loading ? (
              <div className="h-[180px] flex items-center justify-center">
                <div className="flex items-center gap-2 text-gray-500">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm">加载中...</span>
                </div>
              </div>
            ) : (
              <MoodTrend 
                data={trendData} 
                onPointClick={(uuid) => {
                  if (uuid) {
                    // 打开笔记详情页
                    const noteUrl = `https://note.mowen.cn/detail/${uuid}`
                    window.open(noteUrl, '_blank')
                  }
                }}
              />
            )}
          </div>
        </section>

        {/* 共享心情按钮区域 */}
        <section className="flex-shrink-0 px-4">
          <ShareMood
            onAnalyze={handleAnalyze}
            isDetailPage={isDetailPage}
            isLoading={analysisLoading}
            result={analysisResult}
          />
        </section>

        {/* 笔记列表区域 */}
        <section className="flex-1 min-h-0 flex flex-col px-4 pb-4 pt-2">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h2 className="text-sm font-medium text-gray-600">最近笔记</h2>
            <button
              onClick={refreshNotes}
              disabled={refreshingNotes}
              className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="刷新笔记列表"
            >
              <svg 
                className={`w-4 h-4 text-gray-500 ${refreshingNotes ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden rounded-xl bg-gray-50 shadow p-2">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <span className="text-sm text-gray-500">加载中...</span>
              </div>
            ) : (
              <NoteList 
                notes={notes} 
                onLoadMore={loadMoreNotes} 
                loadingMore={loadingMore}
                hasMore={hasMore}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
