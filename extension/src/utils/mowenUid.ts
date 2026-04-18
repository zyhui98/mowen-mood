/** 墨问用户 profile（与 note 页同源策略一致：origin/referer 用 note.mowen.cn） */
export const MOWEN_PROFILE_URL = 'https://user.mowen.cn/api/user/entry/v1/profile'

/**
 * 从 profile 接口 JSON 中解析 uid。
 * 墨问实际结构示例：顶层 { uid, profile: { base: { uid, name, ... }, avatar: { uid } } }
 */
export function extractUidFromProfileJson(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>

  // 顶层 uid（user/entry/v1/profile 主字段）
  if (o.uid != null && o.uid !== '') return String(o.uid)

  // 顶层 profile.base.uid / profile.avatar.uid
  const rootProfile = o.profile
  if (rootProfile && typeof rootProfile === 'object') {
    const rp = rootProfile as Record<string, unknown>
    if (rp.uid != null && rp.uid !== '') return String(rp.uid)
    const base = rp.base
    if (base && typeof base === 'object') {
      const b = base as Record<string, unknown>
      if (b.uid != null && b.uid !== '') return String(b.uid)
    }
    const avatar = rp.avatar
    if (avatar && typeof avatar === 'object') {
      const a = avatar as Record<string, unknown>
      if (a.uid != null && a.uid !== '') return String(a.uid)
    }
  }

  return null
}

/**
 * 从墨问 Cookie 中 _MWT JWT 解析 uid（profile 失败时的后备）
 */
export function parseMowenUidFromCookie(cookie: string): string | null {
  if (!cookie?.trim()) return null
  const m = cookie.match(/(?:^|;\s*)_MWT=([^;]+)/)
  if (!m) return null
  const token = m[1].trim()
  const parts = token.split('.')
  if (parts.length < 2) return null
  let payloadB64 = parts[1]
  const pad = 4 - (payloadB64.length % 4)
  if (pad !== 4) payloadB64 += '='.repeat(pad)
  try {
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    const jsonStr = atob(b64)
    const payload = JSON.parse(jsonStr) as { u?: string; sub?: string }
    const uid = payload.u ?? payload.sub
    return uid != null && uid !== '' ? String(uid) : null
  } catch {
    return null
  }
}
