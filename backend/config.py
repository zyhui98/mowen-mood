"""
配置加载模块
从项目根目录的 .env 文件加载 API 配置
"""

import os
from pathlib import Path


def load_env_config() -> dict:
    """
    从 .env 文件加载配置
    .env 文件位于 backend/ 的上一级目录
    格式为: api.key=value (使用点号分隔)
    """
    config = {}
    
    # 获取 .env 文件路径（backend/ 的上一级目录）
    backend_dir = Path(__file__).parent
    env_path = backend_dir.parent / '.env'
    
    if not env_path.exists():
        print(f"警告: .env 文件不存在: {env_path}")
        return config
    
    # 解析 .env 文件
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # 跳过空行和注释
            if not line or line.startswith('#'):
                continue
            
            # 解析 key=value 格式
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                
                # 将点号分隔的 key 转换为下划线格式
                # 例如: api.key -> API_KEY
                normalized_key = key.replace('.', '_').upper()
                config[normalized_key] = value
    
    return config


class Config:
    """应用配置类"""
    
    def __init__(self):
        # 加载 .env 配置
        env_config = load_env_config()
        
        # OpenAI 兼容 API 配置（阿里云等）
        self.API_KEY = env_config.get('API_KEY', '')
        self.API_URL = env_config.get('API_URL', '')
        self.API_LLM = env_config.get('API_LLM', '')
        
        # 智谱 API 配置
        self.ZHIPU_KEY = env_config.get('ZHIPU_KEY', '')
        self.ZHIPU_LLM = env_config.get('ZHIPU_LLM', '')
        
        # LLM 提供商选择：openai | zhipuai
        self.LLM_PROVIDER = env_config.get('LLM_PROVIDER', 'openai').lower()
        
        # 墨问笔记 Cookie
        self.COOKIE = env_config.get('COOKIE', '')
        
        # Flask 配置
        self.DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
        self.HOST = os.environ.get('FLASK_HOST', '0.0.0.0')
        self.PORT = int(os.environ.get('FLASK_PORT', 15001))


# 全局配置实例
config = Config()


# 导出配置字典（便于其他模块使用）
def get_config() -> dict:
    """获取配置字典"""
    return {
        'api_key': config.API_KEY,
        'api_url': config.API_URL,
        'api_llm': config.API_LLM,
        'zhipu_key': config.ZHIPU_KEY,
        'zhipu_llm': config.ZHIPU_LLM,
        'llm_provider': config.LLM_PROVIDER,
        'debug': config.DEBUG,
        'host': config.HOST,
        'port': config.PORT,
    }
