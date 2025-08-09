        let countdownTimer;
        let generatedCode = '';
        let isCodeVerified = false;

        const emailInput = document.getElementById('email');
        const sendCodeBtn = document.getElementById('sendCodeBtn');
        const verificationCodeInput = document.getElementById('verificationCode');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const form = document.getElementById('registrationForm');

        // 邮箱验证
        function validateEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        }

        // 密码验证
        function validatePassword(password) {
            const hasLength = password.length >= 8 && password.length <= 16;
            const hasLetter = /[a-zA-Z]/.test(password);
            const hasNumber = /\d/.test(password);
            const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

            return {
                hasLength,
                hasLetter,
                hasNumber,
                hasSpecial,
                isValid: hasLength && hasLetter && hasNumber && hasSpecial
            };
        }

        // 显示错误信息
        function showError(elementId, message) {
            const errorElement = document.getElementById(elementId);
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }

        // 隐藏错误信息
        function hideError(elementId) {
            const errorElement = document.getElementById(elementId);
            errorElement.classList.remove('show');
        }

        // 显示成功信息
        function showSuccess(elementId, message) {
            const successElement = document.getElementById(elementId);
            successElement.textContent = message;
            successElement.classList.add('show');
        }

        // 隐藏成功信息
        function hideSuccess(elementId) {
            const successElement = document.getElementById(elementId);
            successElement.classList.remove('show');
        }

        // 发送验证码
        sendCodeBtn.addEventListener('click', function() {
            const email = emailInput.value.trim();

            if (!email) {
                showError('emailError', '请输入邮箱地址');
                emailInput.classList.add('error');
                return;
            }

            if (!validateEmail(email)) {
                showError('emailError', '请输入有效的邮箱地址');
                emailInput.classList.add('error');
                return;
            }

            hideError('emailError');
            emailInput.classList.remove('error');

            // 生成6位随机验证码
            generatedCode = Math.random().toString().slice(2, 8);
            console.log('生成的验证码:', generatedCode); // 实际项目中应该发送到后端

            // 模拟发送验证码
            alert(`验证码已发送到 ${email}\n验证码: ${generatedCode}`);

            // 开始倒计时
            let countdown = 60;
            sendCodeBtn.disabled = true;
            sendCodeBtn.innerHTML = `<span class="countdown">${countdown}s</span>`;

            countdownTimer = setInterval(function() {
                countdown--;
                if (countdown > 0) {
                    sendCodeBtn.innerHTML = `<span class="countdown">${countdown}s</span>`;
                } else {
                    clearInterval(countdownTimer);
                    sendCodeBtn.disabled = false;
                    sendCodeBtn.innerHTML = '重新发送';
                }
            }, 1000);
        });

        // 验证码输入验证
        verificationCodeInput.addEventListener('input', function() {
            const code = this.value.trim();

            if (code.length === 6) {
                if (code === generatedCode) {
                    hideError('codeError');
                    showSuccess('codeSuccess', '✓ 验证码正确');
                    this.classList.remove('error');
                    isCodeVerified = true;
                } else {
                    showError('codeError', '验证码错误，请重新输入');
                    hideSuccess('codeSuccess');
                    this.classList.add('error');
                    isCodeVerified = false;
                }
            } else {
                hideError('codeError');
                hideSuccess('codeSuccess');
                this.classList.remove('error');
                isCodeVerified = false;
            }
        });

        // 密码强度检查
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const validation = validatePassword(password);

            if (password.length > 0) {
                document.getElementById('passwordStrength').classList.add('show');

                // 更新强度指示器
                updateStrengthIndicator('lengthCheck', validation.hasLength);
                updateStrengthIndicator('letterCheck', validation.hasLetter);
                updateStrengthIndicator('numberCheck', validation.hasNumber);
                updateStrengthIndicator('specialCheck', validation.hasSpecial);
            } else {
                document.getElementById('passwordStrength').classList.remove('show');
            }

            // 验证密码匹配
            if (confirmPasswordInput.value) {
                validatePasswordMatch();
            }
        });

        // 更新强度指示器
        function updateStrengthIndicator(elementId, isValid) {
            const element = document.getElementById(elementId);
            const icon = element.querySelector('.icon');

            if (isValid) {
                element.classList.add('valid');
                element.classList.remove('invalid');
                icon.textContent = '✓';
            } else {
                element.classList.add('invalid');
                element.classList.remove('valid');
                icon.textContent = '✗';
            }
        }

        // 验证密码匹配
        function validatePasswordMatch() {
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (password !== confirmPassword) {
                showError('confirmPasswordError', '两次输入的密码不匹配');
                passwordInput.classList.add('error');
                confirmPasswordInput.classList.add('error');
                // 清空密码框
                passwordInput.value = '';
                confirmPasswordInput.value = '';
                // 隐藏密码强度指示器
                document.getElementById('passwordStrength').classList.remove('show');
                return false;
            } else {
                hideError('confirmPasswordError');
                passwordInput.classList.remove('error');
                confirmPasswordInput.classList.remove('error');
                return true;
            }
        }

        // 确认密码验证
        confirmPasswordInput.addEventListener('blur', function() {
            if (this.value && passwordInput.value) {
                validatePasswordMatch();
            }
        });

        // 清除输入框错误状态
        emailInput.addEventListener('input', function() {
            this.classList.remove('error');
            hideError('emailError');
        });

        passwordInput.addEventListener('input', function() {
            this.classList.remove('error');
            hideError('passwordError');
        });

        confirmPasswordInput.addEventListener('input', function() {
            this.classList.remove('error');
            hideError('confirmPasswordError');
        });

        // 表单提交
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            const email = emailInput.value.trim();
            const code = verificationCodeInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            let hasErrors = false;

            // 验证邮箱
            if (!email || !validateEmail(email)) {
                showError('emailError', '请输入有效的邮箱地址');
                emailInput.classList.add('error');
                hasErrors = true;
            }

            // 验证验证码
            if (!isCodeVerified) {
                showError('codeError', '请输入正确的验证码');
                verificationCodeInput.classList.add('error');
                hasErrors = true;
            }

            // 验证密码
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                showError('passwordError', '密码不符合要求');
                passwordInput.classList.add('error');
                hasErrors = true;
            }

            // 验证密码匹配
            if (!validatePasswordMatch()) {
                hasErrors = true;
            }

            if (!hasErrors) {
                alert('注册成功！');
                // 这里可以提交表单到服务器
                console.log('注册信息:', {
                    email: email,
                    code: code,
                    password: password
                });
            }
        });
