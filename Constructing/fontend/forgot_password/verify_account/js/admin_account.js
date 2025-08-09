document.getElementById("accountForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;

    try {
        const response = await fetch('http://localhost:3000/verify_admin', {  // 注意端口与server.js一致
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        const data = await response.json();

        if (response.ok) {
            // 跳转并传递用户名
            window.location.href = `../option_page/admin_forgotpassword.html?username=${encodeURIComponent(username)}`;
        } else {
            document.getElementById('errorMessage').textContent = data.error || "Username not found";
            document.getElementById('errorModal').style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('errorMessage').textContent = "Network error";
        document.getElementById('errorModal').style.display = 'block';
    }
});

// 保持原有的模态框关闭逻辑
document.getElementById("closeModal").onclick = function() {
    document.getElementById("errorModal").style.display = "none";
};

window.onclick = function(event) {
    if (event.target == document.getElementById("errorModal")) {
        document.getElementById("errorModal").style.display = "none";
    }
};

