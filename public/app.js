// 获取房间ID或生成新的
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || generateRoomId();

// 更新URL而不刷新页面
if (!urlParams.get('room')) {
    window.history.pushState({}, '', `?room=${roomId}`);
}

// 显示房间ID
document.getElementById('room-id').textContent = `房间: ${roomId}`;

// 初始化Socket.IO
const socket = io();

// 加入房间
socket.emit('join-room', roomId);

// 当前模式
let currentMode = 'canvas'; // 'canvas' 或 'markdown'

// Canvas设置
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');

// 设置canvas大小
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth - 60;
    canvas.height = window.innerHeight - 250;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// 绘画状态
let isDrawing = false;
let currentTool = 'pen';
let currentColor = '#000000';
let currentSize = 3;
let startX, startY;

// 用户信息
let isRoomCreator = false;
let currentUserId = null;
let markdownOwnership = []; // 存储文档所有权信息

// 工具按钮
const tools = {
    pen: document.getElementById('pen-tool'),
    eraser: document.getElementById('eraser-tool'),
    line: document.getElementById('line-tool'),
    rect: document.getElementById('rect-tool'),
    circle: document.getElementById('circle-tool')
};

// 设置工具
Object.keys(tools).forEach(tool => {
    tools[tool].addEventListener('click', () => {
        currentTool = tool;
        Object.values(tools).forEach(btn => btn.classList.remove('active'));
        tools[tool].classList.add('active');
    });
});

// 颜色选择器
const colorPicker = document.getElementById('color-picker');
colorPicker.addEventListener('change', (e) => {
    currentColor = e.target.value;
});

// 画笔大小
const brushSize = document.getElementById('brush-size');
const sizeDisplay = document.getElementById('size-display');
brushSize.addEventListener('input', (e) => {
    currentSize = parseInt(e.target.value);
    sizeDisplay.textContent = currentSize;
});

// 鼠标事件
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// 触摸事件支持
canvas.addEventListener('touchstart', handleTouch);
canvas.addEventListener('touchmove', handleTouch);
canvas.addEventListener('touchend', stopDrawing);

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    if (currentTool === 'pen' || currentTool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
    }
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const drawData = {
        tool: currentTool,
        color: currentTool === 'eraser' ? '#FFFFFF' : currentColor,
        size: currentSize,
        startX,
        startY,
        endX: x,
        endY: y
    };
    
    if (currentTool === 'pen' || currentTool === 'eraser') {
        drawLine(drawData);
        socket.emit('draw', { roomId, drawData });
        startX = x;
        startY = y;
    }
}

function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    
    if (currentTool !== 'pen' && currentTool !== 'eraser') {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const drawData = {
            tool: currentTool,
            color: currentColor,
            size: currentSize,
            startX,
            startY,
            endX: x,
            endY: y
        };
        
        drawShape(drawData);
        socket.emit('draw', { roomId, drawData });
    }
}

function drawLine(data) {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.lineTo(data.endX, data.endY);
    ctx.stroke();
}

function drawShape(data) {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    
    switch(data.tool) {
        case 'line':
            ctx.moveTo(data.startX, data.startY);
            ctx.lineTo(data.endX, data.endY);
            break;
        case 'rect':
            ctx.rect(data.startX, data.startY, data.endX - data.startX, data.endY - data.startY);
            break;
        case 'circle':
            const radius = Math.sqrt(Math.pow(data.endX - data.startX, 2) + Math.pow(data.endY - data.startY, 2));
            ctx.arc(data.startX, data.startY, radius, 0, 2 * Math.PI);
            break;
    }
    
    ctx.stroke();
}

// Socket事件处理
socket.on('canvas-data', (data) => {
    data.forEach(drawData => {
        if (drawData.tool === 'pen' || drawData.tool === 'eraser') {
            ctx.beginPath();
            ctx.moveTo(drawData.startX, drawData.startY);
            drawLine(drawData);
        } else {
            drawShape(drawData);
        }
    });
});

socket.on('draw', (drawData) => {
    if (drawData.tool === 'pen' || drawData.tool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(drawData.startX, drawData.startY);
        drawLine(drawData);
    } else {
        drawShape(drawData);
    }
});

socket.on('user-joined', () => {
    // 由服务器统一处理在线人数
});

// 接收在线人数更新
socket.on('user-count-update', (count) => {
    document.getElementById('user-count').textContent = `👥 ${count}`;
});

// 接收Markdown更新
socket.on('markdown-data', (data) => {
    isUpdatingMarkdown = true;
    markdownEditor.value = data.content;
    markdownOwnership = data.ownership || [];
    isRoomCreator = data.isCreator;
    currentUserId = data.userId;
    updatePreview();
    updateEditorReadonly();
    isUpdatingMarkdown = false;
});

socket.on('markdown-update', (data) => {
    isUpdatingMarkdown = true;
    markdownEditor.value = data.content;
    markdownOwnership = data.ownership || [];
    updatePreview();
    updateEditorReadonly();
    isUpdatingMarkdown = false;
});

// ==================== 模式切换 ====================
const canvasModeBtn = document.getElementById('canvas-mode-btn');
const markdownModeBtn = document.getElementById('markdown-mode-btn');
const canvasToolbar = document.getElementById('canvas-toolbar');
const markdownToolbar = document.getElementById('markdown-toolbar');
const markdownContainer = document.getElementById('markdown-container');

canvasModeBtn.addEventListener('click', () => {
    currentMode = 'canvas';
    canvasModeBtn.classList.add('active');
    markdownModeBtn.classList.remove('active');
    canvasToolbar.style.display = 'flex';
    markdownToolbar.style.display = 'none';
    canvas.style.display = 'block';
    markdownContainer.style.display = 'none';
    resizeCanvas();
});

markdownModeBtn.addEventListener('click', () => {
    currentMode = 'markdown';
    markdownModeBtn.classList.add('active');
    canvasModeBtn.classList.remove('active');
    markdownToolbar.style.display = 'flex';
    canvasToolbar.style.display = 'none';
    canvas.style.display = 'none';
    markdownContainer.style.display = 'block';
});

// ==================== Markdown编辑器 ====================
const markdownEditor = document.getElementById('markdown-editor');
const markdownPreview = document.getElementById('markdown-preview');

// 配置marked
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: true,
    mangle: false
});

let isUpdatingMarkdown = false;

// 更新预览
function updatePreview() {
    const content = markdownEditor.value;
    const html = marked.parse(content);
    markdownPreview.innerHTML = DOMPurify.sanitize(html);
}

// 更新编辑器权限（处理删除限制）
function updateEditorReadonly() {
    // 房间创建者可以编辑所有内容，不需要额外处理
    // 普通用户通过beforeinput事件进行权限检查
}

// 监听编辑器输入
markdownEditor.addEventListener('input', (e) => {
    if (!isUpdatingMarkdown) {
        const content = markdownEditor.value;
        updateOwnership(content);
        updatePreview();
        socket.emit('markdown-update', { roomId, content, ownership: markdownOwnership });
    }
});

// 监听删除和退格操作
markdownEditor.addEventListener('beforeinput', (e) => {
    // 房间创建者可以编辑所有内容
    if (isRoomCreator) {
        return;
    }
    
    // 检查是否是删除操作
    if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward' || 
        e.inputType === 'deleteByCut' || e.inputType === 'deleteByDrag' ||
        e.inputType === 'deleteContent' || e.inputType === 'deleteWordBackward' || 
        e.inputType === 'deleteWordForward') {
        
        const start = markdownEditor.selectionStart;
        const end = markdownEditor.selectionEnd;
        
        // 检查删除范围内是否包含其他人的内容
        const canDelete = checkDeletePermission(start, end);
        
        if (!canDelete) {
            e.preventDefault();
            alert('您只能删除自己输入的内容！');
            return;
        }
    }
});

// 检查删除权限
function checkDeletePermission(start, end) {
    // 如果是房间创建者，允许所有操作
    if (isRoomCreator) {
        return true;
    }
    
    // 检查选中范围是否包含其他人的内容
    for (const block of markdownOwnership) {
        // 如果内容块属于房间创建者或当前用户，可以删除
        if (block.owner === currentUserId || block.owner === getRoomCreatorId()) {
            continue;
        }
        
        // 检查是否有重叠
        if (!(end <= block.start || start >= block.end)) {
            return false; // 有其他用户的内容，不允许删除
        }
    }
    
    return true;
}

// 获取房间创建者ID
function getRoomCreatorId() {
    // 查找所有权列表中的创建者ID（第一次加入的用户）
    if (markdownOwnership.length > 0) {
        return markdownOwnership[0].owner;
    }
    return null;
}

// 更新所有权信息
function updateOwnership(newContent) {
    const oldContent = getOldContent();
    const oldLen = oldContent.length;
    const newLen = newContent.length;
    
    // 找出变化的位置
    let changeStart = 0;
    while (changeStart < oldLen && changeStart < newLen && 
           oldContent[changeStart] === newContent[changeStart]) {
        changeStart++;
    }
    
    let oldEnd = oldLen;
    let newEnd = newLen;
    while (oldEnd > changeStart && newEnd > changeStart && 
           oldContent[oldEnd - 1] === newContent[newEnd - 1]) {
        oldEnd--;
        newEnd--;
    }
    
    // 计算变化量
    const deletedLength = oldEnd - changeStart;
    const insertedLength = newEnd - changeStart;
    const delta = insertedLength - deletedLength;
    
    // 如果有插入内容
    if (insertedLength > 0) {
        // 添加新的所有权块
        markdownOwnership.push({
            start: changeStart,
            end: newEnd,
            owner: currentUserId
        });
        
        // 合并相邻的同属主块
        markdownOwnership = mergeOwnership(markdownOwnership);
    }
    
    // 更新后续块的位置
    markdownOwnership = markdownOwnership.map(block => {
        if (block.end <= changeStart) {
            // 变化前的块，不变
            return block;
        } else if (block.start >= oldEnd) {
            // 变化后的块，调整位置
            return {
                ...block,
                start: block.start + delta,
                end: block.end + delta
            };
        } else {
            // 重叠的块，需要调整
            if (block.start < changeStart && block.end > oldEnd) {
                // 块包含变化区域
                return {
                    ...block,
                    end: block.end + delta
                };
            } else if (block.start >= changeStart && block.end <= oldEnd) {
                // 块完全在变化区域内，被删除
                return null;
            } else if (block.start < changeStart) {
                // 块开始在变化前，结束在变化区域内
                return {
                    ...block,
                    end: changeStart
                };
            } else {
                // 块开始在变化区域内，结束在变化后
                return {
                    ...block,
                    start: newEnd,
                    end: block.end + delta
                };
            }
        }
    }).filter(block => block !== null && block.start < block.end);
}

// 获取当前编辑器内容
function getOldContent() {
    // 通过所有权重建内容（简化版：直接使用当前值）
    return markdownEditor.value;
}

// 合并相邻的同属主所有权块
function mergeOwnership(ownership) {
    if (ownership.length <= 1) return ownership;
    
    // 按起始位置排序
    ownership.sort((a, b) => a.start - b.start);
    
    const merged = [ownership[0]];
    
    for (let i = 1; i < ownership.length; i++) {
        const current = ownership[i];
        const last = merged[merged.length - 1];
        
        // 如果是同一个所有者且相邻或重叠，合并
        if (current.owner === last.owner && current.start <= last.end) {
            last.end = Math.max(last.end, current.end);
        } else {
            merged.push(current);
        }
    }
    
    return merged;
}

// Markdown工具按钮
const mdButtons = document.querySelectorAll('.md-btn');
mdButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        insertMarkdown(action);
    });
});

// ==================== 全屏切换功能 ====================
const editorPane = document.getElementById('editor-pane');
const previewPane = document.getElementById('preview-pane');
const editorFullscreenBtn = document.getElementById('editor-fullscreen-btn');
const previewFullscreenBtn = document.getElementById('preview-fullscreen-btn');
const splitViewBtn = document.getElementById('split-view-btn');

let currentView = 'split'; // 'split', 'editor-fullscreen', 'preview-fullscreen'

// 编辑区全屏
if (editorFullscreenBtn) {
    editorFullscreenBtn.addEventListener('click', () => {
        currentView = 'editor-fullscreen';
        editorPane.classList.add('fullscreen');
        editorPane.classList.remove('hidden');
        previewPane.classList.add('hidden');
        previewPane.classList.remove('fullscreen');
        
        // 切换按钮显示
        editorFullscreenBtn.style.display = 'none';
        previewFullscreenBtn.style.display = 'none';
        splitViewBtn.style.display = 'inline-block';
    });
}

// 预览区全屏
if (previewFullscreenBtn) {
    previewFullscreenBtn.addEventListener('click', () => {
        currentView = 'preview-fullscreen';
        previewPane.classList.add('fullscreen');
        previewPane.classList.remove('hidden');
        editorPane.classList.add('hidden');
        editorPane.classList.remove('fullscreen');
        
        // 切换按钮显示
        editorFullscreenBtn.style.display = 'none';
        previewFullscreenBtn.style.display = 'none';
        splitViewBtn.style.display = 'inline-block';
    });
}

// 恢复分屏
if (splitViewBtn) {
    splitViewBtn.addEventListener('click', () => {
        currentView = 'split';
        editorPane.classList.remove('fullscreen', 'hidden');
        previewPane.classList.remove('fullscreen', 'hidden');
        
        // 切换按钮显示
        editorFullscreenBtn.style.display = 'inline-block';
        previewFullscreenBtn.style.display = 'inline-block';
        splitViewBtn.style.display = 'none';
    });
}

function insertMarkdown(action) {
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const selectedText = markdownEditor.value.substring(start, end);
    let replacement = '';
    let cursorOffset = 0;
    
    switch(action) {
        case 'bold':
            replacement = `**${selectedText || '粗体文本'}**`;
            cursorOffset = selectedText ? 0 : -2;
            break;
        case 'italic':
            replacement = `*${selectedText || '斜体文本'}*`;
            cursorOffset = selectedText ? 0 : -1;
            break;
        case 'heading':
            replacement = `# ${selectedText || '标题'}`;
            cursorOffset = selectedText ? 0 : 0;
            break;
        case 'quote':
            replacement = `> ${selectedText || '引用文本'}`;
            cursorOffset = selectedText ? 0 : 0;
            break;
        case 'code':
            replacement = `\`\`\`\n${selectedText || '代码'}\n\`\`\``;
            cursorOffset = selectedText ? 0 : -4;
            break;
        case 'link':
            replacement = `[${selectedText || '链接文本'}](url)`;
            cursorOffset = -1;
            break;
        case 'list':
            replacement = `- ${selectedText || '列表项'}`;
            cursorOffset = selectedText ? 0 : 0;
            break;
        case 'table':
            replacement = `| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 数据 | 数据 | 数据 |`;
            cursorOffset = 0;
            break;
    }
    
    markdownEditor.value = markdownEditor.value.substring(0, start) + replacement + markdownEditor.value.substring(end);
    markdownEditor.focus();
    markdownEditor.selectionStart = markdownEditor.selectionEnd = start + replacement.length + cursorOffset;
    
    const content = markdownEditor.value;
    updateOwnership(content);
    updatePreview();
    socket.emit('markdown-update', { roomId, content, ownership: markdownOwnership });
}
}

// ==================== 文档保存和加载 ====================
// 加载文档功能
const loadMarkdownBtn = document.getElementById('load-markdown-btn');
const markdownFileInput = document.getElementById('markdown-file-input');

if (loadMarkdownBtn && markdownFileInput) {
    loadMarkdownBtn.addEventListener('click', () => {
        markdownFileInput.click();
    });
    
    markdownFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // 检查文件类型
        if (!file.name.match(/\.(md|markdown|txt)$/i)) {
            alert('请选择 Markdown 文件（.md, .markdown, .txt）');
            return;
        }
        
        // 检查文件大小（限制10MB）
        if (file.size > 10 * 1024 * 1024) {
            alert('文件太大，请选择小于 10MB 的文件');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            markdownEditor.value = content;
            
            // 加载文档后，将所有内容标记为房间创建者所有
            // 通过服务器处理以确保正确的所有权
            socket.emit('markdown-loaded', { roomId, content });
            
            updatePreview();
            alert('文档加载成功！所有内容已标记为创建者输入。');
        };
        reader.onerror = () => {
            alert('文件读取失败，请重试');
        };
        reader.readAsText(file, 'UTF-8');
        
        // 清空input，允许重复加载同一文件
        e.target.value = '';
    });
}

// 保存文档为 Markdown 文件
const saveMarkdownBtn = document.getElementById('save-markdown-btn');
if (saveMarkdownBtn) {
    saveMarkdownBtn.addEventListener('click', () => {
        const content = markdownEditor.value;
        if (!content.trim()) {
            alert('文档内容为空，无需保存');
            return;
        }
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `Li-Whiteboard-Doc-${timestamp}.md`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    });
}

// ==================== 画布保存和加载 ====================
// 加载画板功能
const loadCanvasBtn = document.getElementById('load-canvas-btn');
const canvasFileInput = document.getElementById('canvas-file-input');

if (loadCanvasBtn && canvasFileInput) {
    loadCanvasBtn.addEventListener('click', () => {
        canvasFileInput.click();
    });
    
    canvasFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // 检查文件类型
        if (!file.type.match(/^image\//)) {
            alert('请选择图片文件');
            return;
        }
        
        // 检查文件大小（限制10MB）
        if (file.size > 10 * 1024 * 1024) {
            alert('图片太大，请选择小于 10MB 的图片');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // 清空画布
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // 计算缩放比例以适应画布
                const scale = Math.min(
                    canvas.width / img.width,
                    canvas.height / img.height
                );
                
                // 计算居中位置
                const x = (canvas.width - img.width * scale) / 2;
                const y = (canvas.height - img.height * scale) / 2;
                
                // 绘制图片
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                
                alert('图片加载成功！\n提示：加载的图片仅在本地显示，不会同步给其他用户。');
            };
            img.onerror = () => {
                alert('图片加载失败，请确保文件格式正确');
            };
            img.src = event.target.result;
        };
        reader.onerror = () => {
            alert('文件读取失败，请重试');
        };
        reader.readAsDataURL(file);
        
        // 清空input，允许重复加载同一文件
        e.target.value = '';
    });
}

// 保存画布为 PNG 图片
const saveCanvasBtn = document.getElementById('save-canvas-btn');
if (saveCanvasBtn) {
    saveCanvasBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `Li-Whiteboard-Canvas-${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

// 显示二维码
const qrModal = document.getElementById('qr-modal');
const qrBtn = document.getElementById('qr-btn');
const closeBtn = document.querySelector('.close');

qrBtn.addEventListener('click', async () => {
    try {
        const response = await fetch(`/api/qrcode/${roomId}`);
        const data = await response.json();
        
        document.getElementById('qr-code').innerHTML = `<img src="${data.qrCode}" alt="二维码">`;
        document.getElementById('share-url').textContent = data.url;
        qrModal.style.display = 'block';
    } catch (error) {
        alert('生成二维码失败');
    }
});

closeBtn.addEventListener('click', () => {
    qrModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === qrModal) {
        qrModal.style.display = 'none';
    }
});

// 复制链接
document.getElementById('copy-url-btn').addEventListener('click', () => {
    const url = document.getElementById('share-url').textContent;
    navigator.clipboard.writeText(url).then(() => {
        alert('链接已复制到剪贴板！');
    }).catch(() => {
        alert('复制失败，请手动复制');
    });
});

// 生成随机房间ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
