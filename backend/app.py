"""
Flask 应用入口
墨问心情分析后端服务
"""

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime

from config import config
from database import init_db
from routes import api_bp


# 创建 Flask 应用
app = Flask(__name__)

# 开启 CORS，允许 Chrome 插件访问
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# 注册 API 路由蓝图
app.register_blueprint(api_bp)


@app.route('/privacy')
def privacy():
    """
    隐私政策页面
    用于 Chrome Web Store 审核
    """
    return send_from_directory('static', 'privacy.html')


@app.route('/api/health', methods=['GET'])
def health_check():
    """
    健康检查接口
    用于确认服务是否正常运行
    """
    return jsonify({
        'status': 'ok',
        'message': '墨问心情分析服务运行中',
        'timestamp': datetime.now().isoformat()
    })


# 应用启动时初始化数据库
with app.app_context():
    init_db()


if __name__ == '__main__':
    print(f"启动墨问心情分析服务...")
    print(f"监听地址: http://{config.HOST}:{config.PORT}")
    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=config.DEBUG
    )
