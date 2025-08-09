let selectedFile = null;
let extractedUserInfo = null; // 存储从身份证中提取的用户信息

// 文件上传处理
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('idCard');
const filePreview = document.getElementById('filePreview');

// 拖拽事件处理
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// 检查企业名称是否存在
async function checkEnterpriseExists(enterpriseName) {
    try {
        const response = await fetch('/api/check-enterprise', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enterpriseName })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error('检查企业名称失败');
        }

        return data.exists;
    } catch (error) {
        console.error('检查企业名称错误:', error);
        throw new Error('无法验证企业名称，请检查网络连接');
    }
}

function handleFileSelect(file) {
    // 文件大小检查
    if (file.size > 5 * 1024 * 1024) {
        showError('文件大小超过限制，请选择小于5MB的文件');
        return;
    }

    // 文件类型检查
    if (!file.type.startsWith('image/')) {
        showError('请选择有效的图片文件');
        return;
    }

    selectedFile = file;
    console.log('文件已选择:', file.name, file.size, 'bytes');

    // 关键修复：将拖拽的文件同步到 file input 元素
    // 这样可以解决拖拽文件时浏览器认为 required 字段未填写的问题
    try {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        console.log('✅ 文件已同步到 input 元素，files.length:', fileInput.files.length);
    } catch (error) {
        console.log('⚠️ 无法同步文件到 input 元素（可能是浏览器兼容性问题）:', error);
        // 如果 DataTransfer 不支持，建议移除 HTML 中的 required 属性
        console.log('建议在 HTML 中移除 file input 的 required 属性');
    }

    displayFilePreview(file);

    // 尝试自动识别身份证信息
    startOCRRecognition(file);
}

function displayFilePreview(file) {
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    filePreview.style.display = 'block';
    uploadArea.style.border = '2px solid #28a745';
    uploadArea.querySelector('.upload-text').textContent = '文件已选择';
}

// 显示手动输入用户信息的表单
function showManualInputForm() {
    // 如果您有OCR服务，可以在这里调用
    // 否则让用户手动输入信息
    const userInfo = document.getElementById('userInfo');

    // 创建输入表单（如果还没有）
    if (!document.getElementById('manualInputForm')) {
        const formHTML = `
            <div id="manualInputForm" style="margin-top: 15px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                <h4>请输入身份证信息：</h4>
                <div style="margin-bottom: 10px;">
                    <label>姓名：</label>
                    <input type="text" id="inputName" name="inputName" style="width: 200px; padding: 5px;" required>
                </div>
                <div style="margin-bottom: 10px;">
                    <label>性别：</label>
                    <select id="inputGender" name="inputGender" style="width: 100px; padding: 5px;">
                        <option value="男">男</option>
                        <option value="女">女</option>
                    </select>
                </div>
                <div style="margin-bottom: 10px;">
                    <label>身份证号：</label>
                    <input type="text" id="inputIdNumber" name="inputIdNumber" style="width: 250px; padding: 5px;" maxlength="18" required>
                </div>
                <button type="button" onclick="confirmUserInfo()" style="padding: 8px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">确认信息</button>
            </div>
        `;
        userInfo.insertAdjacentHTML('beforeend', formHTML);
    }

    userInfo.style.display = 'block';
}

async function startOCRRecognition(file) {
    const formData = new FormData();
    formData.append('idCard', file);

    // 显示识别中的提示
    uploadArea.querySelector('.upload-text').textContent = '正在识别身份证信息，请稍候...';

    try {
        const response = await fetch('/api/ocr-idcard', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        // 更详细的错误处理
        if (!response.ok) {
            throw new Error(data.message || `HTTP错误: ${response.status}`);
        }

        if (data.success && data.data) {
            // 识别成功，自动填充信息
            extractedUserInfo = {
                name: data.data.name || '',
                gender: data.data.sex || data.data.gender || '',
                idNumber: data.data.idNumber || '',
                // 新增字段
                birth: data.data.birth || '',
                address: data.data.address || '',
                nation: data.data.nation || ''
            };

            console.log('OCR识别成功:', extractedUserInfo);
            displayUserInfo(extractedUserInfo);
            uploadArea.querySelector('.upload-text').textContent = '✅ 身份证信息识别成功';

            // 如果识别成功，不显示手动输入表单
            const manualForm = document.getElementById('manualInputForm');
            if (manualForm) {
                manualForm.style.display = 'none';
            }
        } else {
            // 识别失败，显示具体错误信息和手动输入表单
            const errorMsg = data.message || '身份证自动识别失败';
            uploadArea.querySelector('.upload-text').textContent = `⚠️ ${errorMsg}`;
            showManualInputForm();

            // 如果是图片质量问题，给出具体提示
            if (errorMsg.includes('模糊') || errorMsg.includes('反光') || errorMsg.includes('过暗')) {
                showError(`识别失败：${errorMsg}\n\n请重新拍照或手动输入信息`);
            }
        }
    } catch (error) {
        console.error('OCR识别错误:', error);

        let errorMessage = '身份证识别服务异常，请手动输入信息';
        if (error.message.includes('网络') || error.message.includes('timeout')) {
            errorMessage = '网络连接异常，请检查网络后重试或手动输入信息';
        } else if (error.message.includes('服务未启动')) {
            errorMessage = 'OCR服务暂时不可用，请手动输入信息';
        }

        uploadArea.querySelector('.upload-text').textContent = `⚠️ ${errorMessage}`;
        showManualInputForm();
    }
}

// 确认用户输入的信息
window.confirmUserInfo = function() {
    const name = document.getElementById('inputName').value.trim();
    const gender = document.getElementById('inputGender').value;
    const idNumber = document.getElementById('inputIdNumber').value.trim();

    if (!name || !idNumber) {
        showError('请填写完整的身份信息');
        return;
    }

    if (!validateIdNumber(idNumber)) {
        showError('身份证号码格式不正确');
        return;
    }

    extractedUserInfo = {
        name: name,
        gender: gender,
        idNumber: idNumber
    };

    console.log('手动输入信息确认:', extractedUserInfo);
    displayUserInfo(extractedUserInfo);

    // 隐藏输入表单
    document.getElementById('manualInputForm').style.display = 'none';

    // 显示用户信息区域
    document.getElementById('userInfo').style.display = 'block';
}

// 显示用户信息
function displayUserInfo(userInfo) {
    document.getElementById('userName').textContent = userInfo.name || '未识别';
    document.getElementById('userGender').textContent = userInfo.gender || '未识别';
    document.getElementById('userIdNumber').textContent =
        userInfo.idNumber ? userInfo.idNumber.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2') : '未识别';

    // 显示预计的文件名
    const enterpriseName = document.getElementById('enterpriseName').value.trim();
    if (userInfo.name && enterpriseName) {
        const previewName = generateFileName(userInfo.name, enterpriseName, selectedFile);
        document.getElementById('previewFileName').textContent = previewName;
    } else if (userInfo.name) {
        document.getElementById('previewFileName').textContent =
            `${userInfo.name}-[企业名称].${selectedFile.name.split('.').pop()}`;
    }

    // 显示用户信息区域
    document.getElementById('userInfo').style.display = 'block';
}

// 监听企业名称输入，实时更新文件名预览
document.getElementById('enterpriseName').addEventListener('input', (e) => {
    if (extractedUserInfo && extractedUserInfo.name && selectedFile) {
        const enterpriseName = e.target.value.trim();
        if (enterpriseName) {
            const previewName = generateFileName(extractedUserInfo.name, enterpriseName, selectedFile);
            document.getElementById('previewFileName').textContent = previewName;
        } else {
            document.getElementById('previewFileName').textContent =
                `${extractedUserInfo.name}-[企业名称].${selectedFile.name.split('.').pop()}`;
        }
    }
});

function removeFile() {
    selectedFile = null;
    extractedUserInfo = null;
    filePreview.style.display = 'none';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('saveProgress').style.display = 'none';
    uploadArea.style.border = '2px dashed #667eea';
    uploadArea.querySelector('.upload-text').textContent = '点击上传或拖拽文件到此处';
    fileInput.value = '';

    // 重置输入表单
    const inputForm = document.getElementById('manualInputForm');
    if (inputForm) {
        document.getElementById('inputName').value = '';
        document.getElementById('inputIdNumber').value = '';
        inputForm.style.display = 'block';
    }

    console.log('文件已移除，重置所有状态');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 文件名生成函数
function generateFileName(userName, enterpriseName, originalFile) {
    const fileExtension = originalFile.name.split('.').pop();
    // 清理用户名和企业名称，只保留中文、英文、数字
    const sanitizedUserName = userName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
    const sanitizedEnterpriseName = enterpriseName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
    return `${sanitizedUserName}-${sanitizedEnterpriseName}.${fileExtension}`;
}

// 真实的文件上传到服务器
async function saveFileToServer(file, userName, enterpriseName, idNumber) {
    const formData = new FormData();
    formData.append('idCard', file);
    formData.append('userName', userName);
    formData.append('enterpriseName', enterpriseName);
    formData.append('idNumber', idNumber);

    try {
        const response = await fetch('/api/save-employee-verification', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || '上传失败');
        }

        return {
            success: true,
            fileName: data.data.fileName,
            serverPath: data.data.serverPath,
            message: '文件已保存到服务器'
        };
    } catch (error) {
        console.error('上传文件失败:', error);
        throw new Error('文件上传失败: ' + error.message);
    }
}

// 身份证号码验证函数
function validateIdNumber(idNumber) {
    // 去除空格和特殊字符
    idNumber = idNumber.replace(/\s/g, '').toUpperCase();

    if (idNumber.length !== 18) {
        return false;
    }

    // 检查前17位是否都是数字
    if (!/^\d{17}/.test(idNumber)) {
        return false;
    }

    // 检查最后一位是否是数字或X
    if (!/[\dX]$/.test(idNumber)) {
        return false;
    }

    const factors = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checksumMap = {0: '1', 1: '0', 2: 'X', 3: '9', 4: '8', 5: '7', 6: '6', 7: '5', 8: '4', 9: '3', 10: '2'};

    let total = 0;
    for (let i = 0; i < 17; i++) {
        total += parseInt(idNumber[i]) * factors[i];
    }

    return idNumber[17] === checksumMap[total % 11];
}

// 表单提交处理
document.getElementById('verificationForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const enterpriseName = document.getElementById('enterpriseName').value.trim();
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    const btnText = document.querySelector('.btn-text');

    console.log('=== 表单提交开始 ===');
    console.log('企业名称:', enterpriseName);
    console.log('selectedFile:', selectedFile);
    console.log('extractedUserInfo:', extractedUserInfo);
    console.log('fileInput.files.length:', fileInput.files.length);
    console.log('fileInput.value:', fileInput.value);

    // 清除之前的错误样式
    document.getElementById('enterpriseName').classList.remove('error-input');

    if (!enterpriseName) {
        console.log('❌ 企业名称为空');
        showError('请输入企业名称', 'enterpriseName');
        return;
    }

    // 更详细的文件检查
    if (!selectedFile) {
        console.log('❌ selectedFile 为空');
        console.log('fileInput.files:', fileInput.files);
        showError('请上传身份证件照');
        return;
    }

    // 检查文件是否有效
    if (!selectedFile.name || selectedFile.size === 0) {
        console.log('❌ 文件无效:', selectedFile);
        showError('选择的文件无效，请重新选择');
        return;
    }

    if (!extractedUserInfo) {
        console.log('❌ extractedUserInfo 为空');
        showError('请输入身份证件信息');
        return;
    }

    if (!extractedUserInfo.name || !extractedUserInfo.idNumber) {
        console.log('❌ 用户信息不完整:', extractedUserInfo);
        showError('身份证信息不完整，请重新输入');
        return;
    }

    console.log('✅ 所有验证通过，开始提交...');

    // 显示加载状态
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    loading.style.display = 'flex';

    try {
        // 验证企业名称
        console.log('正在验证企业名称...');
        const enterpriseExists = await checkEnterpriseExists(enterpriseName);
        console.log('企业验证结果:', enterpriseExists);

        if (!enterpriseExists) {
            throw new Error('企业名称未在系统中找到，请检查企业名称是否正确');
        }

        // 保存文件到服务器
        console.log('开始保存证件照文件...');
        console.log('文件信息:', {
            name: selectedFile.name,
            size: selectedFile.size,
            type: selectedFile.type
        });

        const serverSaveResult = await saveFileToServer(
            selectedFile,
            extractedUserInfo.name,
            enterpriseName,
            extractedUserInfo.idNumber
        );
        console.log('服务器保存结果:', serverSaveResult);

        // 保存验证通过的数据
        const verificationData = {
            enterpriseName: enterpriseName,
            verificationPassed: true,
            idCardData: extractedUserInfo,
            savedFile: serverSaveResult,
            timestamp: new Date().toISOString()
        };

        // 存储到sessionStorage传递给下一页
        sessionStorage.setItem('verificationData', JSON.stringify(verificationData));
        console.log('验证数据已保存到sessionStorage');

        // 显示成功提示
        showSuccess(
            `验证成功！\n\n` +
            `用户姓名：${extractedUserInfo.name}\n` +
            `企业名称：${enterpriseName}\n` +
            `文件已保存到服务器\n\n` +
            `即将跳转到下一步...`,
            () => {
                // 3秒后跳转到下一页
                setTimeout(() => {
                    window.location.href = 'register2.html';
                }, 3000);
            }
        );

    } catch (error) {
        console.error('❌ 提交表单时出错:', error);
        let errorField = null;
        if (error.message.includes('企业名称')) {
            errorField = 'enterpriseName';
        } else if (error.message.includes('身份证') || error.message.includes('文件')) {
            // 不清空文件，让用户可以重试
        }
        showError(error.message, errorField);
    } finally {
        // 恢复按钮状态
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        loading.style.display = 'none';
        console.log('=== 表单提交结束 ===');
    }
});

function showError(message, fieldId = null) {
    console.log('显示错误信息:', message);
    document.getElementById('modalIcon').textContent = '⚠️';
    document.getElementById('modalIcon').className = 'error-icon';
    document.getElementById('modalTitle').textContent = '验证失败';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorModal').style.display = 'block';

    // 如果指定了字段，添加错误样式
    if (fieldId) {
        const field = document.getElementById(fieldId);
        field.classList.add('error-input');

        // 3秒后移除错误样式
        setTimeout(() => {
            field.classList.remove('error-input');
        }, 3000);
    }
}

function showSuccess(message, callback = null) {
    console.log('显示成功信息:', message);
    document.getElementById('modalIcon').textContent = '✅';
    document.getElementById('modalIcon').className = 'success-icon';
    document.getElementById('modalTitle').textContent = '验证成功';
    document.getElementById('errorMessage').style.whiteSpace = 'pre-line';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorModal').style.display = 'block';

    if (callback) {
        // 如果有回调函数，在关闭模态框时执行
        const closeBtn = document.querySelector('.close-btn');
        closeBtn.onclick = () => {
            closeModal();
            callback();
        };
    }
}

function closeModal() {
    document.getElementById('errorModal').style.display = 'none';
    document.getElementById('errorMessage').style.whiteSpace = 'normal';

    // 重置关闭按钮的事件处理器
    const closeBtn = document.querySelector('.close-btn');
    closeBtn.onclick = closeModal;
}

// 点击模态框外部关闭
window.addEventListener('click', (e) => {
    const modal = document.getElementById('errorModal');
    if (e.target === modal) {
        closeModal();
    }
});

// ESC键关闭模态框
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});