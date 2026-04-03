"""
数据库初始化与操作模块
使用 SQLite3 存储笔记和心情记录
"""

import os
import sqlite3
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any


# 上海时区 (UTC+8)
SHANGHAI_TZ = timezone(timedelta(hours=8))


def get_shanghai_time() -> str:
    """
    获取上海时区的当前时间字符串
    
    Returns:
        str: ISO 格式的时间字符串
    """
    return datetime.now(SHANGHAI_TZ).isoformat()


# 数据库文件路径
BACKEND_DIR = Path(__file__).parent
DATA_DIR = BACKEND_DIR / 'data'
DB_PATH = DATA_DIR / 'mowen_mood.db'


def init_db() -> None:
    """
    初始化数据库和表
    自动创建 data/ 目录和数据库文件
    """
    # 确保 data/ 目录存在
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 创建 notes 表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            title TEXT,
            content TEXT,
            summary TEXT,
            mood_score REAL,
            weather_type TEXT,
            mood_label TEXT,
            reason TEXT,
            analyzed_at TIMESTAMP,
            published_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 创建 mood_records 表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mood_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_uuid TEXT NOT NULL,
            mood_score REAL NOT NULL,
            mood_label TEXT,
            analysis_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (note_uuid) REFERENCES notes(uuid)
        )
    ''')
    
    # 创建索引以优化查询性能
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_notes_uuid ON notes(uuid)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_mood_records_note_uuid ON mood_records(note_uuid)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_mood_records_created_at ON mood_records(created_at)')
    
    # 数据库迁移：添加新字段（如果不存在）
    try:
        # 检查 notes 表是否有 mood_label 字段
        cursor.execute("PRAGMA table_info(notes)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'mood_label' not in columns:
            cursor.execute('ALTER TABLE notes ADD COLUMN mood_label TEXT')
            print("数据库迁移: 添加 mood_label 字段")
        
        if 'reason' not in columns:
            cursor.execute('ALTER TABLE notes ADD COLUMN reason TEXT')
            print("数据库迁移: 添加 reason 字段")
    except Exception as e:
        print(f"数据库迁移警告: {e}")
    
    conn.commit()
    conn.close()
    
    print(f"数据库初始化完成: {DB_PATH}")


def get_db() -> sqlite3.Connection:
    """
    获取数据库连接
    返回的连接使用 Row 工厂，支持按列名访问
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def save_note(note_data: Dict[str, Any]) -> bool:
    """
    保存或更新笔记
    如果 uuid 已存在则更新，否则插入新记录
    
    Args:
        note_data: 笔记数据字典，必须包含 'uuid' 字段
        
    Returns:
        bool: 操作是否成功
    """
    required_field = 'uuid'
    if required_field not in note_data:
        raise ValueError(f"笔记数据必须包含 '{required_field}' 字段")
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # 检查笔记是否已存在
        cursor.execute('SELECT id FROM notes WHERE uuid = ?', (note_data['uuid'],))
        existing = cursor.fetchone()
        
        if existing:
            # 更新现有笔记
            update_fields = []
            update_values = []
            
            for field in ['title', 'content', 'summary', 'mood_score', 
                          'weather_type', 'mood_label', 'reason', 'analyzed_at', 'published_at']:
                if field in note_data:
                    update_fields.append(f'{field} = ?')
                    update_values.append(note_data[field])
            
            if update_fields:
                update_values.append(note_data['uuid'])
                sql = f"UPDATE notes SET {', '.join(update_fields)} WHERE uuid = ?"
                cursor.execute(sql, update_values)
        else:
            # 插入新笔记
            fields = ['uuid']
            values = [note_data['uuid']]
            placeholders = ['?']
            
            for field in ['title', 'content', 'summary', 'mood_score', 
                          'weather_type', 'mood_label', 'reason', 'analyzed_at', 'published_at']:
                if field in note_data:
                    fields.append(field)
                    values.append(note_data[field])
                    placeholders.append('?')
            
            # 自动设置 created_at 为上海时区时间
            fields.append('created_at')
            values.append(get_shanghai_time())
            placeholders.append('?')
            
            sql = f"INSERT INTO notes ({', '.join(fields)}) VALUES ({', '.join(placeholders)})"
            cursor.execute(sql, values)
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"保存笔记失败: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()


def get_notes(limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
    """
    获取笔记列表
    按创建时间倒序排列
    
    Args:
        limit: 返回的最大记录数，默认 20
        offset: 跳过的记录数，默认 0
        
    Returns:
        List[Dict]: 笔记列表
    """
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, uuid, title, content, summary, mood_score, 
                   weather_type, mood_label, reason, analyzed_at, published_at, created_at
            FROM notes
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        ''', (limit, offset))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
        
    finally:
        conn.close()


def get_notes_count() -> int:
    """
    获取笔记总数
    
    Returns:
        int: 笔记总数
    """
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('SELECT COUNT(*) FROM notes')
        count = cursor.fetchone()[0]
        return count
        
    finally:
        conn.close()


def get_mood_trend(days: int = 30) -> List[Dict[str, Any]]:
    """
    获取心情趋势数据
    返回指定天数内的心情记录，按时间排序
    
    Args:
        days: 查询的天数范围，默认 30 天
        
    Returns:
        List[Dict]: 心情趋势数据
    """
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT mr.id, mr.note_uuid, mr.mood_score, mr.mood_label, 
                   mr.analysis_reason, mr.created_at,
                   n.title as note_title
            FROM mood_records mr
            LEFT JOIN notes n ON mr.note_uuid = n.uuid
            WHERE mr.created_at >= datetime('now', ?)
            ORDER BY mr.created_at ASC
        ''', (f'-{days} days',))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
        
    finally:
        conn.close()


def save_mood_record(record: Dict[str, Any]) -> bool:
    """
    保存心情记录
    
    Args:
        record: 心情记录字典，必须包含 'note_uuid' 和 'mood_score' 字段
        
    Returns:
        bool: 操作是否成功
    """
    required_fields = ['note_uuid', 'mood_score']
    for field in required_fields:
        if field not in record:
            raise ValueError(f"心情记录必须包含 '{field}' 字段")
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        fields = ['note_uuid', 'mood_score']
        values = [record['note_uuid'], record['mood_score']]
        placeholders = ['?', '?']
        
        for field in ['mood_label', 'analysis_reason', 'created_at']:
            if field in record:
                fields.append(field)
                values.append(record[field])
                placeholders.append('?')
        
        sql = f"INSERT INTO mood_records ({', '.join(fields)}) VALUES ({', '.join(placeholders)})"
        cursor.execute(sql, values)
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"保存心情记录失败: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()


def get_note_by_uuid(uuid: str) -> Optional[Dict[str, Any]]:
    """
    根据 UUID 获取单个笔记
    
    Args:
        uuid: 笔记的唯一标识
        
    Returns:
        Dict 或 None: 笔记数据，不存在则返回 None
    """
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, uuid, title, content, summary, mood_score, 
                   weather_type, mood_label, reason, analyzed_at, published_at, created_at
            FROM notes
            WHERE uuid = ?
        ''', (uuid,))
        
        row = cursor.fetchone()
        return dict(row) if row else None
        
    finally:
        conn.close()
