import { useState, useEffect } from 'react';
import axios from 'axios';

function DataImport() {
    const [subject, setSubject] = useState('chinese');
    const [customSubject, setCustomSubject] = useState('');
    const [version, setVersion] = useState('2026');
    const [customVersion, setCustomVersion] = useState('');
    const [topicName, setTopicName] = useState('');
    const [file, setFile] = useState(null);
    const [pageRange, setPageRange] = useState({ start: 1, end: 1 });
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [savedBanks, setSavedBanks] = useState([]);
    const [showBankList, setShowBankList] = useState(false);
    const [editingBank, setEditingBank] = useState(null);
    const [showNewBankForm, setShowNewBankForm] = useState(false);
    const [newSubject, setNewSubject] = useState('');
    const [newCustomSubject, setNewCustomSubject] = useState('');
    const [newVersion, setNewVersion] = useState('');
    const [newCustomVersion, setNewCustomVersion] = useState('');
    const [newTopic, setNewTopic] = useState('');
    const [showJsonEditor, setShowJsonEditor] = useState(false);
    const [jsonContent, setJsonContent] = useState('');
    
    // 解析格式设置
    const [questionPattern, setQuestionPattern] = useState('');  // 题目标记
    const [answerMarker, setAnswerMarker] = useState('【答案】');
    const [analysisMarker, setAnalysisMarker] = useState('【解析】');
    
    // AI 助教相关状态
    const [showFormulaInput, setShowFormulaInput] = useState(false);
    const [formulaLatex, setFormulaLatex] = useState('');
    const [uploading, setUploading] = useState(false);
    const [ocrResult, setOcrResult] = useState('');
    const [currentEditingQuestionId, setCurrentEditingQuestionId] = useState(null);
    const [showTextOcrModal, setShowTextOcrModal] = useState(false);
    const [textOcrContent, setTextOcrContent] = useState('');
    const [textOcrUploading, setTextOcrUploading] = useState(false);
    const [answersReviewed, setAnswersReviewed] = useState(false);
    const [bulkValidating, setBulkValidating] = useState(false);
    const [bulkValidationResults, setBulkValidationResults] = useState([]);
    const [showBulkResults, setShowBulkResults] = useState(false);

    // 题型识别函数
    const detectQuestionType = (content) => {
        if (!content) return 'qa';
        // 选择题检测
        if (/[A-D][.．、)]/.test(content) || /^[A-D]\s*[.．、)]/.test(content)) return 'choice';
        // 填空题检测
        if (/_{2,}|____|（\s*）|\(\s*\)/.test(content)) return 'fill';
        // 默写题
        if (/默写|填空|补全/.test(content)) return 'fill';
        // 问答题（默认）
        return 'qa';
    };

    useEffect(() => {
        if (answerMarker.includes('ã€')) setAnswerMarker('【答案】');
        if (analysisMarker.includes('ã€')) setAnalysisMarker('【解析】');
    }, []);

    const subjects = {
        chinese: { name: '语文' },
        math: { name: '数学' },
        english: { name: '英语' },
        custom: { name: '自定义' }
    };

    const subjectNames = {
        chinese: '语文',
        math: '数学',
        english: '英语'
    };

    // 获取实际学科值
    const getActualSubject = () => {
        if (subject === 'custom') {
            return customSubject || 'custom';
        }
        return subject;
    };

    // 获取实际版本值
    const getActualVersion = () => {
        if (version === 'custom') {
            return customVersion || 'custom';
        }
        return version;
    };

    // 从文件名自动提取专题名称
    const extractTopicFromFilename = (filename) => {
        if (!filename) return '';
        let name = filename.replace(/\.(pdf|docx)$/i, '');
        // 去掉教师版/学生版后缀
        name = name.replace(/（教师版）$/, '')
                   .replace(/\(教师版\)$/, '')
                   .replace(/（学生版）$/, '')
                   .replace(/\(学生版\)$/, '')
                   .replace(/教师版$/, '')
                   .replace(/学生版$/, '')
                   .trim();
        return name;
    };

    const makeAIReferenceTitle = (title) => {
        const base = (title || '').trim();
        if (!base) return base;
        if (base.includes('AI参考答案')) return base;
        if (base.includes('教师版')) return base.replace(/教师版(?!.*教师版)/, 'AI参考答案');
        if (base.includes('（教师版）')) return base.replace(/（教师版）(?!.*（教师版）)/, '（AI参考答案）');
        if (base.includes('(教师版)')) return base.replace(/\(教师版\)(?!.*\(教师版\))/, '(AI参考答案)');
        return `${base}（AI参考答案）`;
    };

    const makeSafeFileName = (title) => {
        return makeAIReferenceTitle(title)
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_');
    };

    const getSubjectLabel = () => {
        const actualSubject = getActualSubject();
        return subjectNames[actualSubject] || actualSubject;
    };

    // 根据学科和题型获取默认Prompt
    const getDefaultValidationPrompt = (questionType = null, content = '') => {
        // 如果没有指定题型，自动识别
        const detectedType = questionType || detectQuestionType(content);
        const subjectLabel = getSubjectLabel();
        const typeLabel = { fill: '填空题', choice: '选择题', qa: '问答题' }[detectedType] || '题目';
        
        const base = `你是上海春考${subjectLabel}阅卷老师。请按${typeLabel}要求判断并作答。`;
        
        const byType = {
            choice: '只输出正确选项字母，例如 A。不要输出解释、题号或多余文字。',
            fill: '只输出每个空的最终答案。多个空用一个空格分隔。不要输出解释、题号或多余文字。',
            qa: '只输出标准答案要点，尽量短句分点；不要输出解题过程、题号或寒暄。'
        };
        
        const bySubject = {
            chinese: '语文题要严格依据原文、语境和春考表达规范；默写题必须逐字准确。',
            math: '数学题要先内部推理核算，但最终只输出答案；保留必要的数学符号。',
            english: '英语题要注意语法、搭配和上下文；最终只输出答案本身。'
        };
        
        const subjectPrompt = bySubject[getActualSubject()] || '';
        const typePrompt = byType[detectedType] || byType.qa;
        
        return `${base}\n${subjectPrompt}\n${typePrompt}`;
    };

    const getValidationModels = () => {
        const actualSubject = getActualSubject();
        if (actualSubject === 'chinese') {
            return [
                localStorage.getItem('chinese_model_fast') || 'qwen2.5:7b',
                localStorage.getItem('chinese_model_pro') || 'qwen2.5:14b',
                localStorage.getItem('chinese_model_reference') || 'qwen2.5-coder:7b'
            ];
        }
        if (actualSubject === 'math') {
            return [
                localStorage.getItem('math_model_fast') || 'qwen2.5:7b',
                localStorage.getItem('math_model_pro') || 'qwen2.5:14b',
                localStorage.getItem('math_model_reference') || 'qwen2.5-coder:7b'
            ];
        }
        return ['qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5-coder:7b'];
    };

    const getAISuggestedAnswer = (answers) => {
        const values = Object.values(answers || {})
            .filter(a => a && !String(a).startsWith('错误') && !String(a).startsWith('閿欒'));
        const counts = {};
        values.forEach(answer => {
            counts[answer] = (counts[answer] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    };

    // 加载已保存的题库列表
    useEffect(() => {
        loadBanks();
    }, []);

    const loadBanks = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/banks/list');
            if (response.data.success) {
                setSavedBanks(response.data.banks);
            }
        } catch (error) {
            console.error('加载题库列表失败:', error);
        }
    };

    const getBanksBySubject = () => {
        const grouped = {};
        savedBanks.forEach(bank => {
            const subjectKey = bank.subject;
            if (!grouped[subjectKey]) {
                grouped[subjectKey] = [];
            }
            grouped[subjectKey].push(bank);
        });
        return grouped;
    };

    const confirmDelete = (message, onConfirm) => {
        if (window.confirm(message)) {
            onConfirm();
        }
    };

    const deleteBank = async (bankId, bankTitle) => {
        confirmDelete(`确定删除题库「${bankTitle}」吗？此操作不可恢复。`, async () => {
            try {
                await axios.delete(`http://localhost:3001/api/banks/${bankId}`);
                loadBanks();
                alert('删除成功');
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败');
            }
        });
    };

    const deleteSubject = async (subjectKey) => {
        const subjectName = subjectNames[subjectKey] || subjectKey;
        confirmDelete(`确定删除「${subjectName}」学科下的所有题库吗？此操作不可恢复。`, async () => {
            try {
                await axios.delete(`http://localhost:3001/api/banks/subject/${subjectKey}`);
                loadBanks();
                alert('删除成功');
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败');
            }
        });
    };

    const createNewBank = () => {
        const finalSubject = newSubject === 'custom' ? newCustomSubject : newSubject;
        const finalVersion = newVersion === 'custom' ? newCustomVersion : newVersion;
        
        if (!finalSubject || !finalVersion || !newTopic) {
            alert('请完整填写学科、版本和专题名称');
            return;
        }
        setSubject(newSubject);
        setCustomSubject(newCustomSubject);
        setVersion(newVersion);
        setCustomVersion(newCustomVersion);
        setTopicName(newTopic);
        setShowNewBankForm(false);
        setQuestions([]);
        setEditingBank(null);
        setNewSubject('');
        setNewCustomSubject('');
        setNewVersion('');
        setNewCustomVersion('');
        setNewTopic('');
    };

    // ========== AI 助教功能 ==========
    
    const handleFormulaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await axios.post('http://localhost:3001/api/ocr/recognize', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                const latex = response.data.latex;
                setOcrResult(latex);
                alert(`识别成功！公式: ${latex}`);
                if (currentEditingQuestionId) {
                    const currentQuestion = questions.find(q => q.id === currentEditingQuestionId);
                    if (currentQuestion) {
                        updateQuestion(currentEditingQuestionId, 'content', currentQuestion.content + latex);
                    }
                }
            } else {
                alert('识别失败：' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('OCR识别失败:', error);
            alert('识别失败，请重试');
        }
        setUploading(false);
    };

    const handleTextImageUpload = async (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }
        
        setTextOcrUploading(true);
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await axios.post('http://localhost:3001/api/ocr/recognize-text', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                setTextOcrContent(response.data.text || '');
                setShowTextOcrModal(true);
            } else {
                alert(`识别失败：${response.data.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('图文识别失败:', error);
            alert('识别失败，请重试');
        }
        setTextOcrUploading(false);
    };

    const insertTextOcrToQuestion = () => {
        if (currentEditingQuestionId && textOcrContent) {
            const currentQuestion = questions.find(q => q.id === currentEditingQuestionId);
            if (currentQuestion) {
                updateQuestion(currentEditingQuestionId, 'content', currentQuestion.content + '\n' + textOcrContent);
            }
            setShowTextOcrModal(false);
            setTextOcrContent('');
        }
    };

    // 解析文档
    const parseDocument = async () => {
        if (!file) {
            alert('请先选择文档');
            return;
        }

        // 自动从文件名提取专题名称
        if (!topicName) {
            const extracted = extractTopicFromFilename(file.name);
            if (extracted) {
                const confirmExtract = window.confirm(`是否使用文件名作为专题名称？\n"${extracted}"\n\n点击确定使用，取消则手动输入。`);
                if (confirmExtract) {
                    setTopicName(extracted);
                }
            }
        }

        setParsing(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('pageStart', pageRange.start);
        formData.append('pageEnd', pageRange.end);
        formData.append('questionPattern', questionPattern);
        formData.append('answerMarker', answerMarker);
        formData.append('analysisMarker', analysisMarker);

        try {
            const response = await axios.post('http://localhost:3001/api/docs/parse', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success && response.data.questions) {
                // 为每道题自动识别题型
                const questionsWithTypes = response.data.questions.map(q => ({
                    ...q,
                    type: detectQuestionType(q.content)
                }));
                setJsonContent(JSON.stringify(questionsWithTypes, null, 2));
                setShowJsonEditor(true);
                alert(`解析成功！共 ${questionsWithTypes.length} 道题目`);
            } else {
                alert('解析失败，请手动添加题目');
            }
        } catch (error) {
            console.error('解析失败:', error);
            alert('解析失败，请手动添加题目');
        }
        setParsing(false);
    };

    const importFromJson = () => {
        try {
            const imported = JSON.parse(jsonContent);
            const newQuestions = imported.map((q, idx) => ({
                id: Date.now() + idx,
                page: q.page || pageRange.start,
                number: questions.length + idx + 1,
                type: q.type || detectQuestionType(q.content),
                content: q.content,
                answerFormat: '【答案】',
                sourceAnswer: q.sourceAnswer || q.answer || '',
                aiAnswers: q.aiAnswers || {},
                aiSuggestedAnswer: q.aiSuggestedAnswer || '',
                verdict: q.verdict || null,
                finalAnswer: '',  // 初始为空，让用户手动确认
                analysis: q.analysis || ''
            }));
            setQuestions([...questions, ...newQuestions]);
            setShowJsonEditor(false);
            alert(`成功导入 ${newQuestions.length} 道题目\n\n注意：最终答案需要手动确认后填写`);
        } catch (error) {
            alert('JSON 格式错误，请检查');
        }
    };

    const loadBankForEdit = async (bankId) => {
        try {
            const response = await axios.get(`http://localhost:3001/api/banks/${bankId}`);
            if (response.data.success) {
                const bank = response.data.bank;
                setSubject(bank.subject);
                setVersion(bank.version);
                setTopicName(bank.sourceTitle || bank.title.replace('（AI参考答案）', ''));
                setQuestions(bank.questions.map((q, idx) => ({
                    id: Date.now() + idx,
                    number: idx + 1,
                    type: q.type || detectQuestionType(q.content),
                    content: q.content,
                    answerFormat: '【答案】',
                    sourceAnswer: q.sourceAnswer || '',
                    aiAnswers: q.aiAnswers || {},
                    aiSuggestedAnswer: q.aiSuggestedAnswer || '',
                    verdict: q.verdict || null,
                    finalAnswer: q.finalAnswer || '',
                    analysis: q.analysis || ''
                })));
                setEditingBank(bankId);
                alert(`已加载题库: ${bank.title}\n\n请检查并确认最终答案后再保存。`);
            }
        } catch (error) {
            console.error('加载题库失败:', error);
            alert('加载题库失败');
        }
    };

    const addQuestion = () => {
        setQuestions([
            ...questions,
            {
                id: Date.now(),
                page: pageRange.start,
                number: questions.length + 1,
                type: 'fill',
                content: '',
                answerFormat: '【答案】',
                sourceAnswer: '',
                aiAnswers: {},
                aiSuggestedAnswer: '',
                verdict: null,
                finalAnswer: '',
                analysis: ''
            }
        ]);
    };

    const updateQuestion = (id, field, value) => {
        if (['content', 'sourceAnswer', 'aiSuggestedAnswer', 'finalAnswer', 'analysis', 'type'].includes(field)) {
            setAnswersReviewed(false);
        }
        setQuestions(questions.map(q => 
            q.id === id ? { ...q, [field]: value } : q
        ));
    };

    const deleteQuestion = (id) => {
        confirmDelete('确定删除这道题目吗？', () => {
            setQuestions(questions.filter(q => q.id !== id));
        });
    };

    // 单题 AI 验证（不自动填入 finalAnswer）
    const validateQuestion = async (q, options = {}) => {
        if (!q.content.trim()) {
            if (!options.silent) alert('请先填写题目内容');
            return false;
        }

        // 自动检测题型并使用对应的prompt
        const detectedType = detectQuestionType(q.content);
        if (q.type !== detectedType && !options.silent) {
            const confirmType = window.confirm(`检测到题型可能为${detectedType === 'fill' ? '填空题' : detectedType === 'choice' ? '选择题' : '问答题'}，是否切换题型？\n当前题型：${q.type === 'fill' ? '填空题' : q.type === 'choice' ? '选择题' : '问答题'}`);
            if (confirmType) {
                updateQuestion(q.id, 'type', detectedType);
            }
        }

        const instruction = getDefaultValidationPrompt(q.type, q.content);
        
        if (!options.silent) setLoading(true);
        try {
            const response = await axios.post('http://localhost:3001/api/ai/validate', {
                subject: getActualSubject(),
                question: q.content,
                questionType: q.type || detectedType,
                instruction,
                models: getValidationModels()
            });

            if (response.data.success) {
                const suggestedAnswer = response.data.suggestedAnswer || getAISuggestedAnswer(response.data.answers);
                // 只更新AI答案和建议答案，不自动更新finalAnswer
                updateQuestion(q.id, 'aiAnswers', response.data.answers);
                updateQuestion(q.id, 'verdict', response.data.verdict);
                updateQuestion(q.id, 'aiSuggestedAnswer', suggestedAnswer);
                setAnswersReviewed(false);
                if (!options.silent) {
                    alert(`验证完成！\nAI建议答案：${suggestedAnswer || '未识别'}\n请手动确认后填入「最终答案」`);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('AI验证失败:', error);
            if (!options.silent) alert('验证失败: ' + (error.response?.data?.error || error.message));
            return false;
        } finally {
            if (!options.silent) setLoading(false);
        }
    };

    // 批量 AI 验证（全部完成后一次性显示结果）
    const validateAll = async () => {
        if (questions.length === 0) {
            alert('没有题目需要验证');
            return;
        }
        
        setBulkValidating(true);
        setBulkValidationResults([]);
        
        const results = [];
        let currentIndex = 0;
        
        for (const q of questions) {
            // 更新进度
            setBulkValidationResults(prev => [...prev, { 
                questionId: q.id, 
                content: q.content.substring(0, 50) + (q.content.length > 50 ? '...' : ''),
                status: 'validating',
                suggestedAnswer: null 
            }]);
            
            // 自动检测题型
            const detectedType = detectQuestionType(q.content);
            const instruction = getDefaultValidationPrompt(q.type, q.content);
            
            try {
                const response = await axios.post('http://localhost:3001/api/ai/validate', {
                    subject: getActualSubject(),
                    question: q.content,
                    questionType: q.type || detectedType,
                    instruction,
                    models: getValidationModels()
                });
                
                if (response.data.success) {
                    const suggestedAnswer = response.data.suggestedAnswer || getAISuggestedAnswer(response.data.answers);
                    // 更新题目数据（不自动填入finalAnswer）
                    updateQuestion(q.id, 'aiAnswers', response.data.answers);
                    updateQuestion(q.id, 'verdict', response.data.verdict);
                    updateQuestion(q.id, 'aiSuggestedAnswer', suggestedAnswer);
                    
                    results.push({
                        ...q,
                        suggestedAnswer,
                        verdict: response.data.verdict,
                        answers: response.data.answers
                    });
                    
                    setBulkValidationResults(prev => prev.map(r => 
                        r.questionId === q.id 
                            ? { ...r, status: 'done', suggestedAnswer, verdict: response.data.verdict }
                            : r
                    ));
                } else {
                    results.push({ ...q, suggestedAnswer: null, error: '验证失败' });
                    setBulkValidationResults(prev => prev.map(r => 
                        r.questionId === q.id ? { ...r, status: 'error', error: '验证失败' } : r
                    ));
                }
            } catch (error) {
                console.error('验证失败:', error);
                results.push({ ...q, suggestedAnswer: null, error: error.message });
                setBulkValidationResults(prev => prev.map(r => 
                    r.questionId === q.id ? { ...r, status: 'error', error: error.message } : r
                ));
            }
            
            currentIndex++;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        setBulkValidating(false);
        setShowBulkResults(true);
        setAnswersReviewed(false);
        
        // 一次性显示汇总结果
        const successCount = results.filter(r => r.suggestedAnswer).length;
        const failCount = results.filter(r => r.error).length;
        alert(`批量验证完成！\n\n✅ 成功：${successCount} 题\n❌ 失败：${failCount} 题\n\n请查看详细结果并手动确认最终答案。`);
    };

    // 保存答案库（保存前检查 finalAnswer）
    const saveQuestionBank = async () => {
        if (!topicName.trim()) {
            alert('请输入专题名称');
            return;
        }
        
        if (questions.length === 0) {
            alert('请至少添加一道题目');
            return;
        }
        
        // 检查是否有未填写最终答案的题目
        const emptyFinalAnswers = questions.filter(q => !q.finalAnswer || !q.finalAnswer.trim());
        if (emptyFinalAnswers.length > 0) {
            const confirmMsg = `有 ${emptyFinalAnswers.length} 道题目的「最终答案」为空。\n\n是否继续保存？\n（建议先手动填写最终答案）`;
            if (!window.confirm(confirmMsg)) {
                return;
            }
        }
        
        const actualSubject = getActualSubject();
        const actualVersion = getActualVersion();
        const referenceTitle = makeAIReferenceTitle(topicName);
        const paperId = editingBank || `${actualSubject}_${makeSafeFileName(topicName)}`;
        const bankData = {
            paperId: paperId,
            title: referenceTitle,
            sourceTitle: topicName,
            subject: actualSubject,
            version: actualVersion,
            knowledgePoints: [],
            questions: questions.map((q, idx) => ({
                id: `q${idx + 1}`,
                type: q.type,
                content: q.content,
                sourceAnswer: q.sourceAnswer,
                aiAnswers: q.aiAnswers,
                aiSuggestedAnswer: q.aiSuggestedAnswer || getAISuggestedAnswer(q.aiAnswers),
                verdict: q.verdict,
                finalAnswer: q.finalAnswer || '',  // 不自动填充，使用用户确认的值
                analysis: q.analysis
            }))
        };

        try {
            const response = await axios.post('http://localhost:3001/api/banks/save', bankData);
            if (response.data.success) {
                alert(`保存成功！${editingBank ? '更新' : '新增'}题库: ${topicName}`);
                setEditingBank(null);
                loadBanks();
            }
        } catch (error) {
            console.error('保存失败:', error);
            alert('保存失败: ' + (error.response?.data?.error || error.message));
        }
    };

    // 导出 JSON（供用户手动检查修改）
    const exportToJson = () => {
        const referenceTitle = makeAIReferenceTitle(topicName);
        const exportData = {
            paperId: `${getActualSubject()}_${makeSafeFileName(topicName)}`,
            title: referenceTitle,
            sourceTitle: topicName,
            subject: getActualSubject(),
            version: getActualVersion(),
            knowledgePoints: [],
            questions: questions.map((q, idx) => ({
                id: `q${idx + 1}`,
                type: q.type,
                content: q.content,
                sourceAnswer: q.sourceAnswer,
                aiAnswers: q.aiAnswers,
                aiSuggestedAnswer: q.aiSuggestedAnswer || getAISuggestedAnswer(q.aiAnswers),
                verdict: q.verdict,
                finalAnswer: q.finalAnswer || '',  // 导出时保留用户已填写的最终答案
                analysis: q.analysis
            }))
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${makeSafeFileName(topicName)}_question_bank.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(`已导出 JSON 文件到本地\n\n请检查并修改 finalAnswer 字段，确认后点击「保存到答案库」`);
    };

    const AIAssistantToolbar = ({ questionId }) => (
        <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '8px',
            flexWrap: 'wrap'
        }}>
            <button
                onClick={() => setShowFormulaInput(!showFormulaInput)}
                style={{
                    padding: '4px 10px',
                    background: showFormulaInput ? '#1890ff' : '#f0f0f0',
                    color: showFormulaInput ? 'white' : '#333',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                }}
            >
                📐 手动输入公式
            </button>
            <label style={{
                padding: '4px 10px',
                background: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'inline-block'
            }}>
                📸 拍照识别公式
                <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        setCurrentEditingQuestionId(questionId);
                        handleFormulaUpload(e);
                        e.target.value = '';
                    }}
                    disabled={uploading}
                />
            </label>
            <label style={{
                padding: '4px 10px',
                background: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'inline-block'
            }}>
                📄 拍照识别图文
                <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        setCurrentEditingQuestionId(questionId);
                        handleTextImageUpload(e.target.files[0]);
                        e.target.value = '';
                    }}
                    disabled={textOcrUploading}
                />
            </label>
            {uploading && <span style={{ fontSize: '12px', color: '#ff6600' }}>识别中...</span>}
            
            {showFormulaInput && (
                <div style={{ marginTop: '8px', width: '100%' }}>
                    <textarea
                        placeholder="输入LaTeX公式，如: \frac{1}{2}"
                        rows={2}
                        value={formulaLatex}
                        onChange={(e) => setFormulaLatex(e.target.value)}
                        style={{ width: '100%', padding: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                    />
                    <div style={{ marginTop: '4px' }}>
                        <button
                            onClick={() => {
                                if (formulaLatex) {
                                    const currentQuestion = questions.find(q => q.id === questionId);
                                    if (currentQuestion) {
                                        updateQuestion(questionId, 'content', currentQuestion.content + formulaLatex);
                                    }
                                    setFormulaLatex('');
                                    setShowFormulaInput(false);
                                }
                            }}
                            style={{ padding: '2px 8px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                            插入
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // 批量验证结果弹窗
    const BulkValidationModal = () => {
        if (!showBulkResults) return null;
        
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000
            }}>
                <div style={{
                    background: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    width: '600px',
                    maxWidth: '90%',
                    maxHeight: '80%',
                    overflow: 'auto'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0 }}>批量验证结果</h3>
                        <button onClick={() => setShowBulkResults(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
                    </div>
                    
                    {bulkValidationResults.map((result, idx) => (
                        <div key={result.questionId} style={{
                            padding: '12px',
                            marginBottom: '8px',
                            border: '1px solid #e8e8e8',
                            borderRadius: '4px',
                            background: result.status === 'done' ? '#f6ffed' : result.status === 'error' ? '#fff2f0' : '#fffbe6'
                        }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                题目 {idx + 1}: 
                                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                                    {result.status === 'validating' ? '验证中...' : 
                                     result.status === 'done' ? '✅ 完成' : '❌ 失败'}
                                </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                                内容: {result.content}
                            </div>
                            {result.suggestedAnswer && (
                                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                                    <strong>🤖 AI建议答案:</strong> {result.suggestedAnswer}
                                </div>
                            )}
                            {result.verdict && (
                                <div style={{ fontSize: '12px', marginTop: '2px', color: 
                                    result.verdict === 'correct' ? '#52c41a' : 
                                    result.verdict === 'maybe_correct' ? '#fa8c16' : '#f5222d' 
                                }}>
                                    投票: {result.verdict === 'correct' ? '全部正确' : 
                                           result.verdict === 'maybe_correct' ? '多数正确' : '答案有误'}
                                </div>
                            )}
                            {result.error && (
                                <div style={{ fontSize: '12px', color: '#f5222d', marginTop: '4px' }}>
                                    错误: {result.error}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button 
                            onClick={() => setShowBulkResults(false)}
                            style={{ background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer' }}
                        >
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const groupedBanks = getBanksBySubject();

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            <h1>📥 新资料采集</h1>
            
            {/* 批量验证结果弹窗 */}
            <BulkValidationModal />
            
            {/* 工具栏 */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setShowBankList(!showBankList)}
                    style={{ padding: '6px 16px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    📚 题库列表
                </button>
                <button
                    onClick={() => setShowNewBankForm(!showNewBankForm)}
                    style={{ padding: '6px 16px', background: '#52c41a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    ➕ 新建题库
                </button>
            </div>

            {/* 新建题库表单（同上，省略重复代码）... */}
            {showNewBankForm && (
                <div style={{
                    background: '#fff7e6',
                    border: '1px solid #ffc53d',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                }}>
                    <h4 style={{ marginTop: 0 }}>新建题库</h4>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div>
                            <label>学科：</label>
                            <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)} style={{ padding: '4px 8px' }}>
                                <option value="">选择学科</option>
                                <option value="chinese">语文</option>
                                <option value="math">数学</option>
                                <option value="english">英语</option>
                                <option value="custom">自定义</option>
                            </select>
                            {newSubject === 'custom' && (
                                <input
                                    type="text"
                                    value={newCustomSubject}
                                    onChange={(e) => setNewCustomSubject(e.target.value)}
                                    placeholder="输入学科名称"
                                    style={{ marginLeft: '8px', padding: '4px 8px', width: '120px' }}
                                />
                            )}
                        </div>
                        <div>
                            <label>版本：</label>
                            <select value={newVersion} onChange={(e) => setNewVersion(e.target.value)} style={{ padding: '4px 8px' }}>
                                <option value="">选择版本</option>
                                <option value="2025">2025版</option>
                                <option value="2026">2026版</option>
                                <option value="custom">自定义</option>
                            </select>
                            {newVersion === 'custom' && (
                                <input
                                    type="text"
                                    value={newCustomVersion}
                                    onChange={(e) => setNewCustomVersion(e.target.value)}
                                    placeholder="输入版本名称"
                                    style={{ marginLeft: '8px', padding: '4px 8px', width: '100px' }}
                                />
                            )}
                        </div>
                        <div>
                            <label>专题名称：</label>
                            <input
                                type="text"
                                value={newTopic}
                                onChange={(e) => setNewTopic(e.target.value)}
                                placeholder="如：专题01 名篇名句默写"
                                style={{ width: '250px', padding: '6px 10px' }}
                            />
                        </div>
                        <button onClick={createNewBank} style={{ background: '#52c41a', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer' }}>
                            创建
                        </button>
                        <button onClick={() => setShowNewBankForm(false)} style={{ background: '#f0f0f0', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer' }}>
                            取消
                        </button>
                    </div>
                </div>
            )}

            {/* 题库列表（省略，保持原有代码）... */}
            {showBankList && (
                <div style={{
                    background: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '20px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0 }}>已有题库</h3>
                        <button onClick={() => setShowBankList(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
                    </div>
                    
                    {Object.keys(groupedBanks).length === 0 ? (
                        <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>暂无题库，点击「新建题库」创建</div>
                    ) : (
                        Object.entries(groupedBanks).map(([subjectKey, banks]) => (
                            <div key={subjectKey} style={{ marginBottom: '20px' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 0',
                                    borderBottom: '1px solid #ddd'
                                }}>
                                    <strong style={{ fontSize: '16px' }}>📁 {subjectNames[subjectKey] || subjectKey}</strong>
                                    <button
                                        onClick={() => deleteSubject(subjectKey)}
                                        style={{ color: '#f5222d', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                    >
                                        删除学科
                                    </button>
                                </div>
                                {banks.map(bank => (
                                    <div key={bank.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px 12px',
                                        marginTop: '8px',
                                        background: 'white',
                                        borderRadius: '4px',
                                        border: '1px solid #e8e8e8'
                                    }}>
                                        <div>
                                            <strong>{bank.title}</strong>
                                            <span style={{ marginLeft: '12px', fontSize: '12px', color: '#666' }}>
                                                {bank.version}版 | {bank.totalQuestions}题
                                            </span>
                                        </div>
                                        <div>
                                            <button
                                                onClick={() => loadBankForEdit(bank.id)}
                                                style={{ marginRight: '8px', padding: '4px 12px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                编辑
                                            </button>
                                            <button
                                                onClick={() => deleteBank(bank.id, bank.title)}
                                                style={{ padding: '4px 12px', background: '#f5222d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                删除
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* JSON 编辑器 */}
            {showJsonEditor && (
                <div style={{
                    background: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '20px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <strong>📄 解析结果（可编辑 JSON）</strong>
                        <button onClick={() => setShowJsonEditor(false)}>关闭</button>
                    </div>
                    <textarea
                        value={jsonContent}
                        onChange={(e) => setJsonContent(e.target.value)}
                        rows={15}
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', padding: '8px' }}
                    />
                    <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                        <button onClick={importFromJson} style={{ background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer' }}>
                            导入到题目列表
                        </button>
                        <button onClick={() => setShowJsonEditor(false)} style={{ background: '#f0f0f0', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer' }}>
                            取消
                        </button>
                    </div>
                </div>
            )}

            {/* 基本信息 */}
            <div style={{
                background: '#f5f5f5',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '24px'
            }}>
                <h3 style={{ marginTop: 0 }}>基本信息</h3>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                        <label>学科：</label>
                        <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                            <option value="chinese">语文</option>
                            <option value="math">数学</option>
                            <option value="english">英语</option>
                            <option value="custom">自定义</option>
                        </select>
                        {subject === 'custom' && (
                            <input
                                type="text"
                                value={customSubject}
                                onChange={(e) => setCustomSubject(e.target.value)}
                                placeholder="输入学科名称"
                                style={{ marginLeft: '8px', padding: '4px 8px', width: '100px' }}
                            />
                        )}
                    </div>
                    <div>
                        <label>版本：</label>
                        <select value={version} onChange={(e) => setVersion(e.target.value)}>
                            <option value="2025">2025版</option>
                            <option value="2026">2026版</option>
                            <option value="custom">自定义</option>
                        </select>
                        {version === 'custom' && (
                            <input
                                type="text"
                                value={customVersion}
                                onChange={(e) => setCustomVersion(e.target.value)}
                                placeholder="输入版本名称"
                                style={{ marginLeft: '8px', padding: '4px 8px', width: '100px' }}
                            />
                        )}
                    </div>
                    <div>
                        <label>专题名称：</label>
                        <input
                            type="text"
                            value={topicName}
                            onChange={(e) => setTopicName(e.target.value)}
                            placeholder="如：专题01 名篇名句默写"
                            style={{ width: '280px', padding: '6px 10px' }}
                        />
                    </div>
                    <div>
                        <label>文档：</label>
                        <input type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files[0])} />
                    </div>
                    <div>
                        <label>页码范围：</label>
                        <input
                            type="number"
                            value={pageRange.start}
                            onChange={(e) => setPageRange({ ...pageRange, start: parseInt(e.target.value) || 1 })}
                            style={{ width: '60px', padding: '4px' }}
                        />
                        ~
                        <input
                            type="number"
                            value={pageRange.end}
                            onChange={(e) => setPageRange({ ...pageRange, end: parseInt(e.target.value) || 1 })}
                            style={{ width: '60px', padding: '4px' }}
                        />
                    </div>
                    <div>
                        <label>题目标记：</label>
                        <input
                            type="text"
                            value={questionPattern}
                            onChange={(e) => setQuestionPattern(e.target.value)}
                            placeholder="如：练习（留空则自动识别数字）"
                            style={{ width: '150px', padding: '4px 8px' }}
                        />
                    </div>
                    <div>
                        <label>答案标记：</label>
                        <input
                            type="text"
                            value={answerMarker}
                            onChange={(e) => setAnswerMarker(e.target.value)}
                            placeholder="如：【答案】"
                            style={{ width: '120px', padding: '4px 8px' }}
                        />
                    </div>
                    <div>
                        <label>解析标记：</label>
                        <input
                            type="text"
                            value={analysisMarker}
                            onChange={(e) => setAnalysisMarker(e.target.value)}
                            placeholder="如：【解析】（选填）"
                            style={{ width: '120px', padding: '4px 8px' }}
                        />
                    </div>
                    <button
                        onClick={parseDocument}
                        disabled={parsing}
                        style={{ padding: '6px 16px', background: '#fa8c16', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {parsing ? '解析中...' : '📄 解析文档'}
                    </button>
                </div>
            </div>

            {/* 题目列表 */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>题目列表 ({questions.length} 题)</h3>
                    <button onClick={addQuestion} style={{ padding: '6px 16px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        + 添加题目
                    </button>
                </div>

                {questions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#999', border: '1px dashed #ccc', borderRadius: '8px' }}>
                        点击「添加题目」开始录入，或使用「解析文档」自动提取
                    </div>
                ) : (
                    <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                        {questions.map((q, idx) => (
                            <div key={q.id} style={{
                                border: '1px solid #e8e8e8',
                                borderRadius: '8px',
                                padding: '16px',
                                marginBottom: '16px',
                                background: '#fafafa'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <strong>题目 {idx + 1}</strong>
                                    <button onClick={() => deleteQuestion(q.id)} style={{ color: '#f5222d', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        删除
                                    </button>
                                </div>
                                
                                {/* AI 助教工具栏 */}
                                <AIAssistantToolbar questionId={q.id} />
                                
                                <div style={{ marginBottom: '12px' }}>
                                    <label>题目内容：</label>
                                    <textarea
                                        value={q.content}
                                        onChange={(e) => updateQuestion(q.id, 'content', e.target.value)}
                                        rows={3}
                                        style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        placeholder="输入题目内容..."
                                    />
                                </div>
                                
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                    <div>
                                        <label>题型：</label>
                                        <select value={q.type} onChange={(e) => updateQuestion(q.id, 'type', e.target.value)}>
                                            <option value="fill">填空题</option>
                                            <option value="choice">选择题</option>
                                            <option value="qa">问答题</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>答案格式：</label>
                                        <input
                                            type="text"
                                            value={q.answerFormat}
                                            onChange={(e) => updateQuestion(q.id, 'answerFormat', e.target.value)}
                                            style={{ width: '120px', padding: '4px 8px' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label>资料原答案：</label>
                                        <input
                                            type="text"
                                            value={q.sourceAnswer}
                                            onChange={(e) => updateQuestion(q.id, 'sourceAnswer', e.target.value)}
                                            style={{ width: '100%', padding: '4px 8px' }}
                                            placeholder="从资料中提取的原始答案"
                                        />
                                    </div>
                                </div>

                                {/* AI 验证区域 */}
                                <div style={{
                                    background: '#f0f7ff',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <strong>🤖 AI 验证</strong>
                                        <button
                                            onClick={() => validateQuestion(q)}
                                            disabled={loading}
                                            style={{ padding: '4px 12px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            验证
                                        </button>
                                    </div>
                                    {q.aiAnswers && Object.keys(q.aiAnswers).length > 0 && (
                                        <div>
                                            {Object.entries(q.aiAnswers).map(([model, answer]) => (
                                                <div key={model} style={{ fontSize: '13px', marginBottom: '4px' }}>
                                                    <strong>{model}:</strong> {answer}
                                                </div>
                                            ))}
                                            <div style={{ marginTop: '8px', fontWeight: 'bold', color: '#fa8c16' }}>
                                                🤖 AI建议答案: {q.aiSuggestedAnswer || '未验证'}
                                            </div>
                                            <div style={{ marginTop: '4px', fontWeight: 'bold', color: q.verdict === 'correct' ? '#52c41a' : '#fa8c16' }}>
                                                投票结果: {
                                                    q.verdict === 'correct' ? '✅ 全部正确' :
                                                    q.verdict === 'maybe_correct' ? '⚠️ 多数正确' : '❌ 答案有误'
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#1890ff' }}>
                                        最终答案 <span style={{ color: '#f5222d' }}>*</span>：
                                    </label>
                                    <input
                                        type="text"
                                        value={q.finalAnswer}
                                        onChange={(e) => updateQuestion(q.id, 'finalAnswer', e.target.value)}
                                        style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '2px solid #1890ff' }}
                                        placeholder="请手动确认后填写正确答案（必填）"
                                    />
                                    {q.aiSuggestedAnswer && !q.finalAnswer && (
                                        <div style={{ fontSize: '12px', color: '#fa8c16', marginTop: '4px' }}>
                                            💡 提示：AI建议答案为「{q.aiSuggestedAnswer}」，可参考填写
                                        </div>
                                    )}
                                </div>
                                
                                <div>
                                    <label>解析：</label>
                                    <textarea
                                        value={q.analysis}
                                        onChange={(e) => updateQuestion(q.id, 'analysis', e.target.value)}
                                        rows={2}
                                        style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        placeholder="答案解析..."
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 图文识别弹窗 */}
            {showTextOcrModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        background: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        width: '500px',
                        maxWidth: '90%'
                    }}>
                        <h4>识别结果</h4>
                        <textarea
                            value={textOcrContent}
                            onChange={(e) => setTextOcrContent(e.target.value)}
                            rows={8}
                            style={{ width: '100%', padding: '8px', marginBottom: '12px' }}
                        />
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowTextOcrModal(false)}>取消</button>
                            <button onClick={insertTextOcrToQuestion} style={{ background: '#1890ff', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                                插入到题目
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 底部按钮 - 明确区分导出和保存 */}
            <div style={{ 
                display: 'flex', 
                gap: '16px', 
                justifyContent: 'flex-end', 
                borderTop: '1px solid #eee', 
                paddingTop: '20px',
                marginTop: '20px'
            }}>
                <div style={{ flex: 1, fontSize: '12px', color: '#666' }}>
                    💡 操作流程：导出JSON → 手动修改 finalAnswer → 保存到答案库
                </div>
                <button
                    onClick={validateAll}
                    disabled={bulkValidating || questions.length === 0}
                    style={{ padding: '10px 20px', background: '#52c41a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    {bulkValidating ? '验证中...' : '批量 AI 验证'}
                </button>
                <button
                    onClick={exportToJson}
                    disabled={questions.length === 0}
                    style={{ padding: '10px 20px', background: '#fa8c16', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    📤 第一步：导出 JSON（供检查修改）
                </button>
                <button
                    onClick={saveQuestionBank}
                    disabled={!topicName || questions.length === 0}
                    style={{ padding: '10px 20px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    💾 第二步：保存到答案库（确认后）
                </button>
            </div>
        </div>
    );
}

export default DataImport;