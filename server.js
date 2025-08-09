// 1. 在最开头添加环境变量配置
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const path = require('path');
const multer = require('multer');
const { exec, spawn } = require('child_process');
const fs = require('fs');

// 2. 修改端口配置 - 使用环境变量
const PORT = process.env.SERVER_PORT || 3000;

const nodemailer = require('nodemailer');
const redis = require('redis');
const axios = require('axios'); // 添加axios用于HTTP请求
const FormData = require('form-data');

// 配置文件上传
const upload = multer({
    dest: 'Registration_Images/',
    limits: { fileSize: 5 * 1024 * 1024 } // 限制5MB
});

// 设置静态文件目录（假设文件在项目的根目录下）
app.use(express.static(path.join(__dirname)));
app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.redirect('../fontend/login_main_page/identity_division.html');
});

// 3. 修改Python/Java/Redis端口配置 - 使用环境变量
const PYTHON_APP_PORT = process.env.PYTHON_APP_PORT || 5000;
const PYTHON_APP_URL = `http://localhost:${PYTHON_APP_PORT}`;
let pythonProcess = null;

// Redis服务器配置
let redisServerProcess = null;
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_DIR = path.join(__dirname, 'Redis-x64-5.0.14.1');
const REDIS_EXECUTABLE = 'redis-server.exe';

// Java OCR服务配置
const JAVA_OCR_PORT = process.env.JAVA_OCR_PORT || 8080;
const JAVA_OCR_URL = `http://localhost:${JAVA_OCR_PORT}`;
let javaOcrProcess = null;

// 4. 添加数据库自动初始化函数
async function initializeDatabase() {
    const mysql_promise = require('mysql2/promise');
    
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306,
        charset: 'utf8mb4'
    };

    const dbName = process.env.DB_NAME || 'kitchen_detection_system';

    try {
        console.log('🔍 检查数据库连接...');
        console.log(`连接配置: ${config.user}@${config.host}:${config.port}`);
        
        // 连接MySQL服务器（不指定数据库）
        const connection = await mysql_promise.createConnection(config);
        
        // 检查数据库是否存在
        const [databases] = await connection.execute(
            'SHOW DATABASES LIKE ?', [dbName]
        );
        
        if (databases.length === 0) {
            console.log(`📊 创建数据库: ${dbName}`);
            await connection.execute(
                `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
            );
            console.log('✅ 数据库创建成功');
        } else {
            console.log(`✅ 数据库 ${dbName} 已存在`);
        }
        
        // 切换到目标数据库
        await connection.execute(`USE \`${dbName}\``);
        
        // 创建所有必要的表
        await createTables(connection);
        
        console.log('✅ 数据库初始化完成');
        await connection.end();
        
        return true;
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error.message);
        
        // 给出具体的解决建议
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('💡 解决方案: 检查 .env 文件中的数据库用户名和密码');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('💡 解决方案: 请确保MySQL服务已启动');
            console.error('   Windows: 在服务管理器中启动MySQL服务');
            console.error('   Mac: brew services start mysql');
            console.error('   Linux: sudo systemctl start mysql');
        } else if (error.code === 'ENOTFOUND') {
            console.error('💡 解决方案: 检查数据库主机地址是否正确');
        }
        
        console.error('🔧 快速修复: 运行 npm run setup 重新配置数据库');
        return false;
    }
}

// 5. 创建数据表函数
async function createTables(connection) {
    const tables = [
        {
            name: 'visitor',
            sql: `CREATE TABLE IF NOT EXISTS visitor (
                ID INT AUTO_INCREMENT PRIMARY KEY,
                Name VARCHAR(50) NOT NULL UNIQUE,
                Password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        },
        {
            name: 'manager',
            sql: `CREATE TABLE IF NOT EXISTS manager (
                ID INT AUTO_INCREMENT PRIMARY KEY,
                Name VARCHAR(50) NOT NULL UNIQUE,
                Password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        },
        {
            name: 'admin',
            sql: `CREATE TABLE IF NOT EXISTS admin (
                ID INT AUTO_INCREMENT PRIMARY KEY,
                Name VARCHAR(50) NOT NULL UNIQUE,
                Password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        },
        {
            name: 'verification',
            sql: `CREATE TABLE IF NOT EXISTS verification (
                ID INT AUTO_INCREMENT PRIMARY KEY,
                Name VARCHAR(50) NOT NULL UNIQUE,
                Email VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        },
        {
            name: 'security_problem',
            sql: `CREATE TABLE IF NOT EXISTS security_problem (
                ID INT AUTO_INCREMENT PRIMARY KEY,
                Name VARCHAR(50) NOT NULL UNIQUE,
                Problem1 VARCHAR(255),
                Answer1 VARCHAR(255),
                Problem2 VARCHAR(255),
                Answer2 VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        },
        {
            name: 'Enterprise',
            sql: `CREATE TABLE IF NOT EXISTS Enterprise (
                ID INT AUTO_INCREMENT PRIMARY KEY,
                EID VARCHAR(50) NOT NULL UNIQUE,
                Name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        }
    ];
    
    console.log('🏗️  创建数据表...');
    
    for (const table of tables) {
        try {
            await connection.execute(table.sql);
            console.log(`✅ 表 ${table.name} 创建/检查完成`);
        } catch (error) {
            console.error(`❌ 创建表 ${table.name} 失败:`, error.message);
        }
    }
    
    // 插入默认测试账户
    try {
        await connection.execute(
            'INSERT IGNORE INTO admin (Name, Password) VALUES (?, ?)',
            ['admin', 'Admin@123']
        );
        await connection.execute(
            'INSERT IGNORE INTO manager (Name, Password) VALUES (?, ?)',
            ['manager', 'Manager@123']
        );
        console.log('✅ 默认测试账户创建完成');
    } catch (error) {
        console.error('❌ 创建默认账户失败:', error.message);
    }
}

// 6. 修改数据库连接配置 - 使用环境变量
function createDatabaseConnection() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kitchen_detection_system',
        port: process.env.DB_PORT || 3306,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4'
    };
    
    console.log('🔗 创建应用数据库连接...');
    console.log(`配置: ${config.user}@${config.host}:${config.port}/${config.database}`);
    
    const db = mysql.createConnection(config);
    
    db.connect((err) => {
        if (err) {
            console.error('❌ 应用数据库连接失败:', err.message);
            
            // 根据错误类型给出建议
            if (err.code === 'ER_ACCESS_DENIED_ERROR') {
                console.error('💡 请检查用户名和密码是否正确');
            } else if (err.code === 'ECONNREFUSED') {
                console.error('💡 请确保MySQL服务已启动');
            } else if (err.code === 'ER_BAD_DB_ERROR') {
                console.error('💡 数据库不存在，请运行: npm run setup');
            }
            
            console.error('🔧 解决方法: 运行 npm run setup 重新配置');
        } else {
            console.log('✅ 应用数据库连接成功');
        }
    });
    
    // 连接错误监听
    db.on('error', function(err) {
        console.error('数据库连接错误:', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('🔄 数据库连接丢失，尝试重新连接...');
            // 可以在这里实现重连逻辑
        }
    });
    
    return db;
}

// 7. 添加系统健康检查API
app.get('/api/system/health', (req, res) => {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'kitchen_detection_system',
        port: process.env.DB_PORT || 3306
    };
    
    // 检查环境变量是否加载
    const envLoaded = !!process.env.DB_HOST;
    
    if (db) {
        db.ping((err) => {
            res.json({
                database: err ? 'disconnected' : 'connected',
                config: config,
                env_loaded: envLoaded,
                error: err ? err.message : null,
                timestamp: new Date().toISOString(),
                services: {
                    python: pythonProcess ? 'running' : 'stopped',
                    java_ocr: javaOcrProcess ? 'running' : 'stopped',
                    redis: redisServerProcess ? 'running' : 'stopped'
                }
            });
        });
    } else {
        res.json({
            database: 'not_initialized',
            config: config,
            env_loaded: envLoaded,
            timestamp: new Date().toISOString()
        });
    }
});

// 启动Redis服务器
function startRedisServer() {
    if (redisServerProcess) {
        console.log('Redis服务器已在运行中...');
        return;
    }

    console.log('启动Redis服务器...');

    const redisPath = path.join(REDIS_DIR, REDIS_EXECUTABLE);

    // 检查Redis可执行文件是否存在
    if (!fs.existsSync(redisPath)) {
        console.error('❌ Redis服务器文件不存在:', redisPath);
        console.error('请确保Redis-x64-5.0.14.1文件夹位于项目根目录');
        return;
    }

    console.log('✅ 找到Redis服务器:', redisPath);

    // 启动Redis服务器
    redisServerProcess = spawn(redisPath, [], {
        cwd: REDIS_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
        // Windows特定选项
        windowsHide: true
    });

    redisServerProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // 过滤掉过于频繁的日志
        if (!output.includes('DB saved on disk')) {
            console.log(`Redis: ${output.trim()}`);
        }
    });

    redisServerProcess.stderr.on('data', (data) => {
        console.error(`Redis错误: ${data}`);
    });

    redisServerProcess.on('close', (code) => {
        console.log(`Redis服务器已关闭，退出代码: ${code}`);
        redisServerProcess = null;

        // 如果异常退出，尝试重启
        if (code !== 0 && code !== null) {
            console.log('Redis服务器异常退出，5秒后自动重启...');
            setTimeout(() => {
                startRedisServer();
            }, 5000);
        }
    });

    redisServerProcess.on('error', (error) => {
        console.error(`启动Redis服务器失败:`, error);
        if (error.code === 'ENOENT') {
            console.error('❌ 找不到redis-server.exe');
        }
        redisServerProcess = null;
    });

    // 等待Redis启动
    setTimeout(() => {
        checkRedisHealth();
    }, 2000);
}

// 检查Redis健康状态
async function checkRedisHealth() {
    try {
        // 尝试连接到Redis
        const testClient = redis.createClient({
            socket: {
                host: 'localhost',
                port: REDIS_PORT
            }
        });

        await testClient.connect();
        await testClient.ping();
        await testClient.quit();

        console.log('✅ Redis服务器启动成功，监听端口:', REDIS_PORT);
        return true;
    } catch (error) {
        console.log('Redis服务器尚未就绪，等待中...', error.message);
        // 重试
        setTimeout(checkRedisHealth, 2000);
        return false;
    }
}

// 启动Java OCR应用
function startJavaOcrApp() {
    if (javaOcrProcess) {
        console.log('Java OCR应用已在运行中...');
        return;
    }

    console.log('启动Java OCR应用...');

    const jarPath = path.join(__dirname, 'lib', 'ocr-application.jar');

    // 添加：检查JAR文件是否存在
    if (!fs.existsSync(jarPath)) {
        console.error('❌ JAR文件不存在:', jarPath);
        return;
    }

    console.log('✅ JAR文件存在:', jarPath);
    console.log('文件大小:', fs.statSync(jarPath).size, 'bytes');

    javaOcrProcess = spawn('java', ['-jar', jarPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname
    });

    javaOcrProcess.stdout.on('data', (data) => {
        console.log(`Java OCR输出: ${data}`);
    });

    javaOcrProcess.stderr.on('data', (data) => {
        console.error(`Java OCR错误: ${data}`);

        // 添加：特定错误检测
        const errorStr = data.toString();
        if (errorStr.includes('Error: Unable to access jarfile')) {
            console.error('❌ 无法访问JAR文件');
        } else if (errorStr.includes('no main manifest attribute')) {
            console.error('❌ JAR文件缺少主类');
        } else if (errorStr.includes('ClassNotFoundException')) {
            console.error('❌ 类文件缺失');
        } else if (errorStr.includes('Address already in use')) {
            console.error('❌ 端口8080已被占用');
        }
    });

    javaOcrProcess.on('close', (code) => {
        console.log(`Java OCR应用已关闭，退出代码: ${code}`);
        javaOcrProcess = null;

        // 添加：非正常退出时显示原因
        if (code !== 0) {
            console.error('❌ Java应用异常退出，代码:', code);
        }
    });

    javaOcrProcess.on('error', (error) => {
        console.error(`启动Java OCR应用失败:`, error);
        if (error.code === 'ENOENT') {
            console.error('❌ 系统未安装Java或Java不在PATH中');
        }
        javaOcrProcess = null;
    });

    // 等待Java应用启动
    setTimeout(() => {
        checkJavaOcrHealth();
    }, 10000);
}

// 检查Java OCR应用健康状态
async function checkJavaOcrHealth() {
    try {
        // 健康检查
        const healthResponse = await axios.get(`${JAVA_OCR_URL}/actuator/health`);
        console.log('✅ Java OCR健康检查成功:', healthResponse.data);

        // 尝试获取所有映射的端点（如果启用了actuator）
        try {
            const mappingsResponse = await axios.get(`${JAVA_OCR_URL}/actuator/mappings`);
            console.log('📍 可用的端点映射:', JSON.stringify(mappingsResponse.data, null, 2));
        } catch (e) {
            console.log('无法获取端点映射，尝试其他方法...');
        }

        // 尝试一些可能的端点
        const possibleEndpoints = [
            '/api/ocr/idcard-front',
            '/ocr/idcard-front',
            '/idcard-front',
            '/api/ocr',
            '/ocr'
        ];

        for (const endpoint of possibleEndpoints) {
            try {
                const response = await axios.options(`${JAVA_OCR_URL}${endpoint}`);
                console.log(`✅ 找到可用端点: ${endpoint}`);
            } catch (e) {
                console.log(`❌ 端点不可用: ${endpoint}`);
            }
        }

        return true;
    } catch (error) {
        console.log('Java OCR应用尚未就绪，等待中...', error.message);
        return false;
    }
}

// 启动Python Flask应用
function startPythonApp() {
    if (pythonProcess) {
        console.log('Python应用已在运行中...');
        return;
    }

    console.log('启动Python人脸识别应用...');

    // 使用 -u 参数确保输出不被缓冲
    pythonProcess = spawn('python', ['-u', 'app.py'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname,
        env: {
            ...process.env,
            PYTHONUNBUFFERED: '1'  // 确保实时输出
        }
    });

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python应用输出: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python应用错误: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python应用已关闭，退出代码: ${code}`);
        pythonProcess = null;

        // 如果异常退出，自动重启
        if (code !== 0 && code !== null) {
            console.log('Python应用异常退出，5秒后自动重启...');
            setTimeout(() => {
                startPythonApp();
            }, 5000);
        }
    });

    pythonProcess.on('error', (error) => {
        console.error(`启动Python应用失败: ${error}`);
        pythonProcess = null;
    });

    // 等待Flask应用启动
    setTimeout(() => {
        checkPythonAppHealth();
    }, 5000);  // 增加等待时间
}

// 检查Python应用健康状态
async function checkPythonAppHealth() {
    try {
        const response = await axios.get(`${PYTHON_APP_URL}/api/registered_users`);
        console.log('Python应用启动成功，已连接');
        return true;
    } catch (error) {
        console.log('Python应用尚未就绪，等待中...');
        return false;
    }
}

// 8. 声明数据库连接变量
let db;
let kitchen_detection_system, visitor, manager, admin, security_question, verification, enterprise;

// 9. 修改邮箱配置 - 使用环境变量
const qqEmailConfig = {
    service: 'qq',
    host: 'smtp.qq.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || '2024379585@qq.com',
        pass: process.env.EMAIL_PASS || 'qawerampuxdhjiad'
    }
};

// ==================== 以下是所有现有的API路由，保持不变 ==================== //

// 获取已注册用户列表
app.get('/api/face/registered_users', async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_APP_URL}/api/registered_users`);
        res.json(response.data);
    } catch (error) {
        console.error('获取注册用户失败:', error.message);
        res.status(500).json({
            success: false,
            error: '人脸识别服务不可用，请稍后重试'
        });
    }
});

// 人脸验证
app.post('/api/face/verify', async (req, res) => {
    try {
        const response = await axios.post(`${PYTHON_APP_URL}/api/verify_face`, req.body, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30秒超时
        });
        res.json(response.data);
    } catch (error) {
        console.error('人脸验证失败:', error.message);
        res.status(500).json({
            success: false,
            error: '人脸验证服务异常，请稍后重试'
        });
    }
});

// 重新加载人脸数据库
app.post('/api/face/reload_database', async (req, res) => {
    try {
        const response = await axios.post(`${PYTHON_APP_URL}/api/reload_database`);
        res.json(response.data);
    } catch (error) {
        console.error('重新加载数据库失败:', error.message);
        res.status(500).json({
            success: false,
            error: '重新加载数据库失败，请稍后重试'
        });
    }
});

// 检查人脸识别服务状态
app.get('/api/face/health', async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_APP_URL}/api/registered_users`, {
            timeout: 5000
        });
        res.json({
            success: true,
            message: '人脸识别服务正常',
            python_service: 'running'
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: '人脸识别服务不可用',
            python_service: 'down',
            error: error.message
        });
    }
});

// 重启人脸识别服务
app.post('/api/face/restart', (req, res) => {
    try {
        // 关闭现有进程
        if (pythonProcess) {
            pythonProcess.kill();
            pythonProcess = null;
        }

        // 延迟重启
        setTimeout(() => {
            startPythonApp();
        }, 2000);

        res.json({
            success: true,
            message: '人脸识别服务重启中，请稍等...'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '重启服务失败: ' + error.message
        });
    }
});

// ==================== 兼容性路由（支持前端直接调用） ==================== //
app.post('/api/verify_face', async (req, res) => {
    console.log('⚠️ 前端直接调用了 /api/verify_face，正在代理到Python服务...');

    let retries = 3;
    let lastError;

    while (retries > 0) {
        try {
            const response = await axios.post(`${PYTHON_APP_URL}/api/verify_face`, req.body, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            return res.json(response.data);
        } catch (error) {
            lastError = error;
            retries--;

            if (error.code === 'ECONNRESET' && retries > 0) {
                console.log(`连接被重置，等待2秒后重试... (剩余重试次数: ${retries})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }

            break;
        }
    }

    // 所有重试都失败了
    console.error('人脸验证失败:', lastError.message);

    if (lastError.code === 'ECONNREFUSED') {
        res.status(503).json({
            success: false,
            error: '人脸识别服务未启动，请确保Python服务正在运行',
            hint: '请在新终端运行: python app.py',
            results: []
        });
    } else if (lastError.code === 'ECONNRESET') {
        res.status(503).json({
            success: false,
            error: '人脸识别服务连接被重置，请稍后重试',
            results: []
        });
    } else {
        res.status(500).json({
            success: false,
            error: '人脸验证服务异常，请稍后重试',
            results: []
        });
    }
});

app.get('/api/registered_users', async (req, res) => {
    console.log('⚠️ 前端直接调用了 /api/registered_users，正在代理到Python服务...');
    try {
        const response = await axios.get(`${PYTHON_APP_URL}/api/registered_users`);
        res.json(response.data);
    } catch (error) {
        console.error('获取注册用户失败:', error.message);

        if (error.code === 'ECONNREFUSED') {
            res.status(503).json({
                success: false,
                error: '人脸识别服务未启动',
                hint: '请在新终端运行: python app.py',
                users: ['演示用户'] // 返回演示数据
            });
        } else {
            res.status(500).json({
                success: false,
                error: '获取用户列表失败',
                users: []
            });
        }
    }
});

app.post('/api/reload_database', async (req, res) => {
    console.log('⚠️ 前端直接调用了 /api/reload_database，正在代理到Python服务...');
    try {
        const response = await axios.post(`${PYTHON_APP_URL}/api/reload_database`);
        res.json(response.data);
    } catch (error) {
        console.error('重新加载数据库失败:', error.message);

        if (error.code === 'ECONNREFUSED') {
            res.status(503).json({
                success: false,
                error: '人脸识别服务未启动',
                hint: '请在新终端运行: python app.py',
                message: '无法重新加载数据库'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '重新加载数据库失败，请稍后重试'
            });
        }
    }
});

// -------------------- visitor的登录功能（使用 kitchen_detection_system 数据库） -------------------- //
app.post('/visitor_login', (req, res) => {
    const { username, password } = req.body;

    // 查询数据库中是否有匹配的用户名和密码
    const queryVisitor = "SELECT * FROM visitor WHERE Name = ? AND Password = ?";
    visitor.query(queryVisitor, [username, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: "服务器错误" });
        }

        // 如果没有找到用户，返回错误信息
        if (results.length === 0) {
            return res.status(401).json({ success: false, message: "用户名或密码错误" });
        }

        // 找到用户，登录成功
        return res.json({ success: true, message: "登录成功" });
    });
});

//-------------------- manager的登录功能（使用 kitchen_detection_system 数据库） -------------------- //
app.post('/manager_login', (req, res) => {
    const { username, password } = req.body;

    // 查询数据库中是否有匹配的用户名和密码
    const queryManager = "SELECT * FROM manager WHERE Name = ? AND Password = ?";
    manager.query(queryManager, [username, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: "服务器错误" });
        }

        // 如果没有找到用户，返回错误信息
        if (results.length === 0) {
            return res.status(401).json({ success: false, message: "用户名或密码错误" });
        }

        // 找到用户，登录成功
        return res.json({ success: true, message: "登录成功" });
    });
});

// -------------------- admin的登录功能（使用 kitchen_detection_system 数据库） -------------------- //
app.post('/admin_login', (req, res) => {
    const { username, password } = req.body;

    // 查询数据库中是否有匹配的用户名和密码
    const queryAdmin = "SELECT * FROM admin WHERE Name = ? AND Password = ?";
    admin.query(queryAdmin, [username, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: "服务器错误" });
        }

        // 如果没有找到用户，返回错误信息
        if (results.length === 0) {
            return res.status(401).json({ success: false, message: "用户名或密码错误" });
        }

        // 找到用户，登录成功
        return res.json({ success: true, message: "登录成功" });
    });
});

//-----------------------------密保更改密码-------------------------------
app.get('/get-security-questions', (req, res) => {
    const username = req.query.username;

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required' });
    }

    // 使用正确的表名 SecurityProblem 和列名
    const query = "SELECT Problem1, Problem2 FROM security_problem WHERE Name = ?";
    security_question.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error fetching security questions:', err);
            return res.status(500).json({ success: false, message: 'Server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'No security questions found for this user' });
        }

        // 使用正确的列名，只获取2个问题
        const questions = [results[0].Problem1, results[0].Problem2].filter(q => q);
        res.json({ success: true, questions });
    });
});

//---------------------------------------------密保问题验证-----------------------------------------------------
app.post('/verify-security-answers', (req, res) => {
    const { username, answers } = req.body;

    if (!username || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    // 使用正确的表名 SecurityProblem 和列名
    const query = "SELECT Answer1, Answer2 FROM security_problem WHERE Name = ?";
    security_question.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error verifying security answers:', err);
            return res.status(500).json({ success: false, message: 'Server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'No answers found for this user' });
        }

        // 使用正确的列名，只获取2个答案
        const correctAnswers = [results[0].Answer1, results[0].Answer2].filter(a => a);
        const allCorrect = correctAnswers.every((answer, index) => answer === answers[index]);

        if (allCorrect) {
            res.json({ success: true});
        } else {
            res.json({ success: false, message: 'Incorrect answers' });
        }
    });
});

//-----------------------------------------经理找回密码身份识别------------------------------------
app.post('/verify_manager', (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // 使用已连接的数据库
    const query = "SELECT * FROM manager WHERE Name = ?";
    manager.query(query, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length > 0) {
            res.json({ message: 'User exists' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    });
});

//-----------------------------------------工作人员找回密码身份识别------------------------------------
app.post('/verify_admin', (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // 使用已连接的数据库
    const query = "SELECT * FROM admin WHERE Name = ?";
    admin.query(query, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length > 0) {
            res.json({ message: 'User exists' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    });
});

//-----------------------------------------游客找回密码身份识别------------------------------------
app.post('/verify_visitor', (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // 使用已连接的数据库
    const query = "SELECT * FROM visitor WHERE Name = ?";
    visitor.query(query, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length > 0) {
            res.json({ message: 'User exists' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    });
});

//---------------------------------------访客注册-----------------------------------------------
// Check for duplicate name, email, or phone
app.post('/check_duplicates', async (req, res) => {
    try {
        const { name, email} = req.body;

        // 由于我们使用的是mysql2而不是Sequelize，需要使用SQL查询
        const nameQuery = "SELECT Name FROM verification WHERE Name = ?";
        const emailQuery = "SELECT Email FROM verification WHERE Email = ?";
        
        verification.query(nameQuery, [name], (err, nameResults) => {
            if (err) {
                console.error("Error checking name:", err);
                return res.status(500).json({ error: "Internal server error" });
            }
            
            verification.query(emailQuery, [email], (err, emailResults) => {
                if (err) {
                    console.error("Error checking email:", err);
                    return res.status(500).json({ error: "Internal server error" });
                }
                
                res.json({
                    nameExists: nameResults.length > 0,
                    emailExists: emailResults.length > 0,
                });
            });
        });
    } catch (error) {
        console.error("Error checking duplicates:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Handle registration
app.post('/visitor_register', async (req, res) => {
    try {
        const { name, email, password, email_code} = req.body;

        // Verify email code (using your existing verification system)
        const emailVerified = await verifyEmailCode(email, email_code);
        if (!emailVerified) {
            return res.status(400).json({ success: false, message: "Email verification failed" });
        }

        // Check for duplicates one more time using SQL queries
        const nameQuery = "SELECT Name FROM verification WHERE Name = ?";
        const emailQuery = "SELECT Email FROM verification WHERE Email = ?";
        
        verification.query(nameQuery, [name], (err, nameResults) => {
            if (err) {
                console.error("Error checking name:", err);
                return res.status(500).json({ success: false, message: "Registration failed" });
            }
            
            if (nameResults.length > 0) {
                return res.status(400).json({ success: false, message: "Name already exists" });
            }
            
            verification.query(emailQuery, [email], (err, emailResults) => {
                if (err) {
                    console.error("Error checking email:", err);
                    return res.status(500).json({ success: false, message: "Registration failed" });
                }
                
                if (emailResults.length > 0) {
                    return res.status(400).json({ success: false, message: "Email already exists" });
                }
                
                // 开始事务
                db.beginTransaction((err) => {
                    if (err) {
                        console.error("Transaction error:", err);
                        return res.status(500).json({ success: false, message: "Registration failed" });
                    }
                    
                    // Add to Visitor table
                    const insertVisitorQuery = "INSERT INTO visitor (Name, Password) VALUES (?, ?)";
                    db.query(insertVisitorQuery, [name, password], (err, visitorResult) => {
                        if (err) {
                            console.error("Error inserting visitor:", err);
                            return db.rollback(() => {
                                res.status(500).json({ success: false, message: "Registration failed" });
                            });
                        }
                        
                        // Add to Verification table
                        const insertVerificationQuery = "INSERT INTO verification (Name, Email) VALUES (?, ?)";
                        db.query(insertVerificationQuery, [name, email], (err, verificationResult) => {
                            if (err) {
                                console.error("Error inserting verification:", err);
                                return db.rollback(() => {
                                    res.status(500).json({ success: false, message: "Registration failed" });
                                });
                            }
                            
                            // 提交事务
                            db.commit((err) => {
                                if (err) {
                                    console.error("Commit error:", err);
                                    return db.rollback(() => {
                                        res.status(500).json({ success: false, message: "Registration failed" });
                                    });
                                }
                                
                                res.json({ success: true, message: "Registration successful" });
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ success: false, message: "Registration failed" });
    }
});

//---------------------------------------经理注册-----------------------------------------------
app.post('/manager_register', async (req, res) => {
    try {
        const { name, email, password, email_code} = req.body;

        // Verify email code (using your existing verification system)
        const emailVerified = await verifyEmailCode(email, email_code);
        if (!emailVerified) {
            return res.status(400).json({ success: false, message: "Email verification failed" });
        }

        // 类似visitor_register的实现，但插入到manager表
        const nameQuery = "SELECT Name FROM verification WHERE Name = ?";
        const emailQuery = "SELECT Email FROM verification WHERE Email = ?";
        
        verification.query(nameQuery, [name], (err, nameResults) => {
            if (err) {
                console.error("Error checking name:", err);
                return res.status(500).json({ success: false, message: "Registration failed" });
            }
            
            if (nameResults.length > 0) {
                return res.status(400).json({ success: false, message: "Name already exists" });
            }
            
            verification.query(emailQuery, [email], (err, emailResults) => {
                if (err) {
                    console.error("Error checking email:", err);
                    return res.status(500).json({ success: false, message: "Registration failed" });
                }
                
                if (emailResults.length > 0) {
                    return res.status(400).json({ success: false, message: "Email already exists" });
                }
                
                // 开始事务
                db.beginTransaction((err) => {
                    if (err) {
                        console.error("Transaction error:", err);
                        return res.status(500).json({ success: false, message: "Registration failed" });
                    }
                    
                    // Add to Manager table
                    const insertManagerQuery = "INSERT INTO manager (Name, Password) VALUES (?, ?)";
                    db.query(insertManagerQuery, [name, password], (err, managerResult) => {
                        if (err) {
                            console.error("Error inserting manager:", err);
                            return db.rollback(() => {
                                res.status(500).json({ success: false, message: "Registration failed" });
                            });
                        }
                        
                        // Add to Verification table
                        const insertVerificationQuery = "INSERT INTO verification (Name, Email) VALUES (?, ?)";
                        db.query(insertVerificationQuery, [name, email], (err, verificationResult) => {
                            if (err) {
                                console.error("Error inserting verification:", err);
                                return db.rollback(() => {
                                    res.status(500).json({ success: false, message: "Registration failed" });
                                });
                            }
                            
                            // 提交事务
                            db.commit((err) => {
                                if (err) {
                                    console.error("Commit error:", err);
                                    return db.rollback(() => {
                                        res.status(500).json({ success: false, message: "Registration failed" });
                                    });
                                }
                                
                                res.json({ success: true, message: "Registration successful" });
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ success: false, message: "Registration failed" });
    }
});

// 邮箱验证码验证函数
async function verifyEmailCode(email, code) {
    try {
        const response = await fetch('/verify_code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                code: code
            })
        });

        const data = await response.json();
        return data.message === "验证成功！";
    } catch (error) {
        console.error('邮箱验证出错:', error);
        return false;
    }
}

// 手机验证码验证函数
async function verifyPhoneCode(phone, code) {
    try {
        const response = await fetch('/verify_sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone_number: phone,
                verification_code: code
            })
        });

        const data = await response.json();
        return data.status === "success";
    } catch (error) {
        console.error('手机验证出错:', error);
        return false;
    }
}

//-------------------------------检查企业是否已经注册-------------------------------
app.post('/api/check-enterprise', (req, res) => {
    const { enterpriseName } = req.body;

    if (!enterpriseName) {
        return res.status(400).json({
            success: false,
            message: '企业名称不能为空'
        });
    }

    // 查询Enterprise表中是否存在该企业名称
    const query = "SELECT Name FROM Enterprise WHERE Name = ?";
    enterprise.query(query, [enterpriseName], (err, results) => {
        if (err) {
            console.error('查询企业错误:', err);
            return res.status(500).json({
                success: false,
                message: '服务器错误'
            });
        }

        if (results.length > 0) {
            // 企业存在
            res.json({
                success: true,
                exists: true
            });
        } else {
            // 企业不存在
            res.json({
                success: true,
                exists: false
            });
        }
    });
});

//--------------------------------------身份证OCR识别API----------------------------------
app.post('/api/ocr-idcard', upload.single('idCard'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: '未上传文件'
        });
    }

    console.log('收到OCR请求，文件信息:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
    });

    try {
        // 先检查Java服务是否可用
        let javaServiceAvailable = false;
        try {
            const healthCheck = await axios.get(`${JAVA_OCR_URL}/actuator/health`, { timeout: 1000 });
            console.log('Java健康检查结果:', healthCheck.data);
            javaServiceAvailable = true;
        } catch (e) {
            console.log('⚠️ Java OCR服务不可用:', e.message);
        }

        if (!javaServiceAvailable) {
            // Java服务不可用，使用模拟数据
            if (req.file.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            return res.json({
                success: true,
                data: {
                    name: '测试用户',
                    idNumber: '110101199001011234',
                    sex: '男',
                    nation: '汉',
                    birth: '1990-01-01',
                    address: '北京市朝阳区测试街道'
                },
                message: '注意：OCR服务未启动，使用模拟数据'
            });
        }

        // 检查文件是否存在
        if (!fs.existsSync(req.file.path)) {
            console.error('文件不存在:', req.file.path);
            return res.status(400).json({
                success: false,
                message: '文件上传失败'
            });
        }

        // Java服务可用，正常调用
        const form = new FormData();

        // 读取文件流
        const fileStream = fs.createReadStream(req.file.path);

        // 添加文件到表单，参数名必须是 'idCard'
        form.append('idCard', fileStream, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        console.log('准备发送请求到:', `${JAVA_OCR_URL}/api/ocr/idcard-front`);
        console.log('FormData headers:', form.getHeaders());

        const response = await axios.post(`${JAVA_OCR_URL}/api/ocr/idcard-front`, form, {
            headers: {
                ...form.getHeaders()
            },
            timeout: 30000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        console.log('OCR响应成功:', response.data);

        // 清理临时文件
        if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.json(response.data);

    } catch (error) {
        console.error('OCR请求详细错误:');
        console.error('错误类型:', error.name);
        console.error('错误消息:', error.message);
        console.error('响应状态:', error.response?.status);
        console.error('响应数据:', error.response?.data);
        console.error('请求配置:', {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers
        });

        // 清理文件
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        // 根据错误类型返回不同的响应
        if (error.code === 'ECONNREFUSED') {
            // 连接被拒绝，Java服务可能未启动
            return res.json({
                success: true,
                data: {
                    name: '测试用户',
                    idNumber: '110101199001011234',
                    sex: '男',
                    nation: '汉',
                    birth: '1990-01-01',
                    address: '北京市朝阳区测试街道'
                },
                message: 'OCR服务连接失败，使用默认数据'
            });
        } else if (error.response?.status === 400) {
            // 请求参数错误
            return res.status(400).json({
                success: false,
                message: error.response.data.message || '请求参数错误'
            });
        } else if (error.response?.status === 413) {
            // 文件太大
            return res.status(413).json({
                success: false,
                message: '文件大小超过限制'
            });
        } else {
            // 其他错误，返回模拟数据而不是错误
            return res.json({
                success: true,
                data: {
                    name: '测试用户',
                    idNumber: '110101199001011234',
                    sex: '男',
                    nation: '汉',
                    birth: '1990-01-01',
                    address: '北京市朝阳区测试街道'
                },
                message: 'OCR服务异常，使用默认数据'
            });
        }
    }
});

// 检查Java OCR服务状态
app.get('/api/ocr/health', async (req, res) => {
    try {
        const response = await axios.get(`${JAVA_OCR_URL}/actuator/health`, {
            timeout: 5000
        });
        res.json({
            success: true,
            message: 'Java OCR服务正常',
            java_service: 'running',
            details: response.data
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: 'Java OCR服务不可用',
            java_service: 'down',
            error: error.message
        });
    }
});

//----------------------------------重启Java OCR服务--------------------------------
app.post('/api/ocr/restart', (req, res) => {
    try {
        // 关闭现有进程
        if (javaOcrProcess) {
            javaOcrProcess.kill();
            javaOcrProcess = null;
        }

        // 延迟重启
        setTimeout(() => {
            startJavaOcrApp();
        }, 3000);

        res.json({
            success: true,
            message: 'Java OCR服务重启中，请稍等...'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '重启OCR服务失败: ' + error.message
        });
    }
});

//--------------------------------------保存员工验证文件----------------------------------
app.post('/api/save-employee-verification', upload.single('idCard'), async (req, res) => {
    const { userName, enterpriseName, idNumber } = req.body;

    if (!userName || !enterpriseName || !req.file) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数'
        });
    }

    try {
        // 生成文件名
        const fileExtension = req.file.originalname.split('.').pop();
        const sanitizedUserName = userName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
        const sanitizedEnterpriseName = enterpriseName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
        const fileName = `${sanitizedUserName}-${sanitizedEnterpriseName}.${fileExtension}`;

        // 创建Registration_Images目录（如果不存在）
        const uploadDir = path.join(__dirname, 'Registration_Images');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // 保存文件
        const filePath = path.join(uploadDir, fileName);
        fs.renameSync(req.file.path, filePath);

        console.log(`员工验证文件已保存: ${fileName}`);

        res.json({
            success: true,
            message: '身份验证信息已保存',
            data: {
                fileName: fileName,
                serverPath: `./Upload/${fileName}`,
                userName: userName,
                enterpriseName: enterpriseName
            }
        });

    } catch (error) {
        console.error('保存员工验证信息失败:', error);

        // 清理临时文件
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: '保存失败: ' + error.message
        });
    }
});

//--------------------------------新增：营业执照OCR识别API--------------------------
// 修改原有的营业执照上传处理，使其返回标准格式
app.post('/api/upload-license', upload.single('license'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: '未上传文件'
        });
    }

    console.log('收到营业执照OCR请求，文件信息:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
    });

    const filePath = req.file.path;
    const pythonScriptPath = path.join(__dirname, 'enterprise_recognition.py');

    // 调用Python脚本处理图像
    exec(`python ${pythonScriptPath} "${filePath}"`, (error, stdout, stderr) => {
        try {
            // 删除临时文件
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            if (error) {
                console.error('Python脚本执行错误:', error);
                // 返回模拟数据而不是错误
                return res.json({
                    success: true,
                    data: {
                        name: '测试科技有限公司',
                        eid: '91440300MA5DC6QX9X',
                        legalRepresentative: '张三',
                        registeredCapital: '100万人民币',
                        establishmentDate: '2020-01-15'
                    },
                    message: '注意：营业执照识别服务异常，使用模拟数据'
                });
            }

            let result;
            try {
                result = JSON.parse(stdout);
            } catch (parseError) {
                console.error('解析Python脚本输出失败:', parseError);
                // 返回模拟数据
                return res.json({
                    success: true,
                    data: {
                        name: '测试科技有限公司',
                        eid: '91440300MA5DC6QX9X',
                        legalRepresentative: '张三',
                        registeredCapital: '100万人民币',
                        establishmentDate: '2020-01-15'
                    },
                    message: '营业执照识别结果解析失败，使用模拟数据'
                });
            }

            if (result.status !== 'success') {
                // Python脚本返回失败，但我们返回模拟数据
                return res.json({
                    success: true,
                    data: {
                        name: '测试科技有限公司',
                        eid: '91440300MA5DC6QX9X',
                        legalRepresentative: '张三',
                        registeredCapital: '100万人民币',
                        establishmentDate: '2020-01-15'
                    },
                    message: result.message || '营业执照识别失败，使用模拟数据'
                });
            }

            // 只存入Enterprise表（保持原有逻辑）
            const query = "INSERT INTO Enterprise (EID, Name) VALUES (?, ?) ON DUPLICATE KEY UPDATE Name = VALUES(Name)";
            enterprise.query(query, [result.eid, result.name], (err, dbResult) => {
                if (err) {
                    console.error('数据库错误:', err);
                    // 即使数据库保存失败，也返回识别结果
                }

                console.log(`营业执照识别成功: ${result.name} (${result.eid})`);
                res.json({
                    success: true,
                    data: {
                        name: result.name,
                        eid: result.eid,
                        legalRepresentative: result.legalRepresentative || '未识别',
                        registeredCapital: result.registeredCapital || '未识别',
                        establishmentDate: result.establishmentDate || '未识别'
                    },
                    message: '营业执照识别成功'
                });
            });
        } catch (parseError) {
            console.error('处理营业执照时发生错误:', parseError);
            res.json({
                success: true,
                data: {
                    name: '测试科技有限公司',
                    eid: '91440300MA5DC6QX9X',
                    legalRepresentative: '张三',
                    registeredCapital: '100万人民币',
                    establishmentDate: '2020-01-15'
                },
                message: '营业执照处理异常，使用模拟数据'
            });
        }
    });
});

//--------------------------------------保存营业执照文件----------------------------------
app.post('/api/save-license-file', upload.single('license'), async (req, res) => {
    const { companyName, creditCode } = req.body;

    if (!companyName || !req.file) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数'
        });
    }

    try {
        // 生成文件名：营业执照-企业名称-信用代码.扩展名
        const fileExtension = req.file.originalname.split('.').pop();
        const sanitizedCompanyName = companyName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
        const sanitizedCreditCode = (creditCode || '').replace(/[^a-zA-Z0-9]/g, '');
        const fileName = `营业执照-${sanitizedCompanyName}-${sanitizedCreditCode}.${fileExtension}`;

        // 创建企业档案目录：EnterpriseArchives/企业名称-信用代码/
        const folderName = `${sanitizedCompanyName}-${sanitizedCreditCode}`;
        const enterpriseDir = path.join(__dirname, 'EnterpriseArchives', folderName);
        if (!fs.existsSync(enterpriseDir)) {
            fs.mkdirSync(enterpriseDir, { recursive: true });
        }

        // 保存文件
        const filePath = path.join(enterpriseDir, fileName);
        fs.renameSync(req.file.path, filePath);

        console.log(`营业执照文件已保存: ${fileName}`);

        res.json({
            success: true,
            message: '营业执照文件已保存',
            data: {
                fileName: fileName,
                serverPath: `./EnterpriseArchives/${folderName}/${fileName}`,
                companyName: companyName,
                creditCode: creditCode,
                folderName: folderName
            }
        });

    } catch (error) {
        console.error('保存营业执照文件失败:', error);

        // 清理临时文件
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: '保存失败: ' + error.message
        });
    }
});

//--------------------------------------修改员工验证文件保存（用于法定代表人身份证）----------------------------------
app.post('/api/save-legal-representative-id', upload.single('idCard'), async (req, res) => {
    const { userName, enterpriseName, idNumber, creditCode } = req.body;

    if (!userName || !enterpriseName || !req.file) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数'
        });
    }

    try {
        // 生成文件名：法定代表人身份证-姓名-身份证号后4位.扩展名
        const fileExtension = req.file.originalname.split('.').pop();
        const sanitizedUserName = userName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
        const idLast4 = idNumber ? idNumber.slice(-4) : '0000';
        const fileName = `法定代表人身份证-${sanitizedUserName}-${idLast4}.${fileExtension}`;

        // 使用与营业执照相同的文件夹
        const sanitizedEnterpriseName = enterpriseName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
        const sanitizedCreditCode = (creditCode || '').replace(/[^a-zA-Z0-9]/g, '');
        const folderName = `${sanitizedEnterpriseName}-${sanitizedCreditCode}`;
        const enterpriseDir = path.join(__dirname, 'EnterpriseArchives', folderName);

        if (!fs.existsSync(enterpriseDir)) {
            fs.mkdirSync(enterpriseDir, { recursive: true });
        }

        // 保存文件
        const filePath = path.join(enterpriseDir, fileName);
        fs.renameSync(req.file.path, filePath);

        console.log(`法定代表人身份证文件已保存: ${fileName}`);

        res.json({
            success: true,
            message: '法定代表人身份证已保存',
            data: {
                fileName: fileName,
                serverPath: `./EnterpriseArchives/${folderName}/${fileName}`,
                userName: userName,
                enterpriseName: enterpriseName,
                folderName: folderName
            }
        });

    } catch (error) {
        console.error('保存法定代表人身份证失败:', error);

        // 清理临时文件
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: '保存失败: ' + error.message
        });
    }
});

//--------------------------------------创建企业档案（纯文件系统版本）----------------------------------
app.post('/api/create-enterprise-archive', async (req, res) => {
    const {
        companyName,
        legalRepresentative,
        unifiedSocialCreditCode,
        registeredCapital,
        establishmentDate,
        idNumber,
        savedFiles,
        createTime
    } = req.body;

    if (!companyName || !legalRepresentative || !unifiedSocialCreditCode) {
        return res.status(400).json({
            success: false,
            message: '缺少必要的企业信息'
        });
    }

    try {
        // 创建企业档案记录
        const archiveData = {
            companyName,
            legalRepresentative,
            unifiedSocialCreditCode,
            registeredCapital,
            establishmentDate,
            idNumber,
            savedFiles,
            createTime: createTime || new Date().toISOString(),
            status: 'completed'
        };

        // 生成文件夹名称
        const sanitizedCompanyName = companyName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
        const sanitizedCreditCode = unifiedSocialCreditCode.replace(/[^a-zA-Z0-9]/g, '');
        const folderName = `${sanitizedCompanyName}-${sanitizedCreditCode}`;
        const archiveDir = path.join(__dirname, 'EnterpriseArchives', folderName);

        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }

        // 保存档案信息到JSON文件
        const archiveInfoPath = path.join(archiveDir, '企业档案信息.json');
        fs.writeFileSync(archiveInfoPath, JSON.stringify(archiveData, null, 2));

        // 创建README文件，说明文件夹内容
        const readmePath = path.join(archiveDir, 'README.txt');
        const readmeContent = `企业档案文件夹说明
==================

企业名称: ${companyName}
法定代表人: ${legalRepresentative}
统一社会信用代码: ${unifiedSocialCreditCode}
注册资本: ${registeredCapital}
成立日期: ${establishmentDate}
法定代表人身份证号: ${idNumber}
档案创建时间: ${archiveData.createTime}

文件列表:
- 企业档案信息.json: 企业基本信息
- 营业执照-${sanitizedCompanyName}-${sanitizedCreditCode}.jpg/png: 营业执照扫描件
- 法定代表人身份证-${legalRepresentative}-XXXX.jpg/png: 法定代表人身份证扫描件
- README.txt: 本说明文件

档案状态: ${archiveData.status}
`;
        fs.writeFileSync(readmePath, readmeContent);

        console.log(`企业档案创建成功: ${companyName} (文件夹: ${folderName})`);

        res.json({
            success: true,
            message: '企业档案创建成功',
            data: {
                companyName,
                archiveId: unifiedSocialCreditCode,
                folderName: folderName,
                archivePath: `./EnterpriseArchives/${folderName}`,
                createTime: archiveData.createTime,
                status: 'completed'
            }
        });

    } catch (error) {
        console.error('创建企业档案失败:', error);
        res.status(500).json({
            success: false,
            message: '创建企业档案失败: ' + error.message
        });
    }
});

//--------------------------------------获取企业档案列表（纯文件系统版本）----------------------------------
app.get('/api/enterprise-archives', (req, res) => {
    try {
        const archivesDir = path.join(__dirname, 'EnterpriseArchives');

        if (!fs.existsSync(archivesDir)) {
            return res.json({
                success: true,
                data: [],
                message: '暂无企业档案'
            });
        }

        const enterprises = [];
        const folders = fs.readdirSync(archivesDir);

        folders.forEach(folder => {
            const folderPath = path.join(archivesDir, folder);
            const archiveInfoPath = path.join(folderPath, '企业档案信息.json');

            if (fs.existsSync(archiveInfoPath)) {
                try {
                    const archiveInfo = JSON.parse(fs.readFileSync(archiveInfoPath, 'utf8'));
                    enterprises.push({
                        ...archiveInfo,
                        folderName: folder
                    });
                } catch (parseError) {
                    console.error(`解析企业档案失败: ${folder}`, parseError);
                }
            }
        });

        // 按创建时间排序
        enterprises.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

        res.json({
            success: true,
            data: enterprises,
            message: `找到 ${enterprises.length} 个企业档案`
        });

    } catch (error) {
        console.error('获取企业档案列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取企业档案列表失败: ' + error.message
        });
    }
});

//--------------------------------------获取单个企业档案详情（纯文件系统版本）----------------------------------
app.get('/api/enterprise-archive/:creditCode', (req, res) => {
    const { creditCode } = req.params;

    if (!creditCode) {
        return res.status(400).json({
            success: false,
            message: '缺少企业信用代码'
        });
    }

    try {
        const archivesDir = path.join(__dirname, 'EnterpriseArchives');

        if (!fs.existsSync(archivesDir)) {
            return res.status(404).json({
                success: false,
                message: '企业档案目录不存在'
            });
        }

        const folders = fs.readdirSync(archivesDir);
        let foundArchive = null;

        for (const folder of folders) {
            const archiveInfoPath = path.join(archivesDir, folder, '企业档案信息.json');

            if (fs.existsSync(archiveInfoPath)) {
                try {
                    const archiveInfo = JSON.parse(fs.readFileSync(archiveInfoPath, 'utf8'));
                    if (archiveInfo.unifiedSocialCreditCode === creditCode) {
                        // 获取文件夹内的所有文件
                        const folderPath = path.join(archivesDir, folder);
                        const files = fs.readdirSync(folderPath);

                        foundArchive = {
                            ...archiveInfo,
                            folderName: folder,
                            files: files.filter(file => file !== '企业档案信息.json')
                        };
                        break;
                    }
                } catch (parseError) {
                    console.error(`解析企业档案失败: ${folder}`, parseError);
                }
            }
        }

        if (!foundArchive) {
            return res.status(404).json({
                success: false,
                message: '未找到指定的企业档案'
            });
        }

        res.json({
            success: true,
            data: foundArchive,
            message: '企业档案获取成功'
        });

    } catch (error) {
        console.error('获取企业档案详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取企业档案详情失败: ' + error.message
        });
    }
});

//-----------------------------邮箱验证找回密码-------------------------------
app.post('/verify-user-email', (req, res) => {
    const { username, userType, email } = req.body;

    if (!username || !userType || !email) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数'
        });
    }

    // 查询 verification 表中的邮箱信息
    const query = "SELECT Name, Email FROM verification WHERE Name = ?";

    verification.query(query, [username], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: '数据库错误'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: '该用户不存在'
            });
        }

        // 比较邮箱是否匹配（忽略大小写）
        const storedEmail = results[0].Email;
        if (storedEmail.toLowerCase() === email.toLowerCase()) {
            // 验证用户是否存在于对应的用户类型表中
            verifyUserInTable(username, userType, (exists) => {
                if (exists) {
                    res.json({
                        success: true,
                        message: '邮箱验证成功'
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        message: '用户类型不匹配'
                    });
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: '邮箱地址不正确，请输入注册时使用的邮箱'
            });
        }
    });
});

// 辅助函数：验证用户是否存在于对应的表中
function verifyUserInTable(username, userType, callback) {
    let tableName;

    switch(userType) {
        case 'visitor':
            tableName = 'visitor';
            break;
        case 'manager':
            tableName = 'manager';
            break;
        case 'admin':
            tableName = 'admin';
            break;
        default:
            callback(false);
            return;
    }

    const query = `SELECT Name FROM ${tableName} WHERE Name = ?`;
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            callback(false);
        } else {
            callback(results.length > 0);
        }
    });
}

//-----------------------------------------邮箱验证--------------------------------
// 创建邮件发送器
const transporter = nodemailer.createTransport(qqEmailConfig);

// 验证邮件配置
transporter.verify(function(error, success) {
    if (error) {
        console.error('QQ邮箱配置错误:', error);
        console.log('请检查邮箱账号和授权码是否正确');
    } else {
        console.log('QQ邮箱配置成功，可以发送邮件');
    }
});

// 创建Redis客户端
const redisClient = redis.createClient({
    socket: {
        host: 'localhost',
        port: REDIS_PORT
    }
});

// 修改Redis客户端连接部分，添加重试逻辑
const connectRedisClient = async (retries = 5) => {
    try {
        await redisClient.connect();
        console.log('Redis客户端连接成功');
    } catch (err) {
        console.error('Redis客户端连接失败:', err.message);
        if (retries > 0) {
            console.log(`等待2秒后重试... (剩余重试次数: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            await connectRedisClient(retries - 1);
        } else {
            console.error('❌ 无法连接到Redis服务器');
        }
    }
};

// 发送验证码
app.post('/api/send-verification-code', async (req, res) => {
    const { email } = req.body;

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: '邮箱格式不正确'
        });
    }

    try {
        // 生成6位验证码
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        console.log(`发送验证码 ${code} 到邮箱: ${email}`);

        // 邮件内容
        const mailOptions = {
            from: `"厨房检测系统" <${qqEmailConfig.auth.user}>`,
            to: email,
            subject: '【厨房检测系统】邮箱验证码',
            html: `
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="background-color: #667eea; padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">厨房检测系统</h1>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 40px;">
                        <h2 style="color: #333; text-align: center;">邮箱验证码</h2>
                        <p style="color: #666; text-align: center; font-size: 16px;">
                            您正在进行邮箱验证，请使用以下验证码：
                        </p>
                        <div style="background-color: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                            <span style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 5px;">${code}</span>
                        </div>
                        <p style="color: #999; text-align: center; font-size: 14px;">
                            验证码有效期为5分钟，请尽快使用。<br>
                            如果这不是您的操作，请忽略此邮件。
                        </p>
                    </div>
                    <div style="background-color: #f0f0f0; padding: 20px; text-align: center;">
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            此邮件由系统自动发送，请勿回复
                        </p>
                    </div>
                </div>
            `,
            text: `您的验证码是：${code}\n\n验证码有效期为5分钟，请尽快使用。`
        };

        // 发送邮件
        await transporter.sendMail(mailOptions);

        // 存储验证码到Redis (5分钟过期) - 使用新版API
        try {
            await redisClient.setEx(`verify_code:${email}`, 300, code);
            console.log('验证码已存储到Redis');
        } catch (redisErr) {
            console.error('Redis存储验证码失败:', redisErr);
            // 即使Redis失败，邮件已发送，可以考虑使用内存存储作为备份
        }

        res.json({
            success: true,
            message: '验证码已发送到您的邮箱'
        });

    } catch (error) {
        console.error('发送邮件失败:', error);

        let errorMessage = '验证码发送失败，请稍后重试';
        if (error.responseCode === 535) {
            errorMessage = '邮箱认证失败，请检查QQ邮箱和授权码';
        }

        res.status(500).json({
            success: false,
            message: errorMessage
        });
    }
});

// 验证验证码
app.post('/api/verify-code', async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({
            success: false,
            message: '邮箱和验证码不能为空'
        });
    }

    try {
        // 从Redis获取验证码 - 使用新版API
        const storedCode = await redisClient.get(`verify_code:${email}`);

        if (!storedCode) {
            return res.status(400).json({
                success: false,
                message: '验证码已过期或不存在'
            });
        }

        if (storedCode === code.toString()) {
            // 验证成功，删除验证码
            await redisClient.del(`verify_code:${email}`);
            console.log(`邮箱 ${email} 验证成功`);

            res.json({
                success: true,
                message: '验证成功'
            });
        } else {
            res.status(400).json({
                success: false,
                message: '验证码错误'
            });
        }
    } catch (error) {
        console.error('Redis读取错误:', error);
        return res.status(500).json({
            success: false,
            message: '验证失败'
        });
    }
});

// 健康检查
app.get('/api/health', async (req, res) => {
    const status = {
        redis: 'ERROR',
        email: 'ERROR'
    };

    // 检查Redis - 使用新版API
    try {
        await redisClient.ping();
        status.redis = 'OK';
    } catch (err) {
        console.error('Redis健康检查失败:', err);
    }

    // 检查邮件服务
    try {
        await transporter.verify();
        status.email = 'OK';
    } catch (err) {
        console.error('邮件服务健康检查失败:', err);
    }

    const allOk = status.redis === 'OK' && status.email === 'OK';

    res.status(allOk ? 200 : 503).json({
        success: allOk,
        message: allOk ? '所有服务正常' : '部分服务异常',
        services: status,
        timestamp: new Date().toISOString()
    });
});

//-----------------------------密码重置功能-------------------------------
app.post('/reset-password', (req, res) => {
    const { username, userType, newPassword } = req.body;

    // 验证参数
    if (!username || !userType || !newPassword) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数'
        });
    }

    // 验证密码格式（后端也要验证）
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,16}$/;
    if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
            success: false,
            message: '密码格式不符合要求'
        });
    }

    // 根据 userType 选择对应的表名
    let tableName;

    switch(userType) {
        case 'visitor':
            tableName = 'visitor';
            break;
        case 'manager':
            tableName = 'manager';
            break;
        case 'admin':
            tableName = 'admin';
            break;
        default:
            return res.status(400).json({
                success: false,
                message: '无效的用户类型'
            });
    }

    // 更新密码
    const updateQuery = `UPDATE ${tableName} SET Password = ? WHERE Name = ?`;

    db.query(updateQuery, [newPassword, username], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: '数据库错误'
            });
        }

        // 检查是否有记录被更新
        if (results.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 密码修改成功
        console.log(`Password reset successful for user: ${username} (${userType})`);
        res.json({
            success: true,
            message: '密码修改成功'
        });
    });
});

//--------------------------------------检查用户名是否存在----------------------------------
app.post('/api/check-username', (req, res) => {
    const { username } = req.body;

    console.log('检查用户名请求:', username); // 添加日志以便调试

    if (!username) {
        return res.status(400).json({
            success: false,
            message: '用户名不能为空'
        });
    }

    // 检查用户名长度
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({
            success: false,
            message: '用户名长度应在3-20个字符之间'
        });
    }

    // 检查用户名是否已存在于visitor表
    const checkVisitorQuery = "SELECT Name FROM visitor WHERE Name = ?";
    visitor.query(checkVisitorQuery, [username], (err, results) => {
        if (err) {
            console.error('检查用户名错误:', err);
            return res.status(500).json({
                success: false,
                message: '服务器错误'
            });
        }

        if (results.length > 0) {
            return res.json({
                success: true,
                exists: true
            });
        }

        // 检查验证表中是否存在该用户名
        const checkVerificationQuery = "SELECT Name FROM verification WHERE Name = ?";
        verification.query(checkVerificationQuery, [username], (err, verificationResults) => {
            if (err) {
                console.error('检查验证表错误:', err);
                return res.status(500).json({
                    success: false,
                    message: '服务器错误'
                });
            }

            res.json({
                success: true,
                exists: verificationResults.length > 0
            });
        });
    });
});

//--------------------------------------访客注册API----------------------------------
app.post('/api/visitor-register', (req, res) => {
    const { username, email, password } = req.body;

    console.log('注册请求:', { username, email }); // 不要记录密码

    // 验证输入参数
    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: '所有字段都是必填的'
        });
    }

    // 验证用户名长度
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({
            success: false,
            message: '用户名长度应在3-20个字符之间'
        });
    }

    // 验证密码格式
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,16}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({
            success: false,
            message: '密码格式不符合要求'
        });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: '邮箱格式不正确'
        });
    }

    // 检查用户名是否已存在（在visitor表中）
    const checkUsernameQuery = "SELECT Name FROM visitor WHERE Name = ?";
    visitor.query(checkUsernameQuery, [username], (err, usernameResults) => {
        if (err) {
            console.error('检查用户名错误:', err);
            return res.status(500).json({
                success: false,
                message: '服务器错误'
            });
        }

        if (usernameResults.length > 0) {
            return res.status(400).json({
                success: false,
                message: '用户名已存在，请选择其他用户名'
            });
        }

        // 检查邮箱是否已存在（在verification表中）
        const checkEmailQuery = "SELECT Email FROM verification WHERE Email = ?";
        verification.query(checkEmailQuery, [email], (err, emailResults) => {
            if (err) {
                console.error('检查邮箱错误:', err);
                return res.status(500).json({
                    success: false,
                    message: '服务器错误'
                });
            }

            if (emailResults.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: '邮箱已被使用，请选择其他邮箱'
                });
            }

            // 开始数据库事务
            db.beginTransaction((err) => {
                if (err) {
                    console.error('开始事务失败:', err);
                    return res.status(500).json({
                        success: false,
                        message: '服务器错误'
                    });
                }

                // 插入到visitor表
                const insertVisitorQuery = "INSERT INTO visitor (Name, Password) VALUES (?, ?)";
                db.query(insertVisitorQuery, [username, password], (err, visitorResult) => {
                    if (err) {
                        console.error('插入visitor表错误:', err);
                        return db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                message: '注册失败，请重试'
                            });
                        });
                    }

                    // 插入到verification表
                    const insertVerificationQuery = "INSERT INTO verification (Name, Email) VALUES (?, ?)";
                    db.query(insertVerificationQuery, [username, email], (err, verificationResult) => {
                        if (err) {
                            console.error('插入verification表错误:', err);
                            return db.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    message: '注册失败，请重试'
                                });
                            });
                        }

                        // 提交事务
                        db.commit((err) => {
                            if (err) {
                                console.error('提交事务失败:', err);
                                return db.rollback(() => {
                                    res.status(500).json({
                                        success: false,
                                        message: '注册失败，请重试'
                                    });
                                });
                            }

                            console.log(`用户 ${username} 注册成功`);
                            res.json({
                                success: true,
                                message: '注册成功'
                            });
                        });
                    });
                });
            });
        });
    });
});

// 10. 修改服务器启动部分
app.listen(PORT, async () => {
    console.log('🍳 厨房检测系统启动中...');
    console.log('========================');
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    
    // 检查环境变量是否加载
    if (process.env.DB_HOST) {
        console.log('✅ 环境变量已加载');
        console.log(`📊 数据库配置: ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    } else {
        console.log('⚠️  未检测到环境变量，使用默认配置');
        console.log('💡 请创建 .env 文件或运行 npm run setup 进行配置');
    }
    
    // 初始化数据库连接
    console.log('🔗 初始化数据库...');
    const dbInitSuccess = await initializeDatabase();
    
    if (dbInitSuccess) {
        console.log('✅ 数据库初始化成功');
    } else {
        console.log('⚠️  数据库初始化失败，但服务器将继续启动');
        console.log('💡 部分功能可能受限，请运行 npm run setup 重新配置');
    }
    
    // 创建应用数据库连接
    db = createDatabaseConnection();
    
    // 创建连接别名（保持向后兼容）
    kitchen_detection_system = db;
    visitor = db;
    manager = db;
    admin = db;
    security_question = db;
    verification = db;
    enterprise = db;
    
    // 检查邮箱配置
    if (process.env.EMAIL_USER && process.env.EMAIL_USER !== '2024379585@qq.com') {
        console.log('📧 邮箱服务已配置:', process.env.EMAIL_USER);
    } else if (process.env.EMAIL_USER) {
        console.log('📧 使用默认邮箱配置:', process.env.EMAIL_USER);
    } else {
        console.log('📧 邮箱服务未配置（可选功能，注册时需要）');
    }
    
    // 启动其他服务
    console.log('🔴 启动Redis服务...');
    startRedisServer();
    
    // 等待Redis启动后再启动其他服务
    setTimeout(() => {
        console.log('🐍 启动Python人脸识别服务...');
        startPythonApp();
        console.log('☕ 启动Java OCR服务...');
        startJavaOcrApp();
    }, 3000);
    
    // 延迟连接Redis客户端
    setTimeout(async () => {
        await connectRedisClient();
    }, 4000);
    
    console.log('========================');
    console.log('🎉 系统启动完成！');
    console.log('🔍 健康检查: GET /api/system/health');
    console.log('📝 如需重新配置: npm run setup');
});

// 11. 优雅关闭处理
process.on('SIGINT', async () => {
    console.log('\n🛑 正在关闭服务器...');

    // 关闭数据库连接
    if (db) {
        db.end((err) => {
            if (err) {
                console.error('关闭数据库连接失败:', err);
            } else {
                console.log('✅ 数据库连接已关闭');
            }
        });
    }

    // 关闭Redis连接
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        console.log('✅ Redis连接已关闭');
    }

    // 关闭Redis服务器进程
    if (redisServerProcess) {
        redisServerProcess.kill();
        console.log('✅ Redis服务器进程已关闭');
    }

    // 关闭Python进程
    if (pythonProcess) {
        pythonProcess.kill();
        console.log('✅ Python进程已关闭');
    }

    // 关闭Java进程
    if (javaOcrProcess) {
        javaOcrProcess.kill();
        console.log('✅ Java进程已关闭');
    }

    console.log('👋 服务器已安全关闭');
    process.exit(0);
});