# -*- coding: utf-8 -*-
"""
REST API 路由模块
使用 Flask Blueprint 组织所有 API 接口
"""

import re

from flask import Blueprint, request, jsonify

from database import (
    get_notes,
    get_mood_trend,
    get_note_by_uuid,
    get_notes_count,
    get_mood_danmaku_recent,
    save_mood_danmaku,
    count_mood_danmaku_by_author_recent,
)
from mowen_client import (
    MowenClient,
    MowenAuthError,
    MowenAPIError,
    MowenNotePrivacyError,
)
from mood_analyzer import get_analyzer


# 创建 API 蓝图
api_bp = Blueprint('api', __name__, url_prefix='/api')

_MOOD_COLOR_HEX = re.compile(r'^#[0-9A-Fa-f]{6}$')


def success_response(data=None, message=None):
    """
    构建成功响应
    
    Args:
        data: 响应数据
        message: 可选的消息
        
    Returns:
        tuple: (响应字典, HTTP 状态码)
    """
    response = {'success': True}
    if data is not None:
        response['data'] = data
    if message:
        response['message'] = message
    return jsonify(response), 200


def error_response(message, status_code=500):
    """
    构建错误响应
    
    Args:
        message: 错误消息
        status_code: HTTP 状态码
        
    Returns:
        tuple: (响应字典, HTTP 状态码)
    """
    return jsonify({
        'success': False,
        'message': message
    }), status_code


@api_bp.route('/notes', methods=['GET'])
def get_notes_list():
    """
    获取已分析的笔记列表（带温度值）
    
    查询参数:
      - limit (默认 10)
      - offset (默认 0)
      - author_uid (可选) 传入则只返回该作者的笔记（「我的」）
    响应: {"success": true, "data": {"notes": [笔记列表], "total": 总数, "hasMore": 是否有更多}}
    """
    try:
        # 获取查询参数
        limit = request.args.get('limit', 10, type=int)
        offset = request.args.get('offset', 0, type=int)
        author_uid = request.args.get('author_uid', type=str)
        author_uid = author_uid.strip() if author_uid else None

        # 限制 limit 范围
        limit = max(1, min(100, limit))

        # 获取笔记列表
        notes = get_notes(limit, offset, author_uid=author_uid)

        # 获取总数（用于判断是否有更多）
        total = get_notes_count(author_uid=author_uid)
        has_more = offset + limit < total

        return success_response({
            'notes': notes,
            'total': total,
            'hasMore': has_more
        })

    except Exception as e:
        return error_response(f'获取笔记列表失败: {str(e)}', 500)


@api_bp.route('/mood/trend', methods=['GET'])
def get_mood_trend_data():
    """
    获取心情趋势数据
    
    查询参数:
      - days (可选)
      - author_uid (可选) 传入则只统计该作者的笔记心情（「我的」）
        
    响应: {"success": true, "data": [趋势数据点列表]}
    每个数据点包含: date, mood_score, weather_type, note_title
    """
    try:
        # 获取查询参数（可选）
        days = request.args.get('days', 30, type=int)
        days = max(1, min(365, days))
        author_uid = request.args.get('author_uid', type=str)
        author_uid = author_uid.strip() if author_uid else None

        # 获取趋势数据
        trend_data = get_mood_trend(days, author_uid=author_uid)
        
        # 格式化数据，确保包含所需字段
        formatted_data = []
        for record in trend_data:
            formatted_data.append({
                'date': record.get('created_at'),
                'mood_score': record.get('mood_score'),
                'weather_type': _get_weather_type(record.get('mood_score', 15)),
                'note_title': record.get('note_title', ''),
                'note_uuid': record.get('note_uuid', ''),
                'mood_label': record.get('mood_label', '')
            })
        
        return success_response(formatted_data)
        
    except Exception as e:
        return error_response(f'获取心情趋势失败: {str(e)}', 500)


def _get_weather_type(mood_score: float) -> str:
    """
    根据心情温度值返回天气类型
    
    Args:
        mood_score: 心情温度值 (-10 到 40)
        
    Returns:
        str: 天气类型
    """
    if mood_score is None:
        return 'cloudy'
    
    if mood_score < 0:
        return 'storm'
    elif mood_score < 10:
        return 'rain'
    elif mood_score < 20:
        return 'cloudy'
    elif mood_score < 30:
        return 'sunny'
    else:
        return 'hot'


@api_bp.route('/mood/danmaku', methods=['GET'])
def list_mood_danmaku():
    """
    最近一段时间内的心情弹幕（默认 24 小时，与「我的」视图一致时可按 author_uid 筛选）
    """
    try:
        hours = request.args.get('hours', 24, type=int)
        hours = max(1, min(168, hours))
        author_uid = request.args.get('author_uid', type=str)
        author_uid = author_uid.strip() if author_uid else None
        items = get_mood_danmaku_recent(hours=hours, author_uid=author_uid)
        return success_response(items)
    except Exception as e:
        return error_response(f'获取心情弹幕失败: {str(e)}', 500)


@api_bp.route('/mood/danmaku', methods=['POST'])
def create_mood_danmaku():
    """
    发布一条心情弹幕：content、color（#RRGGBB）、emoji；可选 author_uid
    """
    try:
        data = request.get_json()
        if not data:
            return error_response('请求体不能为空', 400)
        content = (data.get('content') or '').strip()
        if not content or len(content) > 120:
            return error_response('心情内容不能为空且不超过 120 字', 400)
        color = (data.get('color') or '#6366f1').strip()
        if not _MOOD_COLOR_HEX.match(color):
            return error_response('颜色须为 #RRGGBB 格式', 400)
        emoji = (data.get('emoji') or '')[:16]
        author_uid = data.get('author_uid')
        if author_uid is not None:
            author_uid = str(author_uid).strip() or None

        if author_uid:
            posted = count_mood_danmaku_by_author_recent(author_uid, 24)
            if posted >= 3:
                return error_response(
                    '每人每 24 小时最多发布 3 条心情弹幕，请稍后再试',
                    400,
                )

        if save_mood_danmaku(content, color, emoji, author_uid):
            return success_response({'ok': True})
        return error_response('保存失败', 500)
    except Exception as e:
        return error_response(f'发布心情弹幕失败: {str(e)}', 500)


@api_bp.route('/mood/analyze', methods=['POST'])
def analyze_single_note():
    """
    分析单篇笔记心情（"共享心情"按钮触发）
    
    请求体: {"cookie": "cookie字符串", "uuid": "笔记uuid"}
    响应: {"success": true, "data": {"is_mood_related": true, "mood_score": 25, ...}}
    """
    try:
        # 获取请求参数
        data = request.get_json()
        if not data:
            return error_response('请求体不能为空', 400)
        
        cookie = data.get('cookie')
        uuid = data.get('uuid')
        
        if not cookie:
            return error_response('缺少 cookie 参数', 400)
        if not uuid:
            return error_response('缺少 uuid 参数', 400)
        
        existing = get_note_by_uuid(uuid)
        if existing and existing.get('mood_score') is not None:
            return success_response({
                'is_mood_related': True,
                'mood_score': existing.get('mood_score'),
                'mood_label': existing.get('mood_label') or '',
                'weather_type': existing.get('weather_type')
                or _get_weather_type(existing.get('mood_score', 15)),
                'reason': existing.get('reason') or '',
            })

        # 创建墨问客户端获取笔记详情
        client = MowenClient(cookie)
        
        try:
            detail_response = client.fetch_note_detail(uuid)
            detail = MowenClient.parse_note_detail(detail_response)
        finally:
            client.close()
        
        if not detail:
            return error_response('无法获取笔记详情', 404)
        
        # 提取笔记信息
        title = detail.get('title', '')
        content_html = detail.get('content', '')
        content = MowenClient.extract_text_content(content_html)
        published_at = detail.get('publishedAt', detail.get('published_at'))
        
        author_uid = detail.get('uid') if detail else None

        # 获取分析器并分析心情
        analyzer = get_analyzer()
        result = analyzer.analyze_and_save(
            note_uuid=uuid,
            title=title,
            content=content,
            published_at=published_at,
            author_uid=author_uid
        )
        
        # 构建响应数据
        response_data = {
            'is_mood_related': result.get('is_mood_related', False),
            'mood_score': result.get('mood_score'),
            'mood_label': result.get('mood_label'),
            'weather_type': result.get('weather_type'),
            'reason': result.get('reason')
        }
        
        return success_response(response_data)
        
    except MowenAuthError as e:
        return error_response(str(e), 401)
    except MowenNotePrivacyError as e:
        return error_response(str(e), 400)
    except MowenAPIError as e:
        return error_response(str(e), 500)
    except ValueError as e:
        return error_response(str(e), 400)
    except Exception as e:
        return error_response(f'分析失败: {str(e)}', 500)
