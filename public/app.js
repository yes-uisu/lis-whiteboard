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
let userCount = 1;

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
    userCount++;
    document.getElementById('user-count').textContent = `👥 ${userCount}`;
});

socket.on('clear-canvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// 接收Markdown更新
socket.on('markdown-data', (content) => {
    isUpdatingMarkdown = true;
    markdownEditor.value = content;
    updatePreview();
    isUpdatingMarkdown = false;
});

socket.on('markdown-update', (content) => {
    isUpdatingMarkdown = true;
    markdownEditor.value = content;
    updatePreview();
    isUpdatingMarkdown = false;
});

socket.on('clear-markdown', () => {
    isUpdatingMarkdown = true;
    markdownEditor.value = '';
    updatePreview();
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

// 监听编辑器输入
markdownEditor.addEventListener('input', () => {
    if (!isUpdatingMarkdown) {
        updatePreview();
        socket.emit('markdown-update', { roomId, content: markdownEditor.value });
    }
});

// Markdown工具按钮
const mdButtons = document.querySelectorAll('.md-btn');
mdButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        insertMarkdown(action);
    });
});

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
    updatePreview();
    socket.emit('markdown-update', { roomId, content: markdownEditor.value });
}

// 清空文档
document.getElementById('clear-markdown-btn').addEventListener('click', () => {
    if (confirm('确定要清空文档吗？')) {
        markdownEditor.value = '';
        updatePreview();
        socket.emit('clear-markdown', roomId);
    }
});

// 保存文档
document.getElementById('save-markdown-btn').addEventListener('click', () => {
    const content = markdownEditor.value;
    const blob = new Blob([content], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.download = `document_${roomId}_${Date.now()}.md`;
    link.href = URL.createObjectURL(blob);
    link.click();
});

// ==================== 画布功能 ====================
// 清空画布
document.getElementById('clear-canvas-btn').addEventListener('click', () => {
    if (confirm('确定要清空画布吗？')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        socket.emit('clear-canvas', roomId);
    }
});

// 保存画布
document.getElementById('save-canvas-btn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `whiteboard_${roomId}_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
});

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
