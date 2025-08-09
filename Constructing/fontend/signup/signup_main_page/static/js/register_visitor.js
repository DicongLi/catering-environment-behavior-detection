        let currentStep = 1;
        let emailVerified = false;
        let countdownTimer = null;

        // 更新进度条
        function updateProgress() {
            const progressFill = document.getElementById('progressFill');
            const percentage = (currentStep / 3) * 100;
            progressFill.style.width = percentage + '%';
        }

        // 更新步骤指示器
        function updateStepIndicator() {
            for (let i = 1; i <= 3; i++) {
                const dot = document.getElementById(`dot${i}`);
                dot.classList.remove('active', 'completed');

                if (i < currentStep) {
                    dot.classList.add('completed');
                } else if (i === currentStep) {
                    dot.classList.add('active');
                }
            }
        }

        // 显示错误消息
        function showError(elementId, message) {
            const errorElement = document.getElementById(elementId);
            errorElement.textContent = message;
            errorElement.style.display = 'block';

            // 隐藏成功消息
            const successId = elementId.replace('Error', 'Success');
            const successElement = document.getElementById(successId);
            if (successElement) {
                successElement.style.display = 'none';
            }
        }

        // 显示成功消息
        function showSuccess(elementId, message) {
            const successElement = document.getElementById(elementId);
            successElement.textContent = message;
            successElement.style.display = 'block';

            // 隐藏错误消息
            const errorId = elementId.replace('Success', 'Error');
            const errorElement = document.getElementById(errorId);
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        }

        // 隐藏消息
        function hideMessages(prefix) {
            const errorElement = document.getElementById(prefix + 'Error');
            const successElement = document.getElementById(prefix + 'Success');

            if (errorElement) errorElement.style.display = 'none';
            if (successElement) successElement.style.display = 'none';
        }

        // 清空密码输入框
        function clearPasswordFields() {
            document.getElementById('password').value = '';
            document.getElementById('confirmPassword').value = '';
            document.getElementById('password').classList.remove('success', 'error');
            document.getElementById('confirmPassword').classList.remove('success', 'error');

            // 重置密码要求显示
            const requirements = ['req-length', 'req-letter', 'req-number', 'req-special'];
            requirements.forEach(req => {
                document.getElementById(req).className = '';
            });
        }

        // 验证用户名
        async function validateUsername() {
            const username = document.getElementById('username').value.trim();
            const usernameInput = document.getElementById('username');

            if (!username) {
                showError('usernameError', '请输入用户名');
                usernameInput.classList.add('error');
                return false;
            }

            if (username.length < 3 || username.length > 20) {
                showError('usernameError', '用户名长度应在3-20个字符之间');
                usernameInput.classList.add('error');
                return false;
            }

            // 检查用户名是否已存在
            try {
                const response = await fetch('/api/check-username', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username })
                });

                const data = await response.json();

                if (data.exists) {
                    showError('usernameError', '用户名已存在，请选择其他用户名');
                    usernameInput.classList.add('error');
                    return false;
                } else {
                    showSuccess('usernameSuccess', '用户名可用');
                    usernameInput.classList.remove('error');
                    usernameInput.classList.add('success');
                    return true;
                }
            } catch (error) {
                showError('usernameError', '验证用户名失败，请重试');
                usernameInput.classList.add('error');
                return false;
            }
        }

        // 验证邮箱格式
        function validateEmail() {
            const email = document.getElementById('email').value.trim();
            const emailInput = document.getElementById('email');
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!email) {
                showError('emailError', '请输入邮箱地址');
                emailInput.classList.add('error');
                return false;
            }

            if (!emailRegex.test(email)) {
                showError('emailError', '请输入有效的邮箱地址');
                emailInput.classList.add('error');
                return false;
            }

            emailInput.classList.remove('error');
            emailInput.classList.add('success');
            hideMessages('email');
            return true;
        }

        // 发送验证码
        async function sendVerificationCode() {
            if (!validateEmail()) return;

            const email = document.getElementById('email').value.trim();
            const sendCodeBtn = document.getElementById('sendCodeBtn');

            sendCodeBtn.disabled = true;
            sendCodeBtn.textContent = '发送中...';

            try {
                const response = await fetch('/api/send-verification-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (data.success) {
                    showSuccess('emailSuccess', '验证码已发送到您的邮箱');
                    startCountdown();
                } else {
                    showError('emailError', data.message || '验证码发送失败');
                    sendCodeBtn.disabled = false;
                    sendCodeBtn.textContent = '发送验证码';
                }
            } catch (error) {
                showError('emailError', '网络错误，请稍后重试');
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = '发送验证码';
            }
        }

        // 开始倒计时
        function startCountdown() {
            let seconds = 60;
            const countdownElement = document.getElementById('countdown');
            const sendCodeBtn = document.getElementById('sendCodeBtn');

            countdownTimer = setInterval(() => {
                countdownElement.textContent = `${seconds}秒后可重新发送`;
                seconds--;

                if (seconds < 0) {
                    clearInterval(countdownTimer);
                    countdownElement.textContent = '';
                    sendCodeBtn.disabled = false;
                    sendCodeBtn.textContent = '重新发送';
                }
            }, 1000);
        }

        // 验证邮箱验证码
        async function verifyEmailCode() {
            const email = document.getElementById('email').value.trim();
            const code = document.getElementById('emailCode').value.trim();
            const emailCodeInput = document.getElementById('emailCode');

            if (!code) {
                showError('emailCodeError', '请输入验证码');
                emailCodeInput.classList.add('error');
                return false;
            }

            try {
                const response = await fetch('/api/verify-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, code })
                });

                const data = await response.json();

                if (data.success) {
                    showSuccess('emailCodeSuccess', '邮箱验证成功');
                    emailCodeInput.classList.remove('error');
                    emailCodeInput.classList.add('success');
                    emailVerified = true;
                    return true;
                } else {
                    showError('emailCodeError', data.message || '验证码错误');
                    emailCodeInput.classList.add('error');
                    return false;
                }
            } catch (error) {
                showError('emailCodeError', '验证失败，请重试');
                emailCodeInput.classList.add('error');
                return false;
            }
        }

        // 验证密码强度
        function validatePassword() {
            const password = document.getElementById('password').value;
            const passwordInput = document.getElementById('password');

            // 密码要求
            const requirements = {
                length: password.length >= 8 && password.length <= 16,
                letter: /[a-zA-Z]/.test(password),
                number: /\d/.test(password),
                special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
            };

            // 更新要求显示
            document.getElementById('req-length').className = requirements.length ? 'valid' : 'invalid';
            document.getElementById('req-letter').className = requirements.letter ? 'valid' : 'invalid';
            document.getElementById('req-number').className = requirements.number ? 'valid' : 'invalid';
            document.getElementById('req-special').className = requirements.special ? 'valid' : 'invalid';

            const allValid = Object.values(requirements).every(req => req);

            if (!password) {
                showError('passwordError', '请输入密码');
                passwordInput.classList.add('error');
                return false;
            }

            if (!allValid) {
                showError('passwordError', '密码不符合要求');
                passwordInput.classList.add('error');
                return false;
            }

            passwordInput.classList.remove('error');
            passwordInput.classList.add('success');
            hideMessages('password');
            return true;
        }

        // 验证确认密码
        function validateConfirmPassword() {
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const confirmPasswordInput = document.getElementById('confirmPassword');

            if (!confirmPassword) {
                showError('confirmPasswordError', '请确认密码');
                confirmPasswordInput.classList.add('error');
                return false;
            }

            if (password !== confirmPassword) {
                showError('confirmPasswordError', '两次输入的密码不一致');
                confirmPasswordInput.classList.add('error');
                // 清空密码输入框
                clearPasswordFields();
                return false;
            }

            // 再次验证密码格式
            if (!validatePassword()) {
                showError('confirmPasswordError', '密码格式不符合要求');
                clearPasswordFields();
                return false;
            }

            showSuccess('confirmPasswordSuccess', '密码确认成功');
            confirmPasswordInput.classList.remove('error');
            confirmPasswordInput.classList.add('success');
            return true;
        }

        // 下一步
        async function nextStep(step) {
            let canProceed = false;

            if (step === 1) {
                canProceed = await validateUsername();
            } else if (step === 2) {
                canProceed = await verifyEmailCode();
            }

            if (canProceed) {
                document.getElementById(`step${step}`).classList.remove('active');
                currentStep++;
                document.getElementById(`step${currentStep}`).classList.add('active');
                updateProgress();
                updateStepIndicator();
            }
        }

        // 上一步
        function prevStep(step) {
            document.getElementById(`step${step}`).classList.remove('active');
            currentStep--;
            document.getElementById(`step${currentStep}`).classList.add('active');
            updateProgress();
            updateStepIndicator();
        }

        // 提交注册
        async function submitRegistration() {
            if (!validatePassword() || !validateConfirmPassword()) {
                return;
            }

            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            // 添加加载状态
            const submitBtn = document.querySelector('.btn');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '注册中...';

            try {
                const response = await fetch('/api/visitor-register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        email,
                        password
                    })
                });

                const data = await response.json();

                if (data.success) {
                    alert('注册成功！即将跳转到身份选择页面...');
                    window.location.href = '../../login_main_page/identity_division.html';
                } else {
                    if (data.message.includes('用户名')) {
                        // 跳回第一步
                        document.getElementById('step3').classList.remove('active');
                        currentStep = 1;
                        document.getElementById('step1').classList.add('active');
                        updateProgress();
                        updateStepIndicator();
                        showError('usernameError', data.message);
                        document.getElementById('username').classList.add('error');
                    } else if (data.message.includes('邮箱')) {
                        // 跳回第二步
                        document.getElementById('step3').classList.remove('active');
                        currentStep = 2;
                        document.getElementById('step2').classList.add('active');
                        updateProgress();
                        updateStepIndicator();
                        showError('emailError', data.message);
                        document.getElementById('email').classList.add('error');
                    } else {
                        showError('confirmPasswordError', data.message);
                        clearPasswordFields();
                    }
                }
            } catch (error) {
                showError('confirmPasswordError', '注册失败，请重试');
                clearPasswordFields();
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }

        // 密码输入实时验证
        document.getElementById('password').addEventListener('input', validatePassword);
        document.getElementById('confirmPassword').addEventListener('input', function() {
            if (this.value) {
                validateConfirmPassword();
            }
        });

        // 初始化
        updateProgress();
        updateStepIndicator();

        // 添加键盘事件监听
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const activeStep = document.querySelector('.step.active');
                if (activeStep) {
                    const stepId = activeStep.id;
                    if (stepId === 'step1') {
                        nextStep(1);
                    } else if (stepId === 'step2') {
                        nextStep(2);
                    } else if (stepId === 'step3') {
                        submitRegistration();
                    }
                }
            }
        });
