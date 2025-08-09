// 获取URL参数
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
const userType = urlParams.get('userType');

// 显示当前用户信息
if (username) {
    document.getElementById('userInfo').style.display = 'block';
    document.getElementById('currentUsername').textContent = username;
}

class RealFaceVerificationSystem {
    constructor() {
        this.video = document.getElementById('video');
        this.overlay = document.getElementById('overlay');
        this.cameraPlaceholder = document.getElementById('cameraPlaceholder');
        this.ctx = this.overlay.getContext('2d');
        this.status = document.getElementById('status');
        this.countdown = document.getElementById('countdown');

        this.isRunning = false;
        this.stream = null;
        this.detectionInterval = null;
        this.redirectTimer = null;
        this.successStartTime = null;
        this.canvas = document.createElement('canvas');
        this.canvasCtx = this.canvas.getContext('2d');

        // API配置
        this.apiBase = '/api';

        // 保存URL参数
        this.expectedUsername = username;
        this.userType = userType;

        this.initializeButtons();
        this.initializeCamera();
    }

    initializeButtons() {
        document.getElementById('startBtn').addEventListener('click', () => this.startVerification());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopVerification());
    }

    async initializeCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            this.video.srcObject = this.stream;

            this.video.addEventListener('loadedmetadata', () => {
                this.overlay.width = this.video.videoWidth;
                this.overlay.height = this.video.videoHeight;
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
            });
        } catch (error) {
            console.error('摄像头访问失败:', error);
            this.updateStatus('failed', '⚠️ 无法访问摄像头，请检查浏览器权限');
        }
    }

    startVerification() {
        this.isRunning = true;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;

        // 显示摄像头画面
        this.cameraPlaceholder.style.display = 'none';
        this.video.style.display = 'block';

        this.updateStatus('detecting', '🔍 正在检测人脸...');
        this.detectionInterval = setInterval(() => this.performFaceDetection(), 1000);
    }

    stopVerification() {
        this.isRunning = false;
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;

        // 隐藏摄像头画面
        this.video.style.display = 'none';
        this.cameraPlaceholder.style.display = 'flex';

        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }

        if (this.redirectTimer) {
            clearTimeout(this.redirectTimer);
            this.redirectTimer = null;
        }

        this.successStartTime = null;
        this.countdown.style.display = 'none';
        this.clearOverlay();
        this.updateStatus('waiting', '验证已停止，可重新开始');
    }

    async performFaceDetection() {
        if (!this.isRunning) return;

        try {
            // 捕获当前帧
            this.canvasCtx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            const imageData = this.canvas.toDataURL('image/jpeg', 0.8);

            // 发送到后端进行识别
            const response = await fetch(`${this.apiBase}/verify_face`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData
                })
            });

            const data = await response.json();

            if (data.success) {
                this.processDetectionResults(data.results);
            } else {
                this.updateStatus('failed', `❌ 检测失败: ${data.error}`);
            }

        } catch (error) {
            console.error('人脸检测失败:', error);
            this.updateStatus('failed', '❌ 无法连接到服务器');
        }
    }

    processDetectionResults(results) {
        this.clearOverlay();

        if (results.length === 0) {
            this.updateStatus('detecting', '🔍 正在检测人脸...');
            this.resetSuccessTimer();
            return;
        }

        // 处理检测结果
        let hasSuccess = false;

        for (const result of results) {
            // 首先检查用户身份是否匹配
            if (result.recognized_name && this.expectedUsername) {
                // 比较识别到的用户名与期望的用户名（忽略大小写）
                const isCorrectUser = result.recognized_name.toLowerCase() === this.expectedUsername.toLowerCase();
                
                if (!isCorrectUser) {
                    // 用户身份不匹配
                    result.status = 'wrong-user';
                    this.drawFaceBox(result);
                    this.updateStatus('wrong-user', `❌ 用户身份不匹配，请使用正确的账号`);
                    this.resetSuccessTimer();
                    continue;
                }
            }

            this.drawFaceBox(result);

            if (result.status === 'success') {
                hasSuccess = true;
                this.handleSuccessfulVerification(result.recognized_name);
            }
        }

        if (!hasSuccess && results.length > 0) {
            // 根据结果更新状态
            const result = results[0];
            if (result.status === 'fake') {
                this.updateStatus('fake', `⚠️ 检测到伪造：${result.recognized_name}`);
            } else if (result.status === 'wrong-user') {
                // 已经在上面处理过了
            } else {
                this.updateStatus('failed', '❌ 未识别的用户');
            }
            this.resetSuccessTimer();
        }
    }

    handleSuccessfulVerification(userName) {
        if (!this.successStartTime) {
            this.successStartTime = Date.now();
        }

        const elapsed = (Date.now() - this.successStartTime) / 1000;
        const remaining = Math.max(0, 2 - elapsed);

        if (remaining > 0) {
            this.updateStatus('success', `✅ 验证成功！欢迎回来，${userName}`);
            this.countdown.style.display = 'block';
            this.countdown.textContent = `${Math.ceil(remaining)}秒后跳转到密码重置页面...`;

            if (!this.redirectTimer) {
                this.redirectTimer = setTimeout(() => {
                    this.redirectToResetPassword();
                }, 2000);
            }
        } else {
            this.redirectToResetPassword();
        }
    }

    redirectToResetPassword() {
        console.log('跳转到密码重置页面...');
        this.updateStatus('success', '🔄 正在跳转到密码重置页面...');

        setTimeout(() => {
            window.location.href = `../reset_password/reset_password.html?username=${encodeURIComponent(this.expectedUsername)}&userType=${encodeURIComponent(this.userType)}`;
        }, 1000);
    }

    drawFaceBox(result) {
        const [x1, y1, x2, y2] = result.face_location;
        const width = x2 - x1;
        const height = y2 - y1;

        // 根据状态设置颜色
        let strokeColor, label;

        switch (result.status) {
            case 'success':
                strokeColor = '#28a745';
                label = result.recognized_name;
                break;
            case 'fake':
                strokeColor = '#ff5722';
                label = `Fake ${result.recognized_name}`;
                break;
            case 'wrong-user':
                strokeColor = '#9c27b0';
                label = `Wrong User: ${result.recognized_name}`;
                break;
            default:
                strokeColor = '#dc3545';
                label = 'Undefined';
        }

        // 绘制人脸框
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(x1, y1, width, height);

        // 绘制标签背景
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(x1, y2 + 5, width, 35);

        // 绘制标签文字
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(label, x1 + width / 2, y2 + 28);
    }

    resetSuccessTimer() {
        this.successStartTime = null;
        this.countdown.style.display = 'none';
        if (this.redirectTimer) {
            clearTimeout(this.redirectTimer);
            this.redirectTimer = null;
        }
    }

    clearOverlay() {
        this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    }

    updateStatus(type, message) {
        this.status.className = `status ${type}`;

        if (type === 'detecting') {
            this.status.innerHTML = `<div class="loading"></div>${message}`;
        } else {
            this.status.textContent = message;
        }
    }
}

// 初始化系统
document.addEventListener('DOMContentLoaded', () => {
    new RealFaceVerificationSystem();
});