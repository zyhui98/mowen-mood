import { memo, useEffect, useState } from 'react'

const COLOR_PRESETS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
] as const

const EMOJI_PRESETS = ['😀', '😊', '🥰', '😢', '😤', '🎉', '🌟', '❤️', '🔥', '💪', '🌈', '✨'] as const

interface MoodDanmakuModalProps {
  open: boolean
  onClose: () => void
  submitting: boolean
  /** 提交失败时的提示（仅展示在弹框内） */
  errorMessage?: string | null
  onClearError?: () => void
  onSubmit: (payload: { content: string; color: string; emoji: string }) => Promise<void>
}

function MoodDanmakuModal({
  open,
  onClose,
  submitting,
  errorMessage,
  onClearError,
  onSubmit,
}: MoodDanmakuModalProps) {
  const [content, setContent] = useState('')
  const [color, setColor] = useState<string>(COLOR_PRESETS[5])
  const [emoji, setEmoji] = useState('')

  useEffect(() => {
    if (open) {
      setContent('')
      setColor(COLOR_PRESETS[5])
      setEmoji('')
    }
  }, [open])

  const clearErrorIfAny = () => {
    if (errorMessage && onClearError) onClearError()
  }

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = content.trim()
    if (!t) return
    await onSubmit({ content: t, color, emoji })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="danmaku-modal-title"
      >
        <h2 id="danmaku-modal-title" className="text-base font-semibold text-gray-900 mb-3">
          发心情弹幕
        </h2>

        {errorMessage ? (
          <div
            className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600 leading-relaxed"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">心情内容</label>
            <textarea
              value={content}
              onChange={(e) => {
                clearErrorIfAny()
                setContent(e.target.value.slice(0, 120))
              }}
              rows={3}
              placeholder="写一句此刻的心情…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none resize-none"
              maxLength={120}
              autoFocus
            />
            <p className="text-[10px] text-gray-400 mt-0.5 text-right">{content.length}/120</p>
          </div>

          <div>
            <span className="block text-xs text-gray-500 mb-2">心情颜色</span>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    clearErrorIfAny()
                    setColor(c)
                  }}
                  className={`h-8 w-8 rounded-full border-2 transition-transform shrink-0 ${
                    color === c ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs text-gray-500 mb-2">表情</span>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_PRESETS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    clearErrorIfAny()
                    setEmoji(em)
                  }}
                  className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    emoji === em ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '发送中…' : '发送'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default memo(MoodDanmakuModal)
