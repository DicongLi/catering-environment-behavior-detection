import cv2
import numpy as np
import face_recognition
import os
import time
from ultralytics import YOLO

# 初始化人脸识别部分
face_path = 'ImagesAttendance'
face_images = []
face_classNames = []
face_list = os.listdir(face_path)
print("加载的人脸图像:", face_list)
for cl in face_list:
    curImg = cv2.imread(f'{face_path}/{cl}')
    face_images.append(curImg)
    face_classNames.append(os.path.splitext(cl)[0])
print("注册的人名列表:", face_classNames)


def findFaceEncodings(images):
    encodeList = []
    for img in images:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        encode = face_recognition.face_encodings(img)[0]
        encodeList.append(encode)
    return encodeList


# 初始化真人检测部分
model = YOLO("../models/l_version_1_300.pt")  # 替换为你的模型路径
real_classNames = ["fake", "real"]
confidence_threshold = 0.8

# 生成已知人脸编码
encodeListKnown = findFaceEncodings(face_images)
print('编码完成，开始摄像头识别...')

cap = cv2.VideoCapture(0)
redirect_flag = False
redirect_timer = 0

while True:
    success, img = cap.read()
    if not success:
        break

    # 人脸识别处理
    imgS = cv2.resize(img, (0, 0), None, 0.25, 0.25)
    imgS = cv2.cvtColor(imgS, cv2.COLOR_BGR2RGB)

    facesCurFrame = face_recognition.face_locations(imgS)
    encodesCurFrame = face_recognition.face_encodings(imgS, facesCurFrame)

    # 真人检测处理
    results = model(img, stream=True, verbose=False)

    # 初始化状态
    recognized_name = None
    is_real_person = False

    # 先处理人脸识别
    for encodeFace, faceLoc in zip(encodesCurFrame, facesCurFrame):
        matches = face_recognition.compare_faces(encodeListKnown, encodeFace)
        faceDis = face_recognition.face_distance(encodeListKnown, encodeFace)
        matchIndex = np.argmin(faceDis)

        if matches[matchIndex]:
            recognized_name = face_classNames[matchIndex].upper()
            y1, x2, y2, x1 = faceLoc
            y1, x2, y2, x1 = y1 * 4, x2 * 4, y2 * 4, x1 * 4

            # 检查是否为真人
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    x1_real, y1_real, x2_real, y2_real = box.xyxy[0]
                    x1_real, y1_real, x2_real, y2_real = int(x1_real), int(y1_real), int(x2_real), int(y2_real)
                    conf = math.ceil((box.conf[0] * 100)) / 100
                    cls = int(box.cls[0])

                    # 检查检测框是否与人脸框重叠
                    if (conf > confidence_threshold and
                            x1_real < x2 and x2_real > x1 and
                            y1_real < y2 and y2_real > y1):
                        is_real_person = (real_classNames[cls] == 'real')
                        break

    # 绘制结果
    for encodeFace, faceLoc in zip(encodesCurFrame, facesCurFrame):
        y1, x2, y2, x1 = faceLoc
        y1, x2, y2, x1 = y1 * 4, x2 * 4, y2 * 4, x1 * 4

        if recognized_name:
            if is_real_person:
                # 匹配且为真人 - 绿色框
                color = (0, 255, 0)
                label = recognized_name

                # 设置跳转标志
                if not redirect_flag:
                    redirect_flag = True
                    redirect_timer = time.time()
            else:
                # 匹配但不是真人 - 红色框
                color = (0, 0, 255)
                label = "Fake " + recognized_name
        else:
            # 未匹配 - 红色框
            color = (0, 0, 255)
            label = "Undefined"

        # 绘制边界框和标签
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
        cv2.rectangle(img, (x1, y2 - 35), (x2, y2), color, cv2.FILLED)
        cv2.putText(img, label, (x1 + 6, y2 - 6), cv2.FONT_HERSHEY_PLAIN, 1, (255, 255, 255), 2)

    # 检查是否需要跳转
    if redirect_flag and (time.time() - redirect_timer) >= 2:
        print("条件满足，正在跳转页面...")
        window.location.href = '../reset_password/reset_password.html';
        redirect_flag = False  # 重置标志

    # 显示状态信息
    status_text = f"Status: {'Recognized' if recognized_name else 'Unknown'}"
    status_color = (0, 255, 0) if recognized_name else (0, 0, 255)
    cv2.putText(img, status_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, status_color, 2)

    cv2.imshow('Face Verification System', img)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()