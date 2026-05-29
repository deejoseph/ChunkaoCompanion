import { useState, useEffect, useRef } from 'react';

function TextCorrectionModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    initialText = '', 
    pageStart = 1, 
    pageEnd = 1,
    defaultAnswerMarker = '【答案】',
    defaultAnalysisMarker = '【解析】',
    defaultQuestionPattern = ''
}) {

    // 确保 initialText 是字符串
    const safeInitialText = typeof initialText === 'string' ? initialText : '';
    
    const [editedText, setEditedText] = useState(safeInitialText);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedText, setSelectedText] = useState('');
    const [answerMarker, setAnswerMarker] = useState(defaultAnswerMarker);
    const [analysisMarker, setAnalysisMarker] = useState(defaultAnalysisMarker);
    const [questionPattern, setQuestionPattern] = useState(defaultQuestionPattern);
    
    // 撤销/重做历史管理
    const [history, setHistory] = useState([safeInitialText]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const textareaRef = useRef(null);
    
    // 自动保存相关状态
    const [autoSaveTime, setAutoSaveTime] = useState(null);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [isDraftLoaded, setIsDraftLoaded] = useState(false);
    const [manualSaveMsg, setManualSaveMsg] = useState('');

    // 预设选项
    const answerMarkers = ['【答案】', '【参考答案】', '答案：', '参考答案：'];
    const analysisMarkers = ['【解析】', '【详解】', '【常规讲解】', '解析：', '详解：'];
    const questionPatterns = ['练习', '\\d+[．、.]', '【题目】'];

    // 添加到历史记录
    const addToHistory = (text) => {
        // 如果不是最新状态，删除后续的历史
        if (historyIndex < history.length - 1) {
            setHistory(history.slice(0, historyIndex + 1));
        }
        const newHistory = [...history, text];
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    // 撤销
    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setEditedText(history[newIndex]);
        }
    };

    // 重做
    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setEditedText(history[newIndex]);
        }
    };

    // 处理文本变化
    const handleTextChange = (e) => {
        const newText = e.target.value;
        setEditedText(newText);
        // 只有当长度差异较大或者内容明显变化时才添加到历史
        // 避免每个字符都添加一条历史
        if (Math.abs(newText.length - history[historyIndex].length) > 5 || 
            (newText.length === 0 || history[historyIndex].length === 0)) {
            // 使用防抖避免频繁添加历史
        }
    };

    // 防抖的历史记录
    useEffect(() => {
        if (!isOpen || editedText === history[historyIndex]) return;
        
        const timer = setTimeout(() => {
            if (editedText !== history[historyIndex]) {
                addToHistory(editedText);
            }
        }, 500); // 500ms 后保存历史
        
        return () => clearTimeout(timer);
    }, [editedText, isOpen]);

    // 快捷键处理
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen || !textareaRef.current) return;
            
            // 检查是否是在 textarea 中
            if (document.activeElement !== textareaRef.current) return;

            // Ctrl+Z 或 Cmd+Z - 撤销
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
                return;
            }

            // Ctrl+Y 或 Ctrl+Shift+Z 或 Cmd+Shift+Z - 重做
            if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                handleRedo();
                return;
            }

            // 注：Ctrl+A, Ctrl+C, Ctrl+X, Ctrl+V 浏览器原生支持，无需处理
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, historyIndex, history]);

    // 保存草稿
    const saveDraft = (text, markerAns, markerAna, pattern, showMsg = false) => {
        const saveData = {
            text: text,
            timestamp: Date.now(),
            pageStart: pageStart,
            pageEnd: pageEnd,
            answerMarker: markerAns,
            analysisMarker: markerAna,
            questionPattern: pattern
        };
        localStorage.setItem('correction_draft', JSON.stringify(saveData));
        setAutoSaveTime(new Date());
        if (showMsg) {
            setManualSaveMsg('✓ 草稿已手动保存');
            setTimeout(() => setManualSaveMsg(''), 2000);
        }
    };

    // 加载草稿
    const loadDraft = () => {
        const saved = localStorage.getItem('correction_draft');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                // 检查是否是同一份文档（页码范围匹配）
                if (data.pageStart === pageStart && data.pageEnd === pageEnd) {
                    const confirmLoad = window.confirm(
                        `发现上次未完成的草稿 (${new Date(data.timestamp).toLocaleString()})\n\n是否恢复？`
                    );
                    if (confirmLoad) {
                        setEditedText(data.text);
                        setHistory([data.text]);
                        setHistoryIndex(0);
                        setAnswerMarker(data.answerMarker || defaultAnswerMarker);
                        setAnalysisMarker(data.analysisMarker || defaultAnalysisMarker);
                        setQuestionPattern(data.questionPattern || defaultQuestionPattern);
                        setAutoSaveTime(new Date(data.timestamp));
                    }
                }
            } catch (e) {
                console.error('读取草稿失败:', e);
            }
        }
        setIsDraftLoaded(true);
    };

    // 清除草稿
    const clearDraft = () => {
        localStorage.removeItem('correction_draft');
        setAutoSaveTime(null);
        setManualSaveMsg('草稿已清除');
        setTimeout(() => setManualSaveMsg(''), 2000);
    };

    // 监听文本变化自动保存（防抖）
    useEffect(() => {
        if (!isOpen) return;
        if (!editedText || editedText === safeInitialText) return;
        
        const timer = setTimeout(() => {
            saveDraft(editedText, answerMarker, analysisMarker, questionPattern, false);
        }, 1000);
        
        return () => clearTimeout(timer);
    }, [editedText, answerMarker, analysisMarker, questionPattern, isOpen]);

    // 监听 initialText 变化
    useEffect(() => {
        const newText = typeof initialText === 'string' ? initialText : '';
        if (newText && newText !== editedText && !isDraftLoaded) {
            console.log('TextCorrectionModal 接收文本，长度:', newText.length);
            setEditedText(newText);
            if (!isDraftLoaded && newText.length > 0) {
                loadDraft();
            }
        }
    }, [initialText]);

    // 弹窗打开时重置草稿加载标记
    useEffect(() => {
        if (isOpen) {
            setIsDraftLoaded(false);
        }
    }, [isOpen]);

    // 弹窗关闭时重置选中文本
    useEffect(() => {
        if (!isOpen) {
            setSelectedText('');
        }
    }, [isOpen]);

    // 光标位置处理
    const handleCursor = (e) => {
        setCursorPosition(e.target.selectionStart);
    };

    // 处理文本选择
    const handleTextSelect = () => {
        const selection = window.getSelection();
        const text = selection.toString();
        if (text) {
            setSelectedText(text);
        }
        const textarea = document.getElementById('correction-textarea');
        if (textarea) {
            setCursorPosition(textarea.selectionStart);
        }
    };

    // 应用标记（使用正则表达式精确替换）
    const applyMarker = (type) => {
        if (!selectedText) {
            alert('请先选中要标记的文本');
            return;
        }

        let marker = '';
        if (type === 'question') {
            marker = questionPattern || '练习';
        } else if (type === 'answer') {
            marker = answerMarker;
        } else if (type === 'analysis') {
            marker = analysisMarker;
        }

        const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedText, 'g');
        const newText = editedText.replace(regex, `${marker}\n${selectedText}\n`);
        
        if (newText === editedText) {
            alert('未找到选中的文本，请重新选择');
            return;
        }
        
        setEditedText(newText);
        setSelectedText('');
    };

    // 规范化换行
    const normalizeLineBreaks = () => {
        let normalized = editedText;
        normalized = normalized.replace(/(\d+[．、.]\s*)/g, '\n$1');
        normalized = normalized.replace(/(练习\s*\d+)/gi, '\n$1');
        normalized = normalized.replace(/(【题目】)/g, '\n$1');
        normalized = normalized.replace(/(【答案】)/g, '\n$1');
        normalized = normalized.replace(/(【解析】)/g, '\n$1');
        normalized = normalized.replace(/\n{3,}/g, '\n\n');
        setEditedText(normalized);
        alert('已规范化换行格式');
    };

    // 查找
    const handleSearch = () => {
        if (!searchKeyword) return;
        const index = editedText.indexOf(searchKeyword);
        if (index !== -1) {
            const textarea = document.getElementById('correction-textarea');
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(index, index + searchKeyword.length);
                setCursorPosition(index);
            }
        } else {
            alert('未找到');
        }
    };

    // 确认
    const handleConfirm = () => {
        if (!editedText.trim()) {
            alert('文本内容为空，请先编辑或确认');
            return;
        }
        clearDraft();
        onConfirm({
            correctedText: editedText,
            answerMarker: answerMarker,
            analysisMarker: analysisMarker,
            questionPattern: questionPattern,
            pageStart: pageStart,
            pageEnd: pageEnd
        });
    };

    // 重置
    const handleReset = () => {
        const newText = typeof initialText === 'string' ? initialText : '';
        if (window.confirm('确定重置为原始文本吗？这将清除未保存的草稿。')) {
            setEditedText(newText);
            setHistory([newText]);
            setHistoryIndex(0);
            clearDraft();
        }
    };
    
    // 自动检测常见的答案和解析标记
    const autoDetectMarkers = () => {
        const text = editedText;
        let detectedAnswerMarker = '';
        let detectedAnalysisMarker = '';

        // 检测答案标记
        if (text.includes('【答案】')) detectedAnswerMarker = '【答案】';
        else if (text.includes('【参考答案】')) detectedAnswerMarker = '【参考答案】';
        else if (text.includes('答案：')) detectedAnswerMarker = '答案：';

        // 检测解析标记
        if (text.includes('【解析】')) detectedAnalysisMarker = '【解析】';
        else if (text.includes('【详解】')) detectedAnalysisMarker = '【详解】';
        else if (text.includes('【常规讲解】')) detectedAnalysisMarker = '【常规讲解】';

        if (detectedAnswerMarker) {
            setAnswerMarker(detectedAnswerMarker);
            alert(`检测到答案标记：${detectedAnswerMarker}`);
        }
        if (detectedAnalysisMarker) {
            setAnalysisMarker(detectedAnalysisMarker);
            alert(`检测到解析标记：${detectedAnalysisMarker}`);
        }
        if (!detectedAnswerMarker && !detectedAnalysisMarker) {
            alert('未检测到常见的答案或解析标记，请手动设置');
        }
    };
    
    // 添加下划线标记
    const addUnderline = () => {
        if (!selectedText) {
            alert('请先选中需要添加下划线的文字');
            return;
        }

        // 用 HTML 标签或特殊标记包裹选中文字
        const newText = editedText.replace(
            selectedText,
            `<u>${selectedText}</u>`
        );
        setEditedText(newText);
        setSelectedText('');
    };

    // 格式化保存时间显示
    const getSaveTimeDisplay = () => {
        if (!autoSaveTime) return null;
        const diff = Math.floor((Date.now() - autoSaveTime) / 1000);
        if (diff < 60) return `${diff}秒前`;
        if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
        return autoSaveTime.toLocaleTimeString();
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000
        }}>
            <div style={{
                background: 'white',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '1200px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '16px 20px',
                    background: '#1890ff',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h3 style={{ margin: 0 }}>📝 文本校正 - 第 {pageStart}-{pageEnd} 页</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* 左侧编辑区 */}
                    <div style={{ flex: 2, padding: '16px', overflow: 'auto', borderRight: '1px solid #eee' }}>
                        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <span>📄 原始提取文本（可直接编辑）</span>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button 
                                    onClick={handleUndo}
                                    disabled={historyIndex <= 0}
                                    style={{ 
                                        padding: '4px 12px', 
                                        background: historyIndex <= 0 ? '#ccc' : '#722ed1', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '4px', 
                                        cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer', 
                                        fontSize: '12px'
                                    }}
                                    title="撤销 (Ctrl+Z)"
                                >
                                    ↶ 撤销
                                </button>
                                <button 
                                    onClick={handleRedo}
                                    disabled={historyIndex >= history.length - 1}
                                    style={{ 
                                        padding: '4px 12px', 
                                        background: historyIndex >= history.length - 1 ? '#ccc' : '#722ed1', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '4px', 
                                        cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer', 
                                        fontSize: '12px'
                                    }}
                                    title="重做 (Ctrl+Y)"
                                >
                                    ↷ 重做
                                </button>
                                <button 
                                    onClick={normalizeLineBreaks} 
                                    style={{ padding: '4px 12px', background: '#722ed1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                    title="在题目编号前自动添加换行"
                                >
                                    🔧 规范化换行
                                </button>
                                <button onClick={handleReset} style={{ padding: '4px 12px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>重置</button>
                            </div>
                        </div>
                        <textarea
                            ref={textareaRef}
                            id="correction-textarea"
                            value={editedText}
                            onChange={handleTextChange}
                            onMouseUp={handleTextSelect}
                            onKeyUp={handleCursor}
                            onClick={handleCursor}
                            rows={25}
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                lineHeight: '1.6',
                                borderRadius: '8px',
                                border: '1px solid #d9d9d9',
                                resize: 'vertical'
                            }}
                        />
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#999', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <span>💡 提示：可以直接编辑文本，或选中文本后使用右侧工具添加标记</span>
                            <span>📍 {cursorPosition} / {editedText.length} 字符</span>
                        </div>
                        {manualSaveMsg && (
                            <div style={{ fontSize: '11px', color: '#52c41a', marginTop: '4px' }}>
                                {manualSaveMsg}
                            </div>
                        )}
                    </div>

                    {/* 右侧工具区 */}
                    <div style={{ flex: 1, padding: '16px', overflow: 'auto', background: '#fafafa' }}>
                        <h4 style={{ marginTop: 0 }}>🔧 快速修正工具</h4>
                        
                        <div style={{ marginBottom: '16px' }}>
                            <label>🔍 搜索：</label>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
                                    placeholder="输入关键词..."
                                />
                                <button onClick={handleSearch} style={{ padding: '6px 12px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>查找</button>
                                <button 
                                    onClick={autoDetectMarkers} 
                                    style={{ padding: '6px 12px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    自动检测标记
                                </button>
                                <button 
                                    onClick={addUnderline}
                                    style={{ padding: '6px 12px', background: '#13c2c2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    添加下划线
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label>📌 选中文本：</label>
                            <div style={{
                                background: '#fff',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid #d9d9d9',
                                minHeight: '60px',
                                fontSize: '12px',
                                wordBreak: 'break-all',
                                fontFamily: 'monospace'
                            }}>
                                {selectedText || '请在上方文本区选中内容'}
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label>🏷️ 快速标记：</label>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                <button onClick={() => applyMarker('question')} style={{ padding: '6px 12px', background: '#52c41a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>📝 标记为题目</button>
                                <button onClick={() => applyMarker('answer')} style={{ padding: '6px 12px', background: '#fa8c16', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🔖 标记为答案</button>
                                <button onClick={() => applyMarker('analysis')} style={{ padding: '6px 12px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>📋 标记为解析</button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label>📋 题目标记预设：</label>
                            <select
                                value={questionPattern}
                                onChange={(e) => setQuestionPattern(e.target.value)}
                                style={{ width: '100%', marginTop: '4px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                            >
                                <option value="">自动识别</option>
                                {questionPatterns.map(p => <option key={p} value={p}>{p}</option>)}
                                <option value="custom">自定义：</option>
                            </select>
                            {questionPattern === 'custom' && (
                                <input
                                    type="text"
                                    placeholder="输入自定义题目标记"
                                    style={{ width: '100%', marginTop: '4px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                                    onChange={(e) => setQuestionPattern(e.target.value)}
                                />
                            )}
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label>🔖 答案标记预设：</label>
                            <select
                                value={answerMarker}
                                onChange={(e) => setAnswerMarker(e.target.value)}
                                style={{ width: '100%', marginTop: '4px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                            >
                                {answerMarkers.map(m => <option key={m} value={m}>{m}</option>)}
                                <option value="custom">自定义：</option>
                            </select>
                            {answerMarker === 'custom' && (
                                <input
                                    type="text"
                                    placeholder="输入自定义答案标记"
                                    style={{ width: '100%', marginTop: '4px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                                    onChange={(e) => setAnswerMarker(e.target.value)}
                                />
                            )}
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label>📋 解析标记预设：</label>
                            <select
                                value={analysisMarker}
                                onChange={(e) => setAnalysisMarker(e.target.value)}
                                style={{ width: '100%', marginTop: '4px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                            >
                                {analysisMarkers.map(m => <option key={m} value={m}>{m}</option>)}
                                <option value="custom">自定义：</option>
                            </select>
                            {analysisMarker === 'custom' && (
                                <input
                                    type="text"
                                    placeholder="输入自定义解析标记"
                                    style={{ width: '100%', marginTop: '4px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                                    onChange={(e) => setAnalysisMarker(e.target.value)}
                                />
                            )}
                        </div>

                        {/* 草稿操作按钮组 */}
                        <div style={{ 
                            marginTop: '20px', 
                            paddingTop: '16px', 
                            borderTop: '1px solid #e8e8e8',
                            display: 'flex',
                            gap: '12px',
                            flexWrap: 'wrap'
                        }}>
                            <button 
                                onClick={() => saveDraft(editedText, answerMarker, analysisMarker, questionPattern, true)} 
                                style={{ flex: 1, padding: '8px 12px', background: '#52c41a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                💾 手动保存草稿
                            </button>
                            <button 
                                onClick={clearDraft} 
                                style={{ flex: 1, padding: '8px 12px', background: '#f5222d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                🗑️ 清除草稿
                            </button>
                        </div>

                        <div style={{
                            fontSize: '12px',
                            color: '#999',
                            marginTop: '16px',
                            padding: '12px',
                            background: '#fff',
                            borderRadius: '8px',
                            border: '1px solid #e8e8e8'
                        }}>
                            <strong>💡 使用说明：</strong>
                            <ol style={{ margin: '8px 0 0 20px', lineHeight: '1.6' }}>
                                <li>在左侧文本区选中题目、答案或解析内容</li>
                                <li>点击对应的快速标记按钮</li>
                                <li>标记会自动添加到选中文本前后</li>
                                <li><strong>自动保存</strong>：编辑后1秒自动保存草稿</li>
                                <li><strong>手动保存</strong>：点击「手动保存草稿」立即保存</li>
                                <li>关闭弹窗后重新打开，可恢复草稿</li>
                                <li>确认后点击「确认解析」继续</li>
                            </ol>
                            <strong style={{ marginTop: '12px', display: 'block' }}>⌨️ 快捷键：</strong>
                            <ul style={{ margin: '8px 0 0 20px', lineHeight: '1.6' }}>
                                <li><code>Ctrl+Z</code> - 撤销</li>
                                <li><code>Ctrl+Y</code> 或 <code>Ctrl+Shift+Z</code> - 重做</li>
                                <li><code>Ctrl+A</code> - 全选</li>
                                <li><code>Ctrl+C</code> - 复制</li>
                                <li><code>Ctrl+X</code> - 剪切</li>
                                <li><code>Ctrl+V</code> - 粘贴</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px'
                }}>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                        📌 第 {pageStart}-{pageEnd} 页
                        {autoSaveTime && (
                            <span style={{ marginLeft: '12px' }}>
                                💾 草稿 {getSaveTimeDisplay()}
                            </span>
                        )}
                        <span style={{ marginLeft: '12px' }}>
                            📜 编辑历史 {historyIndex + 1}/{history.length}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onClose} style={{ padding: '8px 20px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            取消
                        </button>
                        <button onClick={handleConfirm} style={{ padding: '8px 20px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            ✓ 确认解析
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TextCorrectionModal;