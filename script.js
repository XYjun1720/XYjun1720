/**
 * GIF精灵图分割生成器 - 主逻辑文件
 * 功能：多文件上传、网格分割、GIF生成、批量下载
 */

// ==================== 应用状态与配置 ====================
const AppState = {
    // 存储所有上传的图片数据
    images: new Map(), // key: id, value: {id, name, file, imgElement, size, selected}
    // 当前选中的图片ID集合
    selectedImageIds: new Set(),
    // 存储生成的GIF结果
    generatedGIFs: new Map(), // key: imageId, value: {blob, url, name, width, height}
    // 默认设置
    settings: {
        cols: 4,
        rows: 4,
        fps: 10,
        quality: 10,
        loop: true,
        transparent: false
    },
    // GIF.js库是否已加载
    gifLibLoaded: false
};

// ==================== DOM元素引用 ====================
let DOM = {};

// ==================== 主初始化函数 ====================
function initApp() {
    console.log('GIF生成器初始化...');
    // 1. 绑定所有DOM元素
    bindDOMElements();
    // 2. 加载必要的库
    loadExternalLibs();
    // 3. 绑定所有事件监听器
    bindEventListeners();
    // 4. 初始化UI状态
    updateUIState();
    // 5. 添加测试提示（上线后可删除）
    addTestHint();
}

// 获取并保存所有需要用到的DOM元素
function bindDOMElements() {
    DOM = {
        // 上传区域
        uploadArea: document.getElementById('uploadArea'),
        fileInput: document.getElementById('fileInput'),
        // 图片列表
        imageListContainer: document.getElementById('imageList'),
        imageCountSpan: document.getElementById('imageCount'),
        // 选择控制按钮
        selectAllBtn: document.getElementById('selectAll'),
        selectNoneBtn: document.getElementById('selectNone'),
        clearAllBtn: document.getElementById('clearAll'),
        // 设置滑块
        colsSlider: document.getElementById('cols'),
        rowsSlider: document.getElementById('rows'),
        fpsSlider: document.getElementById('fps'),
        qualitySlider: document.getElementById('quality'),
        colsValue: document.getElementById('colsValue'),
        rowsValue: document.getElementById('rowsValue'),
        fpsValue: document.getElementById('fpsValue'),
        qualityValue: document.getElementById('qualityValue'),
        // 复选框
        loopCheckbox: document.getElementById('loopAnimation'),
        transparentCheckbox: document.getElementById('transparentBg'),
        // 操作按钮
        generateSelectedBtn: document.getElementById('generateSelected'),
        generateAllBtn: document.getElementById('generateAll'),
        batchDownloadBtn: document.getElementById('batchDownload'),
        // 进度和结果区域
        progressContainer: document.getElementById('progressContainer'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        resultsGrid: document.getElementById('resultsGrid'),
        resultsCount: document.getElementById('resultsCount'),
        // 预览画布
        originalCanvas: document.getElementById('originalCanvas'),
        // 标签页
        tabUpload: document.querySelector('[data-tab="upload"]'),
        tabSettings: document.querySelector('[data-tab="settings"]'),
        tabResults: document.querySelector('[data-tab="results"]')
    };
    console.log('DOM元素绑定完成');
}

// 加载外部库 (GIF.js)
function loadExternalLibs() {
    // 检查是否已加载
    if (window.GIF) {
        AppState.gifLibLoaded = true;
        console.log('GIF.js 已加载');
        return;
    }
    
    console.log('正在加载 GIF.js...');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.min.js';
    script.onload = () => {
        AppState.gifLibLoaded = true;
        console.log('✅ GIF.js 加载成功');
        showNotification('GIF.js库加载完成，可以开始生成动画了！', 'success');
    };
    script.onerror = () => {
        console.error('❌ GIF.js 加载失败');
        showNotification('GIF.js库加载失败，请刷新页面或检查网络', 'error');
    };
    document.head.appendChild(script);
}

// ==================== 事件监听器绑定 ====================
function bindEventListeners() {
    // 1. 文件上传相关事件
    bindFileUploadEvents();
    
    // 2. 图片选择控制事件
    bindSelectionEvents();
    
    // 3. 设置滑块和复选框事件
    bindSettingsEvents();
    
    // 4. 生成和下载按钮事件
    bindActionEvents();
    
    // 5. 标签页切换事件
    bindTabEvents();
    
    console.log('所有事件监听器绑定完成');
}

function bindFileUploadEvents() {
    // 点击上传区域触发文件选择
    if (DOM.uploadArea) {
        DOM.uploadArea.addEventListener('click', () => DOM.fileInput.click());
    }
    
    // 文件选择变化事件
    if (DOM.fileInput) {
        DOM.fileInput.addEventListener('change', handleFileSelect);
    }
    
    // 拖放事件
    if (DOM.uploadArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            DOM.uploadArea.addEventListener(eventName, preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            DOM.uploadArea.addEventListener(eventName, highlightDropArea, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            DOM.uploadArea.addEventListener(eventName, unhighlightDropArea, false);
        });
        
        DOM.uploadArea.addEventListener('drop', handleFileDrop, false);
    }
}

function bindSelectionEvents() {
    if (DOM.selectAllBtn) {
        DOM.selectAllBtn.addEventListener('click', () => selectAllImages(true));
    }
    if (DOM.selectNoneBtn) {
        DOM.selectNoneBtn.addEventListener('click', () => selectAllImages(false));
    }
    if (DOM.clearAllBtn) {
        DOM.clearAllBtn.addEventListener('click', clearAllImages);
    }
}

function bindSettingsEvents() {
    // 绑定滑块值变化事件
    const sliders = [
        {slider: DOM.colsSlider, value: DOM.colsValue, settingKey: 'cols', min: 1, max: 12},
        {slider: DOM.rowsSlider, value: DOM.rowsValue, settingKey: 'rows', min: 1, max: 12},
        {slider: DOM.fpsSlider, value: DOM.fpsValue, settingKey: 'fps', min: 1, max: 30},
        {slider: DOM.qualitySlider, value: DOM.qualityValue, settingKey: 'quality', min: 1, max: 20}
    ];
    
    sliders.forEach(({slider, value, settingKey, min, max}) => {
        if (slider && value) {
            // 初始化显示
            value.textContent = AppState.settings[settingKey];
            slider.value = AppState.settings[settingKey];
            slider.min = min;
            slider.max = max;
            
            // 监听变化
            slider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                AppState.settings[settingKey] = val;
                value.textContent = val;
                // 如果选择了图片，更新预览
                if (AppState.selectedImageIds.size > 0) {
                    const firstId = Array.from(AppState.selectedImageIds)[0];
                    const imgData = AppState.images.get(firstId);
                    if (imgData) {
                        drawGridPreview(imgData.imgElement);
                    }
                }
            });
        }
    });
    
    // 复选框事件
    if (DOM.loopCheckbox) {
        DOM.loopCheckbox.checked = AppState.settings.loop;
        DOM.loopCheckbox.addEventListener('change', (e) => {
            AppState.settings.loop = e.target.checked;
        });
    }
    
    if (DOM.transparentCheckbox) {
        DOM.transparentCheckbox.checked = AppState.settings.transparent;
        DOM.transparentCheckbox.addEventListener('change', (e) => {
            AppState.settings.transparent = e.target.checked;
        });
    }
}

function bindActionEvents() {
    if (DOM.generateSelectedBtn) {
        DOM.generateSelectedBtn.addEventListener('click', generateSelectedGIFs);
    }
    if (DOM.generateAllBtn) {
        DOM.generateAllBtn.addEventListener('click', generateAllGIFs);
    }
    if (DOM.batchDownloadBtn) {
        DOM.batchDownloadBtn.addEventListener('click', batchDownloadGIFs);
    }
}

function bindTabEvents() {
    const tabs = [DOM.tabUpload, DOM.tabSettings, DOM.tabResults].filter(Boolean);
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

// ==================== 文件处理函数 ====================
function handleFileSelect(event) {
    const files = event.target.files;
    processFiles(files);
    // 清空input，允许重复选择相同文件
    event.target.value = '';
}

function handleFileDrop(event) {
    const dt = event.dataTransfer;
    const files = dt.files;
    processFiles(files);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlightDropArea() {
    if (DOM.uploadArea) DOM.uploadArea.classList.add('drag-over');
}

function unhighlightDropArea() {
    if (DOM.uploadArea) DOM.uploadArea.classList.remove('drag-over');
}

async function processFiles(fileList) {
    const files = Array.from(fileList).filter(file => 
        file.type.startsWith('image/') && 
        ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(file.type)
    );
    
    if (files.length === 0) {
        showNotification('请选择有效的图片文件（PNG、JPG、WebP）', 'warning');
        return;
    }
    
    showNotification(`正在加载 ${files.length} 张图片...`, 'info');
    
    for (const file of files) {
        try {
            const imageData = await loadImageFile(file);
            const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            AppState.images.set(id, {
                id,
                name: file.name,
                file,
                imgElement: imageData.img,
                size: formatFileSize(file.size),
                selected: true
            });
            
            AppState.selectedImageIds.add(id);
            
        } catch (error) {
            console.error(`加载图片失败 ${file.name}:`, error);
            showNotification(`图片 "${file.name}" 加载失败`, 'error');
        }
    }
    
    updateImageList();
    showNotification(`成功加载 ${files.length} 张图片`, 'success');
    // 切换到上传标签页
    switchTab('upload');
}

function loadImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve({img, file});
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}

// ==================== 图片列表管理 ====================
function updateImageList() {
    if (!DOM.imageListContainer) return;
    
    const imageCount = AppState.images.size;
    if (DOM.imageCountSpan) {
        DOM.imageCountSpan.textContent = imageCount;
    }
    
    if (imageCount === 0) {
        DOM.imageListContainer.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-images"></i>
                <p>尚未上传任何图片</p>
                <p class="hint">点击上方区域或拖放图片到此处</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    AppState.images.forEach((imgData, id) => {
        const isSelected = AppState.selectedImageIds.has(id);
        html += `
            <div class="image-item ${isSelected ? 'selected' : ''}" data-id="${id}">
                <img src="${imgData.imgElement.src}" class="image-preview" alt="${imgData.name}">
                <div class="image-info">
                    <div class="image-name">${imgData.name}</div>
                    <div class="image-size">${imgData.size}</div>
                </div>
                <div class="image-checkbox">
                    <input type="checkbox" ${isSelected ? 'checked' : ''}>
                </div>
            </div>
        `;
    });
    
    DOM.imageListContainer.innerHTML = html;
    
    // 为每个图片项添加点击事件
    DOM.imageListContainer.querySelectorAll('.image-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const id = item.dataset.id;
            const checkbox = item.querySelector('input[type="checkbox"]');
            
            // 如果点击的是复选框，不切换选中状态（由复选框自己处理）
            if (e.target.tagName === 'INPUT') {
                return;
            }
            
            // 切换选中状态
            if (AppState.selectedImageIds.has(id)) {
                AppState.selectedImageIds.delete(id);
                if (checkbox) checkbox.checked = false;
            } else {
                AppState.selectedImageIds.add(id);
                if (checkbox) checkbox.checked = true;
            }
            
            item.classList.toggle('selected');
            updateUIState();
            
            // 如果选中了这张图片，显示预览
            if (AppState.selectedImageIds.has(id)) {
                const imgData = AppState.images.get(id);
                if (imgData && DOM.originalCanvas) {
                    drawGridPreview(imgData.imgElement);
                }
            }
        });
        
        // 复选框点击事件
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止触发父元素的点击事件
                const id = item.dataset.id;
                
                if (checkbox.checked) {
                    AppState.selectedImageIds.add(id);
                } else {
                    AppState.selectedImageIds.delete(id);
                }
                
                item.classList.toggle('selected', checkbox.checked);
                updateUIState();
            });
        }
    });
}

function selectAllImages(select = true) {
    if (select) {
        AppState.selectedImageIds = new Set(AppState.images.keys());
    } else {
        AppState.selectedImageIds.clear();
    }
    updateImageList();
    updateUIState();
    showNotification(select ? '已全选所有图片' : '已取消全选', 'info');
}

function clearAllImages() {
    if (AppState.images.size === 0) return;
    
    if (confirm(`确定要清空所有 ${AppState.images.size} 张图片吗？`)) {
        AppState.images.clear();
        AppState.selectedImageIds.clear();
        AppState.generatedGIFs.clear();
        updateImageList();
        updateUIState();
        clearResults();
        showNotification('已清空所有图片', 'success');
    }
}

// ==================== GIF生成核心函数 ====================
async function generateSelectedGIFs() {
    if (AppState.selectedImageIds.size === 0) {
        showNotification('请先选择要生成的图片', 'warning');
        return;
    }
    
    if (!AppState.gifLibLoaded) {
        showNotification('GIF.js库尚未加载完成，请稍后再试', 'error');
        return;
    }
    
    await generateGIFsForIds(Array.from(AppState.selectedImageIds));
}

async function generateAllGIFs() {
    if (AppState.images.size === 0) {
        showNotification('请先上传图片', 'warning');
        return;
    }
    
    if (!AppState.gifLibLoaded) {
        showNotification('GIF.js库尚未加载完成，请稍后再试', 'error');
        return;
    }
    
    await generateGIFsForIds(Array.from(AppState.images.keys()));
}

async function generateGIFsForIds(imageIds) {
    showProgress(true);
    
    const total = imageIds.length;
    let completed = 0;
    
    // 清空之前的结果
    AppState.generatedGIFs.clear();
    clearResults();
    
    for (const id of imageIds) {
        const imageData = AppState.images.get(id);
        if (!imageData) continue;
        
        try {
            updateProgress(completed, total, `正在处理: ${imageData.name}`);
            
            const gifData = await generateSingleGIF(imageData.imgElement, imageData.name);
            
            // 保存结果
            AppState.generatedGIFs.set(id, {
                ...gifData,
                originalName: imageData.name
            });
            
            completed++;
            updateProgress(completed, total, `处理完成: ${imageData.name}`);
            
            // 更新结果列表（每完成一个就更新一次）
            updateResultsList();
            
        } catch (error) {
            console.error(`生成GIF失败 ${imageData.name}:`, error);
            showNotification(`"${imageData.name}" 生成失败: ${error.message}`, 'error');
        }
    }
    
    showProgress(false);
    
    if (AppState.generatedGIFs.size > 0) {
        showNotification(`成功生成 ${AppState.generatedGIFs.size} 个GIF文件`, 'success');
        // 切换到结果标签页
        switchTab('results');
    } else {
        showNotification('未能成功生成任何GIF文件', 'warning');
    }
}

function generateSingleGIF(image, originalName) {
    return new Promise((resolve, reject) => {
        if (!window.GIF) {
            reject(new Error('GIF.js库未加载'));
            return;
        }
        
        const settings = AppState.settings;
        const cols = settings.cols;
        const rows = settings.rows;
        const frameWidth = Math.floor(image.width / cols);
        const frameHeight = Math.floor(image.height / rows);
        const delay = Math.floor(1000 / settings.fps);
        const repeat = settings.loop ? 0 : 1;
        
        // 创建GIF实例
        const gif = new GIF({
            workers: 2,
            quality: settings.quality,
            width: frameWidth,
            height: frameHeight,
            workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js',
            background: settings.transparent ? '#00000000' : '#ffffff',
            repeat: repeat
        });
        
        // 创建临时画布用于提取每一帧
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = frameWidth;
        tempCanvas.height = frameHeight;
        const ctx = tempCanvas.getContext('2d');
        
        // 提取每一帧并添加到GIF
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // 清空画布
                if (settings.transparent) {
                    ctx.clearRect(0, 0, frameWidth, frameHeight);
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, frameWidth, frameHeight);
                }
                
                // 绘制当前帧
                ctx.drawImage(
                    image,
                    col * frameWidth,
                    row * frameHeight,
                    frameWidth,
                    frameHeight,
                    0, 0,
                    frameWidth,
                    frameHeight
                );
                
                // 添加到GIF
                gif.addFrame(ctx, { delay: delay });
            }
        }
        
        // GIF渲染完成
        gif.on('finished', (blob) => {
            const url = URL.createObjectURL(blob);
            const gifName = originalName.replace(/\.[^/.]+$/, '') + '.gif';
            
            resolve({
                blob,
                url,
                name: gifName,
                width: frameWidth,
                height: frameHeight,
                frames: cols * rows
            });
        });
        
        // 错误处理
        gif.on('error', (error) => {
            reject(new Error(`GIF编码失败: ${error}`));
        });
        
        // 开始渲染
        gif.render();
    });
}

// ==================== 结果与下载功能 ====================
function updateResultsList() {
    if (!DOM.resultsGrid) return;
    
    const gifCount = AppState.generatedGIFs.size;
    if (DOM.resultsCount) {
        DOM.resultsCount.textContent = `${gifCount}个GIF`;
    }
    
    if (gifCount === 0) {
        DOM.resultsGrid.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-film"></i>
                <p>生成的GIF将显示在这里</p>
            </div>
        `;
        updateBatchDownloadButton();
        return;
    }
    
    let html = '';
    AppState.generatedGIFs.forEach((gifData, id) => {
        html += `
            <div class="result-item" data-id="${id}">
                <img src="${gifData.url}" class="result-preview" alt="${gifData.name}" loading="lazy">
                <div class="result-info">
                    <div class="result-name">${gifData.name}</div>
                    <div class="result-details">${gifData.width}×${gifData.height} | ${gifData.frames}帧</div>
                </div>
                <div class="result-actions">
                    <button class="result-btn download-btn" title="下载" data-id="${id}">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="result-btn copy-btn" title="复制链接" data-id="${id}">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    DOM.resultsGrid.innerHTML = html;
    
    // 绑定结果项按钮事件
    DOM.resultsGrid.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            downloadSingleGIF(id);
        });
    });
    
    DOM.resultsGrid.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.closest('button').dataset.id;
            await copyGIFLink(id);
        });
    });
    
    updateBatchDownloadButton();
}

function downloadSingleGIF(imageId) {
    const gifData = AppState.generatedGIFs.get(imageId);
    if (!gifData) return;
    
    const link = document.createElement('a');
    link.href = gifData.url;
    link.download = gifData.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`已开始下载: ${gifData.name}`, 'success');
}

async function copyGIFLink(imageId) {
    const gifData = AppState.generatedGIFs.get(imageId);
    if (!gifData) return;
    
    try {
        await navigator.clipboard.writeText(gifData.url);
        showNotification('GIF链接已复制到剪贴板', 'success');
    } catch (err) {
        console.error('复制失败:', err);
        // 降级方案
        const textarea = document.createElement('textarea');
        textarea.value = gifData.url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('GIF链接已复制', 'success');
    }
}

function batchDownloadGIFs() {
    if (AppState.generatedGIFs.size === 0) {
        showNotification('没有可下载的GIF文件', 'warning');
        return;
    }
    
    showNotification(`开始批量下载 ${AppState.generatedGIFs.size} 个文件...`, 'info');
    
    let index = 0;
    AppState.generatedGIFs.forEach((gifData, id) => {
        setTimeout(() => {
            downloadSingleGIF(id);
        }, index * 300); // 间隔300ms，避免浏览器阻塞
        index++;
    });
}

function updateBatchDownloadButton() {
    if (!DOM.batchDownloadBtn) return;
    
    const hasResults = AppState.generatedGIFs.size > 0;
    DOM.batchDownloadBtn.disabled = !hasResults;
    
    if (hasResults) {
        DOM.batchDownloadBtn.innerHTML = `<i class="fas fa-download"></i> 批量下载 (${AppState.generatedGIFs.size}个)`;
    } else {
        DOM.batchDownloadBtn.innerHTML = `<i class="fas fa-download"></i> 批量下载`;
    }
}

function clearResults() {
    if (DOM.resultsGrid) {
        DOM.resultsGrid.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-film"></i>
                <p>生成的GIF将显示在这里</p>
            </div>
        `;
    }
    if (DOM.resultsCount) {
        DOM.resultsCount.textContent = '0个GIF';
    }
    updateBatchDownloadButton();
}

// ==================== 预览功能 ====================
function drawGridPreview(image) {
    if (!DOM.originalCanvas || !image) return;
    
    const canvas = DOM.originalCanvas;
    const ctx = canvas.getContext('2d');
    const cols = AppState.settings.cols;
    const rows = AppState.settings.rows;
    
    // 设置画布尺寸为图片尺寸（或按比例缩放）
    const maxWidth = 400;
    const scale = Math.min(maxWidth / image.width, 1);
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    
    // 绘制完整图片
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    // 绘制网格线
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    
    // 垂直线
    for (let i = 1; i < cols; i++) {
        const x = (canvas.width / cols) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    // 水平线
    for (let i = 1; i < rows; i++) {
        const y = (canvas.height / rows) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    // 添加网格信息文本
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${cols}×${rows} 网格`, 10, 25);
}

// ==================== UI辅助函数 ====================
function updateUIState() {
    const hasImages = AppState.images.size > 0;
    const hasSelected = AppState.selectedImageIds.size > 0;
    
    // 更新按钮状态
    if (DOM.generateSelectedBtn) {
        DOM.generateSelectedBtn.disabled = !hasSelected;
    }
    if (DOM.generateAllBtn) {
        DOM.generateAllBtn.disabled = !hasImages;
    }
    if (DOM.clearAllBtn) {
        DOM.clearAllBtn.disabled = !hasImages;
    }
}

function showProgress(show) {
    if (!DOM.progressContainer) return;
    
    if (show) {
        DOM.progressContainer.style.display = 'block';
    } else {
        DOM.progressContainer.style.display = 'none';
        // 重置进度条
        if (DOM.progressFill) DOM.progressFill.style.width = '0%';
        if (DOM.progressText) DOM.progressText.textContent = '准备生成...';
    }
}

function updateProgress(current, total, message) {
    if (!DOM.progressContainer || !DOM.progressFill || !DOM.progressText) return;
    
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    DOM.progressFill.style.width = `${percent}%`;
    DOM.progressText.textContent = message || `处理中... ${current}/${total} (${percent}%)`;
}

function switchTab(tabName) {
    // 更新标签页按钮状态
    [DOM.tabUpload, DOM.tabSettings, DOM.tabResults].forEach(tab => {
        if (tab) {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        }
    });
    
    // 显示对应的内容区域
    const tabContents = ['upload-tab', 'settings-tab', 'results-tab'];
    tabContents.forEach(contentId => {
        const element = document.getElementById(contentId);
        if (element) {
            element.classList.toggle('active', contentId === `${tabName}-tab`);
        }
    });
}

function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    // 根据类型设置样式
    const colors = {
        info: '#3498db',
        success: '#2ecc71',
        warning: '#f39c12',
        error: '#e74c3c'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        font-size: 14px;
    `;
    
    // 添加图标
    const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    
    notification.textContent = `${icons[type] || ''} ${message}`;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
    
    // 点击快速关闭
    notification.addEventListener('click', () => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
}

// ==================== 工具函数 ====================
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function addTestHint() {
    // 添加一个简单的测试提示，上线后可删除
    setTimeout(() => {
        if (AppState.images.size === 0) {
            console.log('提示：可以拖放图片到上传区域进行测试');
        }
    }, 2000);
}

// ==================== 页面加载完成后初始化 ====================
// 等待页面完全加载后初始化应用
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOMContentLoaded 已经触发
    initApp();
}
