        // 获取URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('username');
        const userType = urlParams.get('userType');

        if (!username || !userType) {
            alert('缺少必要参数！');
            window.history.back();
        }

        // 更新页面标题
        document.getElementById('headerText').textContent =
            `正在为用户 ${decodeURIComponent(username)} 找回密码`;

        let userEmail = '';
        let countdownTimer = null;
        let countdownValue = 0;

        // 第一步：检查邮箱
        document.getElementById('emailForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const emailError = document.getElementById('emailError');

            // 重置错误消息
            emailError.style.display = 'none';

            // 显示加载状态
            document.getElementById('checkEmailBtn').disabled = true;
            document.getElementById('emailLoading').style.display = 'block';

            try {
                // 验证邮箱是否属于该用户
                const response = await fetch('http://localhost:3000/verify-user-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username,
                        userType: userType,
                        email: email
                    })
                });

                const result = await response.json();

                if (result.success) {
                    userEmail = email;
                    // 发送验证码
                    await sendVerificationCode();

                    // 切换到第二步
                    document.getElementById('emailSection').classList.remove('active');
                    document.getElementById('verificationSection').classList.add('active');
                    document.getElementById('step1').classList.remove('active');
                    document.getElementById('step2').classList.add('active');

                    // 显示邮箱
                    document.getElementById('emailDisplay').textContent = maskEmail(email);

                    // 开始倒计时
                    startCountdown();
                } else {
                    emailError.textContent = result.message || '该邮箱与用户不匹配';
                    emailError.style.display = 'block';
                }
            } catch (error) {
                console.error('Error:', error);
                emailError.textContent = '验证失败，请稍后重试';
                emailError.style.display = 'block';
            } finally {
                document.getElementById('checkEmailBtn').disabled = false;
                document.getElementById('emailLoading').style.display = 'none';
            }
        });

        // 发送验证码
        async function sendVerificationCode() {
            try {
                const response = await fetch('http://localhost:3000/api/send-verification-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: userEmail
                    })
                });

                const result = await response.json();

                if (result.success) {
                    document.getElementById('codeSuccess').textContent = '验证码已发送，请查收邮件';
                    document.getElementById('codeSuccess').style.display = 'block';
                    setTimeout(() => {
                        document.getElementById('codeSuccess').style.display = 'none';
                    }, 3000);
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('codeError').textContent = '发送验证码失败，请重试';
                document.getElementById('codeError').style.display = 'block';
            }
        }

        // 重新发送验证码
        document.getElementById('resendBtn').addEventListener('click', async function() {
            if (countdownValue > 0) return;

            this.disabled = true;
            await sendVerificationCode();
            startCountdown();
        });

        // 倒计时
        function startCountdown() {
            countdownValue = 60;
            const resendBtn = document.getElementById('resendBtn');
            const countdown = document.getElementById('countdown');

            resendBtn.disabled = true;

            countdownTimer = setInterval(() => {
                countdownValue--;
                if (countdownValue > 0) {
                    countdown.textContent = `(${countdownValue}s)`;
                } else {
                    clearInterval(countdownTimer);
                    countdown.textContent = '';
                    resendBtn.disabled = false;
                }
            }, 1000);
        }

        // 验证验证码
        document.getElementById('verificationForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const code = document.getElementById('verificationCode').value;
            const codeError = document.getElementById('codeError');

            // 重置错误消息
            codeError.style.display = 'none';

            // 验证码格式检查
            if (!/^\d{6}$/.test(code)) {
                codeError.textContent = '请输入6位数字验证码';
                codeError.style.display = 'block';
                return;
            }

            // 显示加载状态
            document.getElementById('verifyBtn').disabled = true;
            document.getElementById('verifyLoading').style.display = 'block';

            try {
                // 验证验证码
                const response = await fetch('http://localhost:3000/api/verify-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: userEmail,
                        code: code
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // 验证成功，跳转到密码重置页面
                    window.location.href = `../reset_password/reset_password.html?username=${encodeURIComponent(username)}&userType=${encodeURIComponent(userType)}`;
                } else {
                    codeError.textContent = result.message || '验证码错误';
                    codeError.style.display = 'block';
                    // 清空输入框
                    document.getElementById('verificationCode').value = '';
                }
            } catch (error) {
                console.error('Error:', error);
                codeError.textContent = '验证失败，请稍后重试';
                codeError.style.display = 'block';
            } finally {
                document.getElementById('verifyBtn').disabled = false;
                document.getElementById('verifyLoading').style.display = 'none';
            }
        });

        // 返回上一步
        function goBack() {
            // 切换到第一步
            document.getElementById('verificationSection').classList.remove('active');
            document.getElementById('emailSection').classList.add('active');
            document.getElementById('step2').classList.remove('active');
            document.getElementById('step1').classList.add('active');

            // 清空验证码输入
            document.getElementById('verificationCode').value = '';

            // 停止倒计时
            if (countdownTimer) {
                clearInterval(countdownTimer);
                document.getElementById('countdown').textContent = '';
                document.getElementById('resendBtn').disabled = false;
            }
        }

        // 邮箱掩码处理
        function maskEmail(email) {
            const [username, domain] = email.split('@');
            const maskedUsername = username.substring(0, 3) + '****';
            return maskedUsername + '@' + domain;
        }

        // 只允许输入数字
        document.getElementById('verificationCode').addEventListener('input', function(e) {
            this.value = this.value.replace(/[^\d]/g, '');
        });
