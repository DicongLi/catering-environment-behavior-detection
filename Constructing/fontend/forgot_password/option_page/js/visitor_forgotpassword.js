// 获取URL中的参数
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
const userType = 'visitor';

if (username) {
    // 显示用户名
    document.getElementById('usernameDisplay').textContent = `How would you like to recover ${decodeURIComponent(username)}'s password?`;

    // 为所有链接添加用户名和用户类型参数
    const links = ['securityLink', 'emailLink'];
    links.forEach(id => {
        const link = document.getElementById(id);
        // 添加username和userType参数
        link.href = `${link.href}?username=${encodeURIComponent(username)}&userType=${encodeURIComponent(userType)}`;
    });
} else {
    alert('No username provided');
    window.location.href = 'visitor_account.html';
}