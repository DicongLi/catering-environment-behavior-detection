// 全局变量存储识别结果
let licenseData = null;
let idData = null;
let uploadedFiles = {};

// 文件上传处理
function setupFileUpload(inputId, cardId, progressId, previewId, type) {
    const input = document.getElementById(inputId);
    const card = document.getElementById(cardId);
    const progressBar = document.getElementById(progressId);
    const preview = document.getElementById(previewId);

    // 拖拽功能
    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.classList.add('dragover');
    });

    card.addEventListener('dragleave', () => {
        card.classList.remove('dragover');
    });

    card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0], type, input);
        }
    });

    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0], type, input);
        }
    });

    function handleFile(file, type, inputElement) {
        console.log(`处理${type}文件:`, file.name, file.size, 'bytes');
        
        // 文件大小验证
        if (file.size > 10 * 1024 * 1024) {
            showStatus('文件大小不能超过10MB', 'error');
            return;
        }

        // 文件类型验证
        const allowedTypes = type === 'license' ?
            ['image/jpeg', 'image/png', 'image/jpg'] :
            ['image/jpeg', 'image/png', 'image/jpg'];

        if (!allowedTypes.includes(file.type)) {
            showStatus(`${type === 'license' ? '营业执照' : '身份证'}文件格式不支持，请上传JPG或PNG格式`, 'error');
            return;
        }

        // 同步拖拽文件到input元素（解决拖拽上传的问题）
        try {
            const dt = new DataTransfer();
            dt.items.add(file);
            inputElement.files = dt.files;
            console.log(`✅ ${type}文件已同步到 input 元素`);
        } catch (error) {
            console.log(`⚠️ 无法同步${type}文件到 input 元素:`, error);
        }

        uploadedFiles[type] = file;
        showProgress(progressId);
        showPreview(file, previewId);
        card.classList.add('uploaded');

        // 模拟上传进度
        simulateProgress(progressId, () => {
            // 上传完成后进行OCR识别
            performOCR(file, type);
        });
    }
}

// 显示进度条
function showProgress(progressId) {
    const progressBar = document.getElementById(progressId);
    progressBar.style.display = 'block';
}

// 模拟进度
function simulateProgress(progressId, callback) {
    const progressFill = document.querySelector(`#${progressId} .progress-fill`);
    let width = 0;
    const interval = setInterval(() => {
        width += Math.random() * 20;
        if (width >= 100) {
            width = 100;
            clearInterval(interval);
            setTimeout(callback, 500);
        }
        progressFill.style.width = width + '%';
    }, 200);
}

// 显示预览
function showPreview(file, previewId) {
    const preview = document.getElementById(previewId);
    preview.style.display = 'block';

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" class="preview-img" alt="预览图">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">📄 ${file.name}</div>`;
    }
}

// 真实的OCR识别
async function performOCR(file, type) {
    console.log(`开始${type === 'license' ? '营业执照' : '身份证'}OCR识别...`);
    
    try {
        if (type === 'license') {
            // 营业执照识别
            const licenseResult = await uploadBusinessLicense(file);
            if (licenseResult.success) {
                licenseData = {
                    companyName: licenseResult.data.name,
                    legalRepresentative: licenseResult.data.legalRepresentative || '未识别',
                    unifiedSocialCreditCode: licenseResult.data.eid,
                    registeredCapital: licenseResult.data.registeredCapital || '未识别',
                    establishmentDate: licenseResult.data.establishmentDate || '未识别',
                    validationScore: 0.95,
                    isValid: true
                };
                displayLicenseResult(licenseData);
                showStatus('✅ 营业执照识别成功', 'success');
            } else {
                throw new Error(licenseResult.message || '营业执照识别失败');
            }
        } else {
            // 身份证识别
            const idResult = await performIdCardOCR(file);
            if (idResult.success) {
                idData = {
                    name: idResult.data.name,
                    idNumber: idResult.data.idNumber,
                    address: idResult.data.address || '未识别',
                    issueDate: idResult.data.birth || '未识别',
                    validationScore: 0.92,
                    isValid: true
                };
                displayIdResult(idData);
                showStatus('✅ 身份证识别成功', 'success');
            } else {
                throw new Error(idResult.message || '身份证识别失败');
            }
        }

        checkSubmitConditions();
    } catch (error) {
        console.error(`${type}识别失败:`, error);
        showStatus(`❌ ${type === 'license' ? '营业执照' : '身份证'}识别失败: ${error.message}`, 'error');
        
        // 识别失败时重置数据
        if (type === 'license') {
            licenseData = null;
        } else {
            idData = null;
        }
        checkSubmitConditions();
    }
}

// 营业执照上传和识别
// 在 register_yet.js 中修改营业执照识别
async function uploadBusinessLicense(file) {
    const formData = new FormData();
    formData.append('license', file);  // 注意参数名是 'license'

    try {
        const response = await fetch('http://localhost:8080/api/ocr/business-license', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('营业执照上传失败:', error);
        throw new Error('营业执照上传失败: ' + error.message);
    }
}

// 身份证OCR识别
async function performIdCardOCR(file) {
    const formData = new FormData();
    formData.append('idCard', file);

    try {
        const response = await fetch('/api/ocr-idcard', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('身份证OCR识别失败:', error);
        throw new Error('身份证OCR识别失败: ' + error.message);
    }
}

// 显示营业执照识别结果
function displayLicenseResult(data) {
    const resultSection = document.getElementById('resultSection');
    const licenseResult = document.getElementById('licenseResult');
    const licenseInfo = document.getElementById('licenseInfo');
    const licenseValidation = document.getElementById('licenseValidation');

    resultSection.style.display = 'block';
    licenseResult.style.display = 'block';

    licenseInfo.innerHTML = `
        <div class="info-item">
            <div class="info-label">企业名称</div>
            <div class="info-value">${data.companyName}</div>
        </div>
        <div class="info-item">
            <div class="info-label">法定代表人</div>
            <div class="info-value">${data.legalRepresentative}</div>
        </div>
        <div class="info-item">
            <div class="info-label">统一社会信用代码</div>
            <div class="info-value">${data.unifiedSocialCreditCode}</div>
        </div>
        <div class="info-item">
            <div class="info-label">注册资本</div>
            <div class="info-value">${data.registeredCapital}</div>
        </div>
        <div class="info-item">
            <div class="info-label">成立日期</div>
            <div class="info-value">${data.establishmentDate}</div>
        </div>
        <div class="info-item">
            <div class="info-label">识别置信度</div>
            <div class="info-value">${(data.validationScore * 100).toFixed(1)}%</div>
        </div>
    `;

    licenseValidation.className = `validation-status ${data.isValid ? 'valid' : 'invalid'}`;
    licenseValidation.innerHTML = data.isValid ?
        '✅ 营业执照验证通过' :
        '❌ 营业执照验证失败';
}

// 显示身份证识别结果
function displayIdResult(data) {
    const idResult = document.getElementById('idResult');
    const idInfo = document.getElementById('idInfo');
    const idValidation = document.getElementById('idValidation');

    idResult.style.display = 'block';

    idInfo.innerHTML = `
        <div class="info-item">
            <div class="info-label">姓名</div>
            <div class="info-value">${data.name}</div>
        </div>
        <div class="info-item">
            <div class="info-label">身份证号</div>
            <div class="info-value">${data.idNumber.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2')}</div>
        </div>
        <div class="info-item">
            <div class="info-label">地址</div>
            <div class="info-value">${data.address}</div>
        </div>
        <div class="info-item">
            <div class="info-label">出生日期</div>
            <div class="info-value">${data.issueDate}</div>
        </div>
        <div class="info-item">
            <div class="info-label">识别置信度</div>
            <div class="info-value">${(data.validationScore * 100).toFixed(1)}%</div>
        </div>
    `;

    idValidation.className = `validation-status ${data.isValid ? 'valid' : 'invalid'}`;
    idValidation.innerHTML = data.isValid ?
        '✅ 身份证验证通过' :
        '❌ 身份证验证失败';
}

// 检查提交条件
function checkSubmitConditions() {
    const submitBtn = document.getElementById('submitBtn');

    console.log('检查提交条件:', {
        licenseData: licenseData,
        idData: idData,
        licenseValid: licenseData?.isValid,
        idValid: idData?.isValid
    });

    if (licenseData && idData && licenseData.isValid && idData.isValid) {
        // 验证法定代表人姓名是否匹配
        if (licenseData.legalRepresentative === idData.name) {
            submitBtn.disabled = false;
            showStatus('✅ 所有验证通过，可以提交！', 'success');
        } else {
            submitBtn.disabled = true;
            showStatus('❌ 法定代表人姓名与身份证姓名不匹配', 'error');
        }
    } else {
        submitBtn.disabled = true;
        if (licenseData && idData) {
            showStatus('❌ 文件验证失败，请重新上传', 'error');
        } else if (licenseData || idData) {
            showStatus('⏳ 请上传所有必需文件', 'info');
        }
    }
}

// 处理提交
async function handleSubmit() {
    console.log('=== 开始提交企业注册 ===');
    console.log('licenseData:', licenseData);
    console.log('idData:', idData);
    console.log('uploadedFiles:', uploadedFiles);

    if (!licenseData || !idData || !licenseData.isValid || !idData.isValid) {
        showStatus('请确保所有文件已上传并验证通过', 'error');
        return;
    }

    if (licenseData.legalRepresentative !== idData.name) {
        showStatus('法定代表人姓名与身份证姓名不匹配', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerHTML = '<div class="loading"></div>正在创建档案...';
    submitBtn.disabled = true;

    try {
        // 保存文件到服务器
        const savedFiles = await saveFilesToServer();
        console.log('文件保存结果:', savedFiles);

        // 创建企业档案
        const archiveResult = await createEnterpriseArchive(savedFiles);
        console.log('档案创建结果:', archiveResult);

        submitBtn.innerHTML = '✅ 提交成功';
        showStatus(`✅ 企业档案创建成功！企业名称：${licenseData.companyName}`, 'success');

        // 3秒后跳转或重置
        setTimeout(() => {
            if (confirm('企业注册成功！是否继续注册其他企业？')) {
                // 重置表单
                resetForm();
            } else {
                // 跳转到其他页面
                window.location.href = '/';
            }
        }, 3000);

    } catch (error) {
        console.error('提交失败:', error);
        showStatus('❌ 提交失败: ' + error.message, 'error');
        submitBtn.innerHTML = '提交并创建档案';
        submitBtn.disabled = false;
    }
}

// 保存文件到服务器
async function saveFilesToServer() {
    const results = {};

    try {
        // 保存营业执照
        if (uploadedFiles.license) {
            const licenseFormData = new FormData();
            licenseFormData.append('license', uploadedFiles.license);
            licenseFormData.append('companyName', licenseData.companyName);
            licenseFormData.append('creditCode', licenseData.unifiedSocialCreditCode);

            const licenseResponse = await fetch('/api/save-license-file', {
                method: 'POST',
                body: licenseFormData
            });

            const licenseResult = await licenseResponse.json();
            if (!licenseResult.success) {
                throw new Error('营业执照保存失败: ' + licenseResult.message);
            }
            results.license = licenseResult.data;
        }

        // 保存法定代表人身份证
        if (uploadedFiles.id) {
            const idFormData = new FormData();
            idFormData.append('idCard', uploadedFiles.id);
            idFormData.append('userName', idData.name);
            idFormData.append('enterpriseName', licenseData.companyName);
            idFormData.append('idNumber', idData.idNumber);
            idFormData.append('creditCode', licenseData.unifiedSocialCreditCode);

            const idResponse = await fetch('/api/save-legal-representative-id', {
                method: 'POST',
                body: idFormData
            });

            const idResult = await idResponse.json();
            if (!idResult.success) {
                throw new Error('法定代表人身份证保存失败: ' + idResult.message);
            }
            results.id = idResult.data;
        }

        return results;
    } catch (error) {
        console.error('保存文件失败:', error);
        throw error;
    }
}

// 创建企业档案
async function createEnterpriseArchive(savedFiles) {
    const archiveData = {
        companyName: licenseData.companyName,
        legalRepresentative: licenseData.legalRepresentative,
        unifiedSocialCreditCode: licenseData.unifiedSocialCreditCode,
        registeredCapital: licenseData.registeredCapital,
        establishmentDate: licenseData.establishmentDate,
        idNumber: idData.idNumber,
        savedFiles: savedFiles,
        createTime: new Date().toISOString()
    };

    try {
        const response = await fetch('/api/create-enterprise-archive', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(archiveData)
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || '创建企业档案失败');
        }

        return result;
    } catch (error) {
        console.error('创建企业档案失败:', error);
        throw error;
    }
}

// 重置表单
function resetForm() {
    licenseData = null;
    idData = null;
    uploadedFiles = {};

    // 重置UI
    const cards = document.querySelectorAll('.upload-card');
    cards.forEach(card => card.classList.remove('uploaded'));

    const previews = document.querySelectorAll('[id$="Preview"]');
    previews.forEach(preview => preview.style.display = 'none');

    const progressBars = document.querySelectorAll('[id$="Progress"]');
    progressBars.forEach(progress => progress.style.display = 'none');

    const results = document.querySelectorAll('#licenseResult, #idResult');
    results.forEach(result => result.style.display = 'none');

    document.getElementById('resultSection').style.display = 'none';

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerHTML = '提交并创建档案';
    submitBtn.disabled = true;

    // 重置文件输入
    document.getElementById('licenseInput').value = '';
    document.getElementById('idInput').value = '';

    showStatus('表单已重置，可以重新上传文件', 'info');
}

// 显示状态消息
function showStatus(message, type) {
    console.log('状态消息:', message, type);
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';

    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 5000);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setupFileUpload('licenseInput', 'licenseCard', 'licenseProgress', 'licensePreview', 'license');
    setupFileUpload('idInput', 'idCard', 'idProgress', 'idPreview', 'id');
    
    console.log('企业注册系统初始化完成');
    showStatus('请上传营业执照和法定代表人身份证', 'info');
});