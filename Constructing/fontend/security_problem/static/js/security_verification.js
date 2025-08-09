async function loadSecurityQuestions() {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    const userType = urlParams.get('userType');

    if (!username) {
        alert('Username is missing. Please go back and try again.');
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/get-security-questions?username=${encodeURIComponent(username)}`);
        const result = await response.json();

        if (result.success) {
            const container = document.getElementById('security-questions-container');
            container.innerHTML = '';

            result.questions.forEach((question, index) => {
                const div = document.createElement('div');
                div.className = 'question';
                div.innerHTML = `
                    <p>${question}</p>
                    <input type="text" id="answer${index}" placeholder="Your answer">
                `;
                container.appendChild(div);
            });
        } else {
            alert(result.message || 'Failed to load security questions.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while loading security questions.');
    }
}

async function submitAnswers() {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    const userType = urlParams.get('userType'); // 添加这一行来获取 userType

    if (!username) {
        alert('Username is missing. Please go back and try again.');
        return;
    }

    const answers = [];
    for (let i = 0; i < 2; i++) {
        const answer = document.getElementById(`answer${i}`).value;
        if (answer) {
            answers.push(answer);
        }
    }

    if (answers.length === 0) {
        alert('Please provide your answers.');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/verify-security-answers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                answers,
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Security answers verified successfully!');
            // 核实通过后跳转到 reset_password.html 页面
            // 如果 userType 存在就传递，不存在就只传 username
            let redirectUrl = `../reset_password/reset_password.html?username=${encodeURIComponent(username)}`;
            if (userType) {
                redirectUrl += `&userType=${encodeURIComponent(userType)}`;
            }
            window.location.href = redirectUrl;
        } else {
            alert(result.message || 'Incorrect answers. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while verifying your answers.');
    }
}

// 重要：页面加载时调用 loadSecurityQuestions
window.onload = loadSecurityQuestions;