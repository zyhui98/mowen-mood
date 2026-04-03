"""
墨问 API 客户端模块
负责与墨问平台 API 对接，获取笔记列表和笔记详情
"""

import re
import time
import logging
from typing import Optional, Dict, Any, List
from html import unescape
from datetime import datetime, timezone, timedelta

import requests
from requests.exceptions import RequestException, Timeout, ConnectionError
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# 上海时区 (UTC+8)
SHANGHAI_TZ = timezone(timedelta(hours=8))


def timestamp_to_iso(timestamp: str) -> str:
    """
    将时间戳转换为 ISO 格式的时间字符串（上海时区）
    
    Args:
        timestamp: Unix 时间戳（秒）字符串
        
    Returns:
        str: ISO 格式的时间字符串
    """
    if not timestamp:
        return ''
    try:
        ts = int(timestamp)
        # 如果时间戳为 0，返回空字符串
        if ts == 0:
            return ''
        dt = datetime.fromtimestamp(ts, tz=SHANGHAI_TZ)
        return dt.isoformat()
    except (ValueError, TypeError):
        return ''


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MowenAPIError(Exception):
    """墨问 API 错误基类"""
    pass


class MowenAuthError(MowenAPIError):
    """认证错误（Cookie 失效或无效）"""
    pass


class MowenServerError(MowenAPIError):
    """服务端错误"""
    pass


class MowenClient:
    """墨问 API 客户端"""
    
    BASE_URL = "https://note.mowen.cn/api/note/wxa/v1/note"
    
    # 默认的 strategy 参数（用于获取笔记列表）
    DEFAULT_STRATEGY = "gqhzdHJhdGVneQGmcGFyYW1zgatwdWJlZF9hdF9sdKo0MDk4MTgyNDAw"
    
    # 请求配置
    REQUEST_TIMEOUT = 10  # 超时时间（秒）
    MAX_RETRIES = 3       # 最大重试次数
    RETRY_DELAY_BASE = 1  # 重试基础延迟（秒）
    
    def __init__(self, cookie: str):
        """
        初始化客户端
        
        Args:
            cookie: 墨问平台的用户 Cookie，由 Chrome 插件传入
        """
        if not cookie or not cookie.strip():
            raise ValueError("Cookie 不能为空")
        
        self.cookie = cookie.strip()
        self._session = requests.Session()
        logger.info("墨问客户端初始化完成")
    
    def _get_headers(self) -> Dict[str, str]:
        """
        构造请求头
        
        Returns:
            Dict[str, str]: 请求头字典
        """
        return {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'content-type': 'application/json',
            'origin': 'https://note.mowen.cn',
            'referer': 'https://note.mowen.cn/',
            'x-mo-ver-wxa': '1.69.3',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': self.cookie
        }
    
    def _request_with_retry(
        self, 
        method: str, 
        url: str, 
        json_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        带重试机制的请求方法
        
        Args:
            method: HTTP 方法（POST）
            url: 请求 URL
            json_data: JSON 请求体
            
        Returns:
            Dict: API 响应数据
            
        Raises:
            MowenAuthError: 认证失败（401）
            MowenServerError: 服务端错误（5xx）
            MowenAPIError: 其他 API 错误
        """
        logger.info(f"请求参数 - URL: {url}")
        logger.info(f"请求参数 - Method: {method}")
        logger.info(f"请求参数 - Headers: {self._get_headers()}")
        logger.info(f"请求参数 - Body: {json_data}")
        last_exception = None
        
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                logger.debug(f"发送请求 (尝试 {attempt}/{self.MAX_RETRIES}): {url}")
                
                response = self._session.request(
                    method=method,
                    url=url,
                    json=json_data,
                    headers=self._get_headers(),
                    timeout=self.REQUEST_TIMEOUT,
                    verify=False
                )
                
                # 处理认证错误
                if response.status_code == 401:
                    logger.error("认证失败: Cookie 可能已失效")
                    raise MowenAuthError("Cookie 已失效或无效，请重新登录墨问")
                
                # 处理服务端错误
                if response.status_code >= 500:
                    logger.warning(f"服务端错误: HTTP {response.status_code}")
                    raise MowenServerError(f"墨问服务端错误: HTTP {response.status_code}")
                
                # 处理其他 HTTP 错误
                if response.status_code >= 400:
                    logger.error(f"请求失败: HTTP {response.status_code}, 响应: {response.text[:500]}")
                    raise MowenAPIError(f"请求失败: HTTP {response.status_code}")
                
                # 解析响应
                data = response.json()
                
                # 打印响应内容
                # logger.info(f"响应内容: {data}")
                
                # 检查业务层错误码
                if isinstance(data, dict):
                    code = data.get('code')
                    if code is not None and code != 0:
                        error_msg = data.get('msg', data.get('message', '未知错误'))
                        # code 为特定值时可能表示认证问题
                        if code in [401, 403, -1001, -1002]:
                            raise MowenAuthError(f"认证失败: {error_msg}")
                        raise MowenAPIError(f"API 错误 (code={code}): {error_msg}")
                
                logger.info(f"请求成功: {url}")
                return data
                
            except MowenAuthError:
                # 认证错误不重试，直接抛出
                raise
                
            except (Timeout, ConnectionError) as e:
                last_exception = e
                logger.warning(f"网络错误 (尝试 {attempt}/{self.MAX_RETRIES}): {e}")
                
                if attempt < self.MAX_RETRIES:
                    # 递增延迟重试
                    delay = self.RETRY_DELAY_BASE * attempt
                    logger.info(f"等待 {delay} 秒后重试...")
                    time.sleep(delay)
                    
            except RequestException as e:
                last_exception = e
                logger.warning(f"请求异常 (尝试 {attempt}/{self.MAX_RETRIES}): {e}")
                
                if attempt < self.MAX_RETRIES:
                    delay = self.RETRY_DELAY_BASE * attempt
                    logger.info(f"等待 {delay} 秒后重试...")
                    time.sleep(delay)
                    
            except MowenServerError as e:
                last_exception = e
                logger.warning(f"服务端错误 (尝试 {attempt}/{self.MAX_RETRIES}): {e}")
                
                if attempt < self.MAX_RETRIES:
                    delay = self.RETRY_DELAY_BASE * attempt
                    logger.info(f"等待 {delay} 秒后重试...")
                    time.sleep(delay)
        
        # 所有重试都失败
        logger.error(f"请求失败，已达到最大重试次数: {last_exception}")
        raise MowenAPIError(f"请求失败，已重试 {self.MAX_RETRIES} 次: {last_exception}")
    
    def fetch_notes(self, page: int = 1, size: int = 20) -> Dict[str, Any]:
        """
        获取笔记列表
        
        Args:
            page: 页码，从 1 开始，默认 1
            size: 每页数量，默认 20
            
        Returns:
            Dict: 笔记列表响应数据
            
        Raises:
            MowenAuthError: Cookie 失效
            MowenAPIError: 其他 API 错误
        """
        url = f"{self.BASE_URL}/explore"
        
        payload = {
            "strategy": self.DEFAULT_STRATEGY,
            "paging": {
                "page": page,
                "size": size
            }
        }
        
        logger.info(f"获取笔记列表: page={page}, size={size}")
        
        return self._request_with_retry("POST", url, payload)
    
    def fetch_note_detail(self, uuid: str) -> Dict[str, Any]:
        """
        获取单篇笔记详情
        
        Args:
            uuid: 笔记的唯一标识
            
        Returns:
            Dict: 笔记详情响应数据
            
        Raises:
            ValueError: uuid 为空
            MowenAuthError: Cookie 失效
            MowenAPIError: 其他 API 错误
        """
        if not uuid or not uuid.strip():
            raise ValueError("笔记 UUID 不能为空")
        
        url = f"{self.BASE_URL}/show"
        
        payload = {
            "uuid": uuid.strip(),
            "peekKey": "",
            "accessToken": ""
        }
        
        logger.info(f"获取笔记详情: uuid={uuid}")
        
        result = self._request_with_retry("POST", url, payload)
        logger.info(f"笔记详情响应: {str(result)[:500]}")
        return result
    
    @staticmethod
    def extract_text_content(html_content: str) -> str:
        """
        从 HTML 内容中提取纯文本
        去除 HTML 标签、样式、脚本等
        
        Args:
            html_content: 包含 HTML 标签的原始内容
            
        Returns:
            str: 提取后的纯文本内容
        """
        if not html_content:
            return ""
        
        text = html_content
        
        # 移除 script 和 style 标签及其内容
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        
        # 将 <br> 和 <p> 等标签转换为换行
        text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</p>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</div>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</li>', '\n', text, flags=re.IGNORECASE)
        
        # 移除所有其他 HTML 标签
        text = re.sub(r'<[^>]+>', '', text)
        
        # 解码 HTML 实体
        text = unescape(text)
        
        # 清理多余的空白
        text = re.sub(r'\n\s*\n', '\n\n', text)  # 多个空行合并为两个
        text = re.sub(r'[ \t]+', ' ', text)       # 多个空格合并为一个
        text = text.strip()
        
        return text
    
    @staticmethod
    def parse_notes_response(response: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        解析笔记列表响应，提取笔记数据
        
        Args:
            response: fetch_notes 返回的原始响应
            
        Returns:
            List[Dict]: 笔记列表，每个笔记包含 uuid, title 等字段
        """
        if not response:
            return []
        
        # 尝试从常见的响应结构中提取数据
        data = response.get('data', response)
        
        if isinstance(data, dict):
            # 可能在 items, list 或 notes 字段中
            notes = data.get('items', data.get('list', data.get('notes', [])))
        elif isinstance(data, list):
            notes = data
        else:
            notes = []
        
        # 如果笔记有 noteBase 字段，需要提取 noteBase 中的数据
        parsed_notes = []
        for note in notes:
            if isinstance(note, dict):
                # 如果有 noteBase 字段，提取 noteBase 中的数据
                note_base = note.get('noteBase', {})
                if note_base:
                    parsed_notes.append({
                        'uuid': note_base.get('uuid'),
                        'uid': note_base.get('uid'),
                        'title': note_base.get('title', ''),
                        'digest': note_base.get('digest', ''),
                        'content': note_base.get('content', ''),
                        'createdAt': timestamp_to_iso(note_base.get('createdAt', '')),
                        'publishedAt': timestamp_to_iso(note_base.get('publishedAt') or note_base.get('publicAt', ''))
                    })
                else:
                    # 如果没有 noteBase 字段，直接使用 note
                    parsed_notes.append(note)
        
        logger.info(f"获取到笔记数量: {len(parsed_notes)}")
        return parsed_notes
    
    @staticmethod
    def parse_note_detail(response: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        解析笔记详情响应，提取笔记数据
        
        Args:
            response: fetch_note_detail 返回的原始响应
            
        Returns:
            Dict 或 None: 笔记详情数据
        """
        if not response:
            return None
        
        # 尝试从常见的响应结构中提取数据
        data = response.get('data', response)
        
        if isinstance(data, dict):
            # 如果有 noteBase 字段，提取 noteBase 中的数据
            note_base = data.get('noteBase', {})
            if note_base:
                return {
                    'uuid': note_base.get('uuid'),
                    'uid': note_base.get('uid'),
                    'title': note_base.get('title', ''),
                    'content': note_base.get('content', ''),
                    'digest': note_base.get('digest', ''),
                    'publishedAt': timestamp_to_iso(
                        note_base.get('publishedAt') or note_base.get('publicAt') or note_base.get('createdAt', '')
                    )
                }
            
            # 如果有 detail.noteBase 字段
            detail = data.get('detail', {})
            if detail:
                note_base = detail.get('noteBase', {})
                if note_base:
                    return {
                        'uuid': note_base.get('uuid'),
                        'title': note_base.get('title'),
                        'content': note_base.get('digest', ''),
                        'publishedAt': timestamp_to_iso(
                            note_base.get('publishedAt') or note_base.get('published_at') or note_base.get('createdAt', '')
                        )
                    }
            
            # 如果 data 中直接有 uuid 字段
            if 'uuid' in data:
                return data
        
        
        return None
    
    def close(self):
        """关闭客户端会话"""
        self._session.close()
        logger.info("墨问客户端会话已关闭")
    
    def __enter__(self):
        """支持 with 语句"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """退出时关闭会话"""
        self.close()
        return False
