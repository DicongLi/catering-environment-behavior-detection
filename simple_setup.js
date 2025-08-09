const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function simpleSetup() {
    console.log('🍳 厨房检测系统 - 快速配置');
    console.log('========================\n');

    console.log('请输入MySQL连接信息：');

    const host = await question('主机地址 (默认 localhost): ') || 'localhost';
    const user = await question('用户名 (默认 root): ') || 'root';
    const password = await question('密码: ');
    const database = await question('数据库名 (默认 kitchen_detection_system): ') || 'kitchen_detection_system';
    const port = await question('端口 (默认 3306): ') || '3306';

    // 创建.env文件
    const envContent = `DB_HOST=${host}
DB_USER=${user}
DB_PASSWORD=${password}
DB_NAME=${database}
DB_PORT=${port}

# 邮箱配置（可选，后续可修改）
EMAIL_USER=
EMAIL_PASS=

# 服务端口
SERVER_PORT=3000
PYTHON_APP_PORT=5000
JAVA_OCR_PORT=8080
REDIS_PORT=6379
`;

    fs.writeFileSync('.env', envContent);

    // 创建必要目录
    ['Registration_Images', 'EnterpriseArchives'].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    console.log('\n✅ 配置完成！');
    console.log('📁 .env 文件已创建');
    console.log('📁 必要目录已创建');
    console.log('\n🚀 启动命令: npm start');
    console.log('💡 启动时会自动创建数据库和表');

    rl.close();
}

simpleSetup().catch(console.error);