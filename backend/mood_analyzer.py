# -*- coding: utf-8 -*-
"""
心情分析模块
支持多种大模型：OpenAI 兼容 API（阿里云等）和智谱 API
"""

import json
import logging
from typing import Optional
from datetime import datetime, timezone, timedelta

from config import get_config
from database import save_note, save_mood_record, get_note_by_uuid


# 上海时区 (UTC+8)
SHANGHAI_TZ = timezone(timedelta(hours=8))


def get_shanghai_time() -> str:
    """
    获取上海时区的当前时间字符串
    
    Returns:
        str: ISO 格式的时间字符串
    """
    return datetime.now(SHANGHAI_TZ).isoformat()


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# 系统 Prompt（精简版）
SYSTEM_PROMPT = """快速分析文章心情，输出JSON格式：
{"is_mood_related": boolean, "mood_score": -10~40, "mood_label": "标签", "reason": "原因(15字内)"}

规则：
1. 温度范围：-10~40（悲伤→兴奋），分段：-10~0不好,0~20正常,20~40开心
2. is_mood_related=false表示无个人情绪描述
3. mood_label：极度悲伤/难过/低落/平静/轻松/愉快/开心/兴奋/极度兴奋

只输出JSON，无其他文字。"""


class MoodAnalyzer:
    """心情分析器 - 使用大模型分析笔记心情"""
    
    # 温度到天气类型的映射
    WEATHER_MAP = {
        (-10, 0): "storm",     # 暴风雪
        (0, 10): "rain",       # 下雨
        (10, 20): "cloudy",    # 多云
        (20, 30): "sunny",     # 晴天
        (30, 40): "hot",       # 烈日
    }
    
    # 默认重试次数
    MAX_RETRIES = 2
    
    # 请求超时时间（秒）
    REQUEST_TIMEOUT = 60
    
    def __init__(self):
        """初始化，从 config 加载 API 配置"""
        config = get_config()
        
        # 获取 LLM 提供商配置
        self.provider = config.get('llm_provider', 'openai').lower()
        
        if self.provider == 'zhipuai':
            # 智谱 API
            self.api_key = config.get('zhipu_key', '')
            self.model = config.get('zhipu_llm', '')
            
            if not self.api_key:
                raise ValueError("智谱 API Key 未配置，请检查 .env 文件中的 zhipu.key")
            if not self.model:
                raise ValueError("智谱模型名称未配置，请检查 .env 文件中的 zhipu.llm")
            
            # 导入并初始化智谱客户端
            from zhipuai import ZhipuAI
            self.client = ZhipuAI(
                api_key=self.api_key,
                timeout=self.REQUEST_TIMEOUT
            )
            logger.info(f"MoodAnalyzer 初始化完成，使用智谱 API, 模型: {self.model}")
            
        else:
            # OpenAI 兼容 API（默认）
            from openai import OpenAI
            
            self.api_key = config.get('api_key', '')
            self.api_url = config.get('api_url', '')
            self.model = config.get('api_llm', '')
            
            if not self.api_key:
                raise ValueError("API Key 未配置，请检查 .env 文件中的 api.key")
            if not self.api_url:
                raise ValueError("API URL 未配置，请检查 .env 文件中的 api.url")
            if not self.model:
                raise ValueError("模型名称未配置，请检查 .env 文件中的 api.llm")
            
            # 初始化 OpenAI 客户端
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=self.api_url,
                timeout=self.REQUEST_TIMEOUT
            )
            logger.info(f"MoodAnalyzer 初始化完成，使用 OpenAI 兼容 API, 模型: {self.model}")
    
    def analyze_mood(self, text: str) -> dict:
        """
        分析单篇文本的心情
        
        Args:
            text: 要分析的文本内容
            
        Returns:
            dict: {
                "is_mood_related": bool,
                "mood_score": float,
                "mood_label": str,
                "weather_type": str,
                "reason": str
            }
        """
        if not text or not text.strip():
            logger.warning("输入文本为空")
            return self._default_result("输入文本为空")
        
        # 截取文本（避免超长文本）
        max_length = 2000
        if len(text) > max_length:
            text = text[:max_length] + "..."
            logger.info(f"文本过长，已截取前 {max_length} 字符")
        
        # 重试机制
        last_error = None
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                result = self._call_api(text)
                
                # 添加天气类型
                if result.get('is_mood_related', False):
                    result['weather_type'] = self.get_weather_type(result.get('mood_score', 15))
                else:
                    result['weather_type'] = 'cloudy'  # 默认天气
                
                logger.info(f"心情分析成功: score={result.get('mood_score')}, label={result.get('mood_label')}")
                return result
                
            except Exception as e:
                last_error = e
                logger.warning(f"第 {attempt} 次尝试失败: {str(e)}")
                
                if attempt < self.MAX_RETRIES:
                    logger.info(f"准备进行第 {attempt + 1} 次重试...")
        
        # 所有重试都失败
        logger.error(f"API 调用失败，已重试 {self.MAX_RETRIES} 次: {str(last_error)}")
        return self._default_result(f"分析失败: {str(last_error)}")
    
    def _call_api(self, text: str) -> dict:
        """
        调用 API 进行心情分析
        
        Args:
            text: 要分析的文本
            
        Returns:
            dict: 解析后的分析结果
        """
        import time
        
        request_params = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text}
            ]
        }
        logger.info(f"LLM 请求参数 (provider={self.provider}): {request_params}")
        
        # 记录开始时间
        start_time = time.time()
        logger.info("开始调用 LLM API...")
        
        # 根据提供商调用不同的 API
        if self.provider == 'zhipuai':
            # 智谱 API - 不使用流式输出和思考模式
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text}
                ],
                temperature=0.7,
                max_tokens=1024,
                top_p=0.9,
                stream=False,  # 禁用流式输出
                thinking={
                    "type": "disabled",
                },
            )
        else:
            # OpenAI 兼容 API - 不使用流式输出，禁止思考
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text}
                ],
                temperature=0.7,
                max_tokens=1024,
                top_p=0.9,
                stream=False,  # 禁用流式输出
                extra_body={
                    "enable_thinking": False  # 2. 尝试禁用模型思考过程 (针对支持该参数的模型)
                }
            )
        
        # 计算耗时
        elapsed_time = time.time() - start_time
        logger.info(f"LLM API 调用完成，耗时: {elapsed_time:.2f} 秒")
        
        # 提取响应内容
        content = response.choices[0].message.content.strip()
        logger.info(f"LLM 原始响应内容:\n{response}")
        
        # 解析 JSON
        result = self._parse_response(content)
        logger.info(f"LLM 解析后的结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
        
        return result
    
    def _parse_response(self, content: str) -> dict:
        """
        解析 API 响应的 JSON 内容
        
        Args:
            content: API 返回的文本内容
            
        Returns:
            dict: 解析后的结果
        """
        # 尝试直接解析
        try:
            result = json.loads(content)
            return self._validate_result(result)
        except json.JSONDecodeError:
            pass
        
        # 尝试提取 JSON 块（处理可能包含的 markdown 代码块）
        import re
        json_pattern = r'```(?:json)?\s*(\{.*?\})\s*```'
        match = re.search(json_pattern, content, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group(1))
                return self._validate_result(result)
            except json.JSONDecodeError:
                pass
        
        # 尝试提取任意 JSON 对象
        json_obj_pattern = r'\{[^{}]*\}'
        match = re.search(json_obj_pattern, content)
        if match:
            try:
                result = json.loads(match.group())
                return self._validate_result(result)
            except json.JSONDecodeError:
                pass
        
        # 解析失败
        logger.error(f"无法解析 JSON 响应: {content}")
        raise ValueError(f"无法解析响应内容为 JSON: {content[:100]}...")
    
    def _validate_result(self, result: dict) -> dict:
        """
        验证并规范化分析结果
        
        Args:
            result: 原始解析结果
            
        Returns:
            dict: 规范化后的结果
        """
        # 确保必要字段存在
        validated = {
            'is_mood_related': bool(result.get('is_mood_related', False)),
            'mood_score': float(result.get('mood_score', 15)),
            'mood_label': str(result.get('mood_label', '平静')),
            'reason': str(result.get('reason', ''))
        }
        
        # 限制 mood_score 范围
        validated['mood_score'] = max(-10, min(40, validated['mood_score']))
        
        return validated
    
    def _default_result(self, reason: str = "") -> dict:
        """
        返回默认结果（用于错误情况）
        
        Args:
            reason: 原因说明
            
        Returns:
            dict: 默认分析结果
        """
        return {
            'is_mood_related': False,
            'mood_score': 15,
            'mood_label': '平静',
            'weather_type': 'cloudy',
            'reason': reason
        }
    
    def get_weather_type(self, mood_score: float) -> str:
        """
        根据心情温度值返回天气类型
        
        Args:
            mood_score: 心情温度值 (-10 到 40)
            
        Returns:
            str: 天气类型 (storm, rain, cloudy, sunny, hot)
        """
        for (low, high), weather in self.WEATHER_MAP.items():
            if low <= mood_score < high:
                return weather
        
        # 边界情况
        if mood_score >= 40:
            return "hot"
        return "storm"
    
    def analyze_and_save(self, note_uuid: str, title: str, content: str,
                         published_at: Optional[str] = None,
                         author_uid: Optional[str] = None) -> dict:
        """
        分析笔记心情并保存到数据库
        
        Args:
            note_uuid: 笔记的唯一标识
            title: 笔记标题
            content: 笔记内容
            published_at: 发布时间（可选）
            
        Returns:
            dict: {
                "success": bool,
                "is_mood_related": bool,
                "mood_score": float,
                "mood_label": str,
                "weather_type": str,
                "reason": str,
                "saved": bool
            }
        """
        existing = get_note_by_uuid(note_uuid)
        if existing and existing.get('mood_score') is not None:
            ms = existing['mood_score']
            weather = existing.get('weather_type') or self.get_weather_type(float(ms))
            logger.info(
                '笔记已在库中，跳过 LLM 与写库: uuid=%s mood_score=%s',
                note_uuid,
                ms,
            )
            return {
                'success': True,
                'is_mood_related': True,
                'mood_score': float(ms),
                'mood_label': existing.get('mood_label') or '平静',
                'weather_type': weather,
                'reason': existing.get('reason') or '',
                'saved': False,
            }

        logger.info(f"开始分析笔记: uuid={note_uuid}, title={title[:30] if title else '无标题'}...")
        
        # 组合标题和内容进行分析
        full_text = f"标题：{title}\n\n{content}" if title else content
        
        # 1. 调用 analyze_mood 分析心情
        analysis = self.analyze_mood(full_text)
        
        result = {
            'success': True,
            'is_mood_related': analysis['is_mood_related'],
            'mood_score': analysis['mood_score'],
            'mood_label': analysis['mood_label'],
            'weather_type': analysis['weather_type'],
            'reason': analysis['reason'],
            'saved': False
        }
        
        # 2. 如果 is_mood_related 为 True，保存到数据库
        if analysis['is_mood_related']:
            try:
                # 保存笔记信息
                note_data = {
                    'uuid': note_uuid,
                    'title': title,
                    'content': content,
                    'mood_score': analysis['mood_score'],
                    'weather_type': analysis['weather_type'],
                    'mood_label': analysis['mood_label'],
                    'reason': analysis['reason'],
                    'analyzed_at': get_shanghai_time()
                }
                if published_at:
                    note_data['published_at'] = published_at
                if author_uid:
                    note_data['author_uid'] = author_uid

                note_saved = save_note(note_data)
                
                # 保存心情记录
                mood_record = {
                    'note_uuid': note_uuid,
                    'mood_score': analysis['mood_score'],
                    'mood_label': analysis['mood_label'],
                    'analysis_reason': analysis['reason']
                }
                record_saved = save_mood_record(mood_record)
                
                result['saved'] = note_saved and record_saved
                
                if result['saved']:
                    note_snapshot = {}
                    for k, v in note_data.items():
                        if k == 'content' and isinstance(v, str) and len(v) > 160:
                            note_snapshot[k] = v[:160] + '…'
                        else:
                            note_snapshot[k] = v
                    logger.info(
                        '笔记心情记录已保存 | notes 表: uuid=%s author_uid=%s 字段=%s | mood_records 表: %s',
                        note_uuid,
                        note_data.get('author_uid'),
                        json.dumps(note_snapshot, ensure_ascii=False, default=str),
                        json.dumps(mood_record, ensure_ascii=False, default=str),
                    )
                else:
                    logger.warning(f"笔记心情记录保存部分失败: note={note_saved}, record={record_saved}")
                    
            except Exception as e:
                logger.error(f"保存笔记心情记录失败: {str(e)}")
                result['success'] = False
                result['reason'] = f"保存失败: {str(e)}"
        else:
            logger.info(f"笔记不涉及心情描述，跳过保存: uuid={note_uuid}")
        
        return result


# 单例模式的分析器实例
_analyzer_instance: Optional[MoodAnalyzer] = None


def get_analyzer() -> MoodAnalyzer:
    """
    获取 MoodAnalyzer 单例实例
    
    Returns:
        MoodAnalyzer: 分析器实例
    """
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = MoodAnalyzer()
    return _analyzer_instance


# 便捷函数
def analyze_note(note_uuid: str, title: str, content: str,
                 published_at: Optional[str] = None,
                 author_uid: Optional[str] = None) -> dict:
    """
    分析笔记心情的便捷函数
    
    Args:
        note_uuid: 笔记的唯一标识
        title: 笔记标题
        content: 笔记内容
        published_at: 发布时间（可选）
        
    Returns:
        dict: 分析结果
    """
    analyzer = get_analyzer()
    return analyzer.analyze_and_save(note_uuid, title, content, published_at, author_uid)
