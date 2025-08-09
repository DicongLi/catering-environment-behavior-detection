        function goToRegisteredPage() {
            // 添加点击动画效果
            const btn = event.target.closest('.btn');
            btn.style.transform = 'scale(0.95)';

            setTimeout(() => {
                window.location.href = 'register_done.html';
            }, 150);
        }

        function goToNotRegisteredPage() {
            // 添加点击动画效果
            const btn = event.target.closest('.btn');
            btn.style.transform = 'scale(0.95)';

            setTimeout(() => {
                window.location.href = 'register_yet.html';
            }, 150);
        }

        // 添加键盘支持
        document.addEventListener('keydown', function(event) {
            if (event.key === '1' || event.key === 'y' || event.key === 'Y') {
                goToRegisteredPage();
            } else if (event.key === '2' || event.key === 'n' || event.key === 'N') {
                goToNotRegisteredPage();
            }
        });

        // 页面加载完成后的动画
        window.addEventListener('load', function() {
            document.querySelector('.container').style.animation = 'fadeInUp 0.8s ease-out';
        });
