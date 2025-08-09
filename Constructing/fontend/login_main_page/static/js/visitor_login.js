document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // 检查是否有空字段，若有则标红并抖动
    let formValid = true;

    if (!username) {
        formValid = false;
        const usernameInput = document.getElementById('username');
        usernameInput.classList.add('error', 'shake');  // 添加标红和抖动效果
        setTimeout(() => usernameInput.classList.remove('shake'), 300);  // 移除抖动效果
    }

    if (!password) {
        formValid = false;
        const passwordInput = document.getElementById('password');
        passwordInput.classList.add('error', 'shake');  // 添加标红和抖动效果
        setTimeout(() => passwordInput.classList.remove('shake'), 300);  // 移除抖动效果
    }

    // 如果有空字段，则不继续提交
    if (!formValid) {
        return; // 如果有空字段，停止执行后续的提交
    }

    const loginData = {
        username: username,
        password: password
    };

    // 向服务器发送用户名和密码进行验证
    fetch('http://localhost:3000/visitor_login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 登录成功，显示提示并跳转到visitor_page.html
            alert('登录成功');
            // 清空输入框
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            // 跳转到visitor_page.html
            window.location.href = 'visitor_page.html';
        } else {
            // 登录失败，显示错误信息
            document.getElementById('errorModal').style.display = 'block';
            document.querySelector('#errorModal p').textContent = data.message || '用户名或密码错误';
            document.getElementById('password').value = '';  // 清空密码框
        }
    })
    .catch(error => console.error('Error:', error));
});

// 关闭模态框的功能
document.getElementById("closeModal").onclick = function() {
    document.getElementById("errorModal").style.display = "none";
};

window.onclick = function(event) {
    if (event.target == document.getElementById("errorModal")) {
        document.getElementById("errorModal").style.display = "none";
    }
};