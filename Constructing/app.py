from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import cv2
import numpy as np
import face_recognition
import os
import base64
import io
from PIL import Image
from ultralytics import YOLO
import math

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置
FACE_DATABASE_PATH = 'Registration_Images'
MODEL_PATH = 'models/l_version_1_300.pt'
CONFIDENCE_THRESHOLD = 0.8


class FaceRecognitionSystem:
    def __init__(self):
        self.face_images = []
        self.face_classNames = []
        self.encodeListKnown = []
        self.yolo_model = None
        self.real_classNames = ["fake", "real"]

        self.load_face_database()
        self.load_yolo_model()

    def load_face_database(self):
        """加载人脸数据库"""
        if not os.path.exists(FACE_DATABASE_PATH):
            os.makedirs(FACE_DATABASE_PATH)
            print(f"创建人脸数据库文件夹: {FACE_DATABASE_PATH}")
            return

        face_list = os.listdir(FACE_DATABASE_PATH)
        print(f"加载的人脸图像: {face_list}")

        for filename in face_list:
            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                img_path = os.path.join(FACE_DATABASE_PATH, filename)
                img = cv2.imread(img_path)
                if img is not None:
                    self.face_images.append(img)
                    # 文件名作为用户名（去掉扩展名）
                    username = os.path.splitext(filename)[0]
                    self.face_classNames.append(username)

        print(f"注册的用户列表: {self.face_classNames}")

        # 生成人脸编码
        if self.face_images:
            self.encodeListKnown = self.findFaceEncodings(self.face_images)
            print('人脸编码完成')
        else:
            print('警告: 没有找到任何人脸图像')

    def load_yolo_model(self):
        """加载YOLO活体检测模型"""
        try:
            if os.path.exists(MODEL_PATH):
                self.yolo_model = YOLO(MODEL_PATH)
                print('YOLO模型加载成功')
            else:
                print(f'警告: YOLO模型文件不存在: {MODEL_PATH}')
        except Exception as e:
            print(f'YOLO模型加载失败: {e}')

    def findFaceEncodings(self, images):
        """生成人脸编码"""
        encodeList = []
        for img in images:
            try:
                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                encodings = face_recognition.face_encodings(img_rgb)
                if encodings:
                    encodeList.append(encodings[0])
                else:
                    print("警告: 无法在图像中找到人脸")
            except Exception as e:
                print(f"编码生成失败: {e}")
        return encodeList

    def process_frame(self, frame):
        """处理单帧图像进行人脸识别和活体检测"""
        # 缩放图像以提高处理速度
        imgS = cv2.resize(frame, (0, 0), None, 0.25, 0.25)
        imgS = cv2.cvtColor(imgS, cv2.COLOR_BGR2RGB)

        # 人脸识别
        facesCurFrame = face_recognition.face_locations(imgS)
        encodesCurFrame = face_recognition.face_encodings(imgS, facesCurFrame)

        # YOLO活体检测
        yolo_results = []
        if self.yolo_model:
            try:
                results = self.yolo_model(frame, stream=True, verbose=False)
                for r in results:
                    if r.boxes is not None:
                        yolo_results.append(r.boxes)
            except Exception as e:
                print(f"YOLO检测失败: {e}")

        # 分析结果
        detection_results = []

        for encodeFace, faceLoc in zip(encodesCurFrame, facesCurFrame):
            y1, x2, y2, x1 = faceLoc
            # 还原到原始图像尺寸
            y1, x2, y2, x1 = y1 * 4, x2 * 4, y2 * 4, x1 * 4

            # 人脸识别匹配
            recognized_name = None
            is_real_person = False

            if self.encodeListKnown:
                matches = face_recognition.compare_faces(self.encodeListKnown, encodeFace)
                faceDis = face_recognition.face_distance(self.encodeListKnown, encodeFace)

                if matches and len(faceDis) > 0:
                    matchIndex = np.argmin(faceDis)
                    if matches[matchIndex]:
                        recognized_name = self.face_classNames[matchIndex]

            # 活体检测
            if yolo_results:
                for boxes in yolo_results:
                    for box in boxes:
                        x1_real, y1_real, x2_real, y2_real = box.xyxy[0]
                        x1_real, y1_real, x2_real, y2_real = int(x1_real), int(y1_real), int(x2_real), int(y2_real)
                        conf = math.ceil((box.conf[0] * 100)) / 100
                        cls = int(box.cls[0])

                        # 检查检测框是否与人脸框重叠
                        if (conf > CONFIDENCE_THRESHOLD and
                                x1_real < x2 and x2_real > x1 and
                                y1_real < y2 and y2_real > y1):
                            is_real_person = (self.real_classNames[cls] == 'real')
                            break

            # 构建结果
            result = {
                'face_location': [x1, y1, x2, y2],
                'recognized_name': recognized_name,
                'is_real_person': is_real_person,
                'status': self.get_status(recognized_name, is_real_person)
            }
            detection_results.append(result)

        return detection_results

    def get_status(self, recognized_name, is_real_person):
        """获取检测状态"""
        if recognized_name:
            if is_real_person:
                return 'success'  # 绿色框
            else:
                return 'fake'  # 红色框 - 伪造
        else:
            return 'unknown'  # 红色框 - 未识别

    def get_registered_users(self):
        """获取已注册用户列表"""
        return self.face_classNames


# 初始化人脸识别系统
face_system = FaceRecognitionSystem()


@app.route('/api/registered_users', methods=['GET'])
def get_registered_users():
    """获取已注册用户列表"""
    return jsonify({
        'success': True,
        'users': face_system.get_registered_users()
    })


@app.route('/api/verify_face', methods=['POST'])
def verify_face():
    """人脸验证API"""
    try:
        data = request.json
        if 'image' not in data:
            return jsonify({'success': False, 'error': '缺少图像数据'})

        # 解码base64图像
        image_data = data['image'].split(',')[1]  # 移除data:image/jpeg;base64,前缀
        image_bytes = base64.b64decode(image_data)

        # 转换为OpenCV格式
        image = Image.open(io.BytesIO(image_bytes))
        frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        # 处理图像
        results = face_system.process_frame(frame)

        return jsonify({
            'success': True,
            'results': results
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


@app.route('/api/reload_database', methods=['POST'])
def reload_database():
    """重新加载人脸数据库"""
    try:
        face_system.load_face_database()
        return jsonify({
            'success': True,
            'message': '人脸数据库重新加载成功',
            'users': face_system.get_registered_users()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


# 静态文件服务
@app.route('/')
def index():
    return send_from_directory('../frontend', 'face_verification.html')


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('../frontend', filename)


if __name__ == '__main__':
    print("启动人脸识别服务器...")
    print(f"人脸数据库路径: {FACE_DATABASE_PATH}")
    print(f"YOLO模型路径: {MODEL_PATH}")
    app.run(debug=False, host='0.0.0.0', port=5000, use_reloader=False)