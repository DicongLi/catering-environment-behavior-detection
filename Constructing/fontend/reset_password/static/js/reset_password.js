        // 获取URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('username');
        const userType = urlParams.get('userType');

        // 检查必要参数
        if (!username || !userType) {
            alert('缺少必要参数！');
            window.history.back();
        }

        // 显示用户名
        document.getElementById('usernameDisplay').textContent = `正在为用户 ${decodeURIComponent(username)} 重置密码`;

        // 密码显示/隐藏切换
        function togglePassword(fieldId) {
            const field = document.getElementById(fieldId);
            const type = field.getAttribute('type') === 'password' ? 'text' : 'password';
            field.setAttribute('type', type);
        }

        // 密码验证规则
        const passwordRequirements = {
            length: /^.{8,16}$/,
            letter: /[a-zA-Z]/,
            number: /\d/,
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
        };

        // 实时验证密码
        const newPasswordInput = document.getElementById('newPassword');
        newPasswordInput.addEventListener('input', function() {
            const password = this.value;

            // 更新需求指示器
            document.getElementById('lengthReq').classList.toggle('valid', passwordRequirements.length.test(password));
            document.getElementById('letterReq').classList.toggle('valid', passwordRequirements.letter.test(password));
            document.getElementById('numberReq').classList.toggle('valid', passwordRequirements.number.test(password));
            document.getElementById('specialReq').classList.toggle('valid', passwordRequirements.special.test(password));

            // 清除错误消息
            document.getElementById('newPasswordError').style.display = 'none';
        });

        // 验证密码格式
        function validatePassword(password) {
            const errors = [];

            if (!passwordRequirements.length.test(password)) {
                errors.push('密码长度必须为8-16个字符');
            }
            if (!passwordRequirements.letter.test(password)) {
                errors.push('密码必须包含至少一个字母');
            }
            if (!passwordRequirements.number.test(password)) {
                errors.push('密码必须包含至少一个数字');
            }
            if (!passwordRequirements.special.test(password)) {
                errors.push('密码必须包含至少一个特殊字符');
            }

            return errors;
        }

        // 表单提交
        document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // 重置错误消息
            document.getElementById('newPasswordError').style.display = 'none';
            document.getElementById('confirmPasswordError').style.display = 'none';

            // 验证密码格式
            const passwordErrors = validatePassword(newPassword);
            if (passwordErrors.length > 0) {
                document.getElementById('newPasswordError').textContent = passwordErrors[0];
                document.getElementById('newPasswordError').style.display = 'block';
                // 清空两个输入框
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                return;
            }

            // 验证两次密码是否一致
            if (newPassword !== confirmPassword) {
                document.getElementById('confirmPasswordError').textContent = '两次输入的密码不一致';
                document.getElementById('confirmPasswordError').style.display = 'block';
                // 清空两个输入框
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                return;
            }

            // 显示加载状态
            document.getElementById('submitBtn').disabled = true;
            document.getElementById('loading').style.display = 'block';

            try {
                // 发送请求到服务器
                const response = await fetch('http://localhost:3000/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username,
                        userType: userType,
                        newPassword: newPassword
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // 显示成功消息
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('successMessage').style.display = 'block';

                    // 3秒后跳转到对应的登录页面
                    setTimeout(() => {
                        switch(userType) {
                            case 'visitor':
                                window.location.href = '/visitor_login.html';
                                break;
                            case 'manager':
                                window.location.href = '/manager_login.html';
                                break;
                            case 'admin':
                                window.location.href = '/admin_login.html';
                                break;
                            default:
                                window.location.href = '/';
                        }
                    }, 3000);
                } else {
                    throw new Error(result.message || '密码修改失败');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('密码修改失败：' + error.message);
                document.getElementById('submitBtn').disabled = false;
                document.getElementById('loading').style.display = 'none';
            }
        });
