import { useState, useEffect } from 'react';
import axios from 'axios';
import TextCorrectionModal from './TextCorrectionModal';
import TextEditorWithShortcuts from './DataImport/TextEditorWithShortcuts';
import AnswerEditor from './DataImport/AnswerEditor';
import {
    detectQuestionType,
    detectSpecificQuestionType,
    extractTopicFromFilename,
    getModelColor,
    getModelNickname,
    makeAIReferenceTitle,
    makeSafeFileName
} from './DataImport/dataImportUtils';

function DataImport() {
    const [collectionMode, setCollectionMode] = useState('question');
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
    
    // 文本校正弹窗状态
    const [showCorrectionModal, setShowCorrectionModal] = useState(false);
    const [rawPagesText, setRawPagesText] = useState('');
    const [currentPageRange, setCurrentPageRange] = useState({ start: 1, end: 1 });
    const [tempFile, setTempFile] = useState(null);
    
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
    
    // ========== 新增：AI验证提示词编辑弹窗 ==========
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [currentValidatingQuestion, setCurrentValidatingQuestion] = useState(null);
    const [validationPrompt, setValidationPrompt] = useState('');
    const [detectedInfo, setDetectedInfo] = useState({ subject: '', questionType: '', specificType: '', typeLabel: '' });
    const [isBatchValidation, setIsBatchValidation] = useState(false);
    const [batchQuestions, setBatchQuestions] = useState([]);
    const [batchCurrentIndex, setBatchCurrentIndex] = useState(0);
    
    // ========== 新增：答案编辑器弹窗 ==========
    const [showAnswerEditor, setShowAnswerEditor] = useState(false);
    const [editingAnswerQuestion, setEditingAnswerQuestion] = useState(null);
    const [knowledgeFile, setKnowledgeFile] = useState(null);
    const [knowledgePageRange, setKnowledgePageRange] = useState({ start: 1, end: 1 });
    const [knowledgeRawText, setKnowledgeRawText] = useState('');
    const [knowledgeJsonDraft, setKnowledgeJsonDraft] = useState('');
    const [knowledgeLoading, setKnowledgeLoading] = useState(false);
    const [lastCorrectedText, setLastCorrectedText] = useState('');
    const [knowledgeJsonFile, setKnowledgeJsonFile] = useState(null);
    const [questionBankJsonFile, setQuestionBankJsonFile] = useState(null);
    const [clearKnowledgeBeforeImport, setClearKnowledgeBeforeImport] = useState(false);
    const [knowledgeJsonPreview, setKnowledgeJsonPreview] = useState(null);
    const [questionBankJsonPreview, setQuestionBankJsonPreview] = useState(null);
    const [jsonPreviewError, setJsonPreviewError] = useState('');
    const [mappingLoading, setMappingLoading] = useState(false);
    const [mappingExportsPreview, setMappingExportsPreview] = useState(null);
    const [mappingCsvFile, setMappingCsvFile] = useState(null);
    const [mappingImportSubject, setMappingImportSubject] = useState('all');
    const [resetMappingBeforeImport, setResetMappingBeforeImport] = useState(true);
    const [mappingDryRun, setMappingDryRun] = useState(false);
    const [examImportLoading, setExamImportLoading] = useState(false);
    const [examGapsLoading, setExamGapsLoading] = useState(false);

    // ========== 根据学科+题型生成精准提示词 ==========
    const generatePrecisePrompt = (subject, questionType, specificType, topicName, content, questionNumber) => {
        const subjectName = getSubjectLabel();

        let prompt = `你是上海春考${subjectName}阅卷老师。`;

        prompt += `\n\n【输出格式要求】`;
        prompt += `\n1. 每道题的答案格式为：题号 + 冒号 + 空格 + 答案`;
        prompt += `\n2. 例如："练习1: D" 或 "第2题: B"`;
        prompt += `\n3. 不要输出多余的空格或换行`;
        prompt += `\n4. 不要输出解释或分析过程`;

        if (specificType === 'choice') {
            prompt += `\n\n这是一道选择题。答案格式：题号: 选项字母`;
        } else if (specificType === 'recite') {
            prompt += `\n\n这是一道名句默写题。答案格式：题号: 答案内容`;
        } else if (specificType === 'fill') {
            prompt += `\n\n这是一道填空题。答案格式：题号: 答案内容`;
        }

        // 传递题号，但不传递完整题目内容（避免重复）
        prompt += `\n\n【题目编号】\n${questionNumber}`;
        prompt += `\n\n【题目内容】\n${content}`;
        prompt += `\n\n请按格式输出答案：`;

        return prompt;
    };

    useEffect(() => {
        if (answerMarker.includes('ã€')) setAnswerMarker('【答案】');
        if (analysisMarker.includes('ã€')) setAnalysisMarker('【解析】');
    }, []);

    useEffect(() => {
        if (collectionMode === 'mapping') {
            loadMappingExportsPreview();
        }
    }, [collectionMode]);

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

    const getActualSubject = () => {
        if (subject === 'custom') {
            return customSubject || 'custom';
        }
        return subject;
    };

    const getActualVersion = () => {
        if (version === 'custom') {
            return customVersion || 'custom';
        }
        return version;
    };

    const getSubjectLabel = () => {
        const actualSubject = getActualSubject();
        return subjectNames[actualSubject] || actualSubject;
    };

    const getPreferredKnowledgeModel = () => {
        const actualSubject = getActualSubject();
        if (actualSubject === 'math') {
            return localStorage.getItem('math_model_pro') || 'qwen2.5:14b';
        }
        if (actualSubject === 'english') {
            return localStorage.getItem('english_model_pro') || 'qwen2.5:14b';
        }
        return localStorage.getItem('chinese_model_pro') || 'qwen2.5:14b';
    };

    const extractJsonBlock = (text) => {
        const value = String(text || '').trim();
        const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
        return (fenced ? fenced[1] : value).trim();
    };

    const readJsonFile = (selectedFile) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                resolve(JSON.parse(String(reader.result || '')));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
        reader.readAsText(selectedFile, 'utf-8');
    });

    const summarizeKnowledgeJson = (data, selectedFile) => {
        const system = data?.考点体系 || {};
        const analysis = data?.命题分析 || {};
        return {
            fileName: selectedFile.name,
            title: data?.专题 || selectedFile.name.replace(/\.json$/i, ''),
            checkpointCount: Object.keys(system).length,
            analysisCount: Object.keys(analysis).length,
            sampleItems: Object.keys(system).slice(0, 6)
        };
    };

    const summarizeQuestionBankJson = (data, selectedFile) => {
        const bank = data?.bank || data?.questionBank || data || {};
        const sections = Array.isArray(bank.sections) ? bank.sections : [];
        const questionsList = Array.isArray(bank.questions)
            ? bank.questions
            : Array.isArray(bank.items)
                ? bank.items
                : sections.flatMap(section => section.questions || []);
        const examInfo = bank.exam_info || bank.examInfo || {};
        return {
            fileName: selectedFile.name,
            title: bank.title || bank.name || bank.paperTitle || examInfo.title || selectedFile.name.replace(/\.json$/i, ''),
            subject: bank.subject || bank.subjectId || bank.subject_id || (String(examInfo.title || '').includes('数学') ? 'math' : '-'),
            version: bank.version || bank.versionId || bank.version_id || '-',
            year: bank.year || examInfo.year || '-',
            questionCount: questionsList.length,
            sampleItems: questionsList.slice(0, 5).map((q, index) => `${q.number || index + 1}. ${String(q.content || q.question || q.stem || '').slice(0, 36)}`)
        };
    };

    const getValidationModels = () => {
        const actualSubject = getActualSubject();
        if (actualSubject === 'chinese') {
          return [
            localStorage.getItem('chinese_model_fast') || 'qwen2.5:7b',
            localStorage.getItem('chinese_model_pro') || 'qwen2.5:14b',
            localStorage.getItem('chinese_model_reference') || 'glm4:9b'
          ];
        }
        if (actualSubject === 'math') {
            return [
                localStorage.getItem('math_model_fast') || 'qwen2.5:7b',
                localStorage.getItem('math_model_pro') || 'qwen2.5:14b',
                localStorage.getItem('math_model_reference') || 'qwen2.5-coder-fast'
            ];
        }
        return ['qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5-coder-fast'];
    };

    const getAISuggestedAnswer = (answers) => {
        const cleanAnswer = (answer) => {
            if (!answer) return '';
            // 移除题号
            let cleaned = answer.replace(/^练习\s*\d+\s*[：:]\s*/g, '');
            cleaned = cleaned.replace(/^第\s*\d+\s*题\s*[：:]\s*/g, '');
            // 提取选择题答案
            const match = cleaned.match(/^([A-D])[\.、\s]/);
            if (match) return match[1];
            return cleaned.trim();
        };

        const values = Object.values(answers || {})
            .map(a => cleanAnswer(a))
            .filter(a => a && !a.startsWith('错误'));

        const counts = {};
        values.forEach(answer => {
            counts[answer] = (counts[answer] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    };

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

    const renderModeSwitcher = () => (
        <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            background: '#f5f5f5',
            padding: '8px',
            borderRadius: '8px',
            width: 'fit-content'
        }}>
            <button
                onClick={() => setCollectionMode('knowledge')}
                style={{
                    padding: '8px 16px',
                    background: collectionMode === 'knowledge' ? '#1890ff' : 'white',
                    color: collectionMode === 'knowledge' ? 'white' : '#333',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}
            >
                知识点采集
            </button>
            <button
                onClick={() => setCollectionMode('question')}
                style={{
                    padding: '8px 16px',
                    background: collectionMode === 'question' ? '#1890ff' : 'white',
                    color: collectionMode === 'question' ? 'white' : '#333',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}
            >
                题库采集
            </button>
            <button
                onClick={importAllExamBanks}
                disabled={examImportLoading}
                style={{
                    padding: '8px 16px',
                    background: examImportLoading ? '#ccc' : '#fa8c16',
                    color: 'white',
                    border: '1px solid #fa8c16',
                    borderRadius: '6px',
                    cursor: examImportLoading ? 'not-allowed' : 'pointer'
                }}
                title="递归导入 data/exams 下全部 qwen*.json，并补全 final_answer、score、difficulty"
            >
                {examImportLoading ? '导入中...' : '一键导入真题库'}
            </button>
            <button
                onClick={completeExamGaps}
                disabled={examGapsLoading || examImportLoading}
                style={{
                    padding: '8px 16px',
                    background: examGapsLoading ? '#ccc' : '#722ed1',
                    color: 'white',
                    border: '1px solid #722ed1',
                    borderRadius: '6px',
                    cursor: examGapsLoading || examImportLoading ? 'not-allowed' : 'pointer'
                }}
                title="补全 final_answer/score/difficulty，并生成导入知识点映射（需本地 Ollama，千题约 20-40 分钟）"
            >
                {examGapsLoading ? '补全中...' : '缺失值补全'}
            </button>
            <button
                onClick={() => setCollectionMode('mapping')}
                style={{
                    padding: '8px 16px',
                    background: collectionMode === 'mapping' ? '#1890ff' : 'white',
                    color: collectionMode === 'mapping' ? 'white' : '#333',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}
            >
                知识点题库映射
            </button>
        </div>
    );

    const extractKnowledgeText = async () => {
        if (!knowledgeFile) {
            alert('请先选择知识点资料文件');
            return;
        }

        setKnowledgeLoading(true);
        const formData = new FormData();
        formData.append('file', knowledgeFile);
        formData.append('pageStart', knowledgePageRange.start);
        formData.append('pageEnd', knowledgePageRange.end);

        try {
            const response = await axios.post('http://localhost:3001/api/docs/extract-raw', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const text = response.data.text || '';
                setKnowledgeRawText(text);
                alert(`已提取 ${text.length} 字符，可继续生成知识点 JSON 草稿。`);
            } else {
                alert('提取失败');
            }
        } catch (error) {
            console.error('知识点资料提取失败:', error);
            alert('提取失败: ' + (error.response?.data?.error || error.message));
        } finally {
            setKnowledgeLoading(false);
        }
    };

    const generateKnowledgeJson = async () => {
        if (!knowledgeRawText.trim()) {
            alert('请先抽取资料文本');
            return;
        }

        const prompt = `你是上海春考${getSubjectLabel()}资料整理老师。请阅读下面资料，归纳知识点、考点、历史数据、命题分析，并只输出合法 JSON，不要输出 Markdown 解释。

重要要求：
1. 必须完整提取资料中的“年份/分值/考点/篇目”表格，逐行写入 examHistory，不要只抽样。
2. 必须完整提取“春考考查篇目”清单，按册别分组写入 requiredTexts，不要遗漏篇目、作者、朝代。
3. 必须保留资料中提到的高频篇目、易错字词、直接默写、情景默写、文学常识、文化常识等考点。
4. 如果出现“考点一/考点二/考点三”以及其下的“1./2./3.”编号小点，必须保留层级：
   - “考点一 直接默写”作为 knowledgePoints 的一项；
   - 其下“注意生僻难写易混易错字”“注意同音异义词”“注意形似词、同义异形词”必须逐条写入 subPoints；
   - “考点二 情景默写”下的“注意审清题干”“注意对句子的理解”“注意牢固掌握名篇中的名句”“注意情感相似、手法相似、观点相似相异的句子”也必须逐条写入 subPoints。
5. 不要只把编号小点合并成 examFocus；subPoints 必须保存讲解、典例、答案、易错字词、高频句等细节。
6. 如果资料中某项信息没有出现，用空数组或 null，不要编造。
7. 输出必须是一个可被 JSON.parse 解析的 JSON 对象。
8. 输出前自检：资料中每个“考点”下有几个编号小点，JSON 中对应 knowledgePoint.subPoints 就必须有几个条目。

JSON 结构如下：
{
  "subject": "${getActualSubject()}",
  "version": "${getActualVersion()}",
  "topicTitle": "${topicName || ''}",
  "sourceFile": "${knowledgeFile?.name || ''}",
  "examHistory": [
    {
      "year": 2025,
      "score": 5,
      "questionType": "填空",
      "examPoint": "识记默写·作家作品",
      "texts": ["《论语》", "《阿房宫赋》", "《梦游天姥吟留别》"],
      "note": "来自命题分析表"
    }
  ],
  "requiredTexts": [
    {
      "book": "必修上册",
      "count": 8,
      "items": [
        { "title": "《登高》", "author": "杜甫", "dynasty": "唐", "note": "" }
      ]
    }
  ],
  "knowledgePoints": [
    {
      "name": "知识点名称",
      "category": "知识大类",
      "description": "一句话说明",
      "examFocus": ["常考角度1", "常考角度2"],
      "subPoints": [
        {
          "name": "子考点名称，例如注意生僻难写易混易错字",
          "explanation": "资料中的讲解摘要",
          "examples": [
            {
              "sourceText": "例题涉及的篇目或题干",
              "question": "题干或考查句",
              "answer": "答案，若资料提供",
              "analysis": "资料中的说明或解题提醒"
            }
          ],
          "commonErrors": ["谗谄", "蔽明"],
          "highFrequencySentences": ["信而见疑，忠而被谤，能无怨乎？"],
          "evidence": [
            { "page": null, "text": "资料中的原文依据" }
          ]
        }
      ],
      "history": [
        { "year": 2024, "questionNumber": "题号或空", "score": null, "note": "出现方式" }
      ],
      "evidence": [
        { "page": null, "text": "资料中的关键依据或摘要" }
      ]
    }
  ],
  "examInsights": [
    {
      "title": "命题分析标题",
      "summary": "分析内容",
      "relatedKnowledgePoints": ["知识点名称"]
    }
  ],
  "needsReview": ["需要人工确认的问题"]
}

资料文本：
${knowledgeRawText.slice(0, 12000)}`;

        setKnowledgeLoading(true);
        try {
            const response = await axios.post('http://localhost:3001/api/ai/ask', {
                subject: getActualSubject(),
                question: prompt,
                model: getPreferredKnowledgeModel(),
                temperature: 0.1,
                numPredict: 6144
            });

            if (response.data.success) {
                setKnowledgeJsonDraft(extractJsonBlock(response.data.answer));
            } else {
                alert('生成失败: ' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('知识点 JSON 生成失败:', error);
            alert('生成失败: ' + (error.response?.data?.error || error.message));
        } finally {
            setKnowledgeLoading(false);
        }
    };

    const saveKnowledgeToDb = async () => {
        if (!knowledgeJsonDraft || !knowledgeJsonDraft.trim()) {
            alert('当前没有知识点 JSON 草稿，请先生成或粘贴后再保存');
            return;
        }
        if (!topicName || !topicName.trim()) {
            alert('请先填写资料主题（专题名称）');
            return;
        }

        if (!window.confirm(`将把当前知识点 JSON 草稿保存到知识库：\n专题: ${topicName}\n学科: ${getActualSubject()}\n确定继续？`)) return;

        setKnowledgeLoading(true);
        try {
            const parsed = JSON.parse(knowledgeJsonDraft);
            const response = await axios.post('http://localhost:3001/api/knowledge/save', {
                subject: getActualSubject(),
                version: getActualVersion(),
                topicTitle: topicName,
                json: parsed
            });
            if (response.data.success) {
                alert('已保存知识点草稿到知识库: ' + response.data.topicId);
            } else {
                alert('保存失败: ' + (response.data.error || '未知错误'));
            }
        } catch (err) {
            console.error('保存知识点失败:', err);
            alert('保存失败: ' + (err.response?.data?.error || err.message || err));
        } finally {
            setKnowledgeLoading(false);
        }
    };

    const importKnowledgeJsonFile = async () => {
        if (!knowledgeJsonFile) {
            alert('请先选择知识点 JSON 文件');
            return;
        }
        if (!knowledgeJsonPreview) {
            alert('请先预览并确认 JSON 内容');
            return;
        }

        const formData = new FormData();
        formData.append('file', knowledgeJsonFile);
        formData.append('subject', getActualSubject());
        formData.append('version', getActualVersion());
        formData.append('clearExisting', clearKnowledgeBeforeImport ? 'true' : 'false');

        setKnowledgeLoading(true);
        try {
            const response = await axios.post('http://localhost:3001/api/knowledge/import-json', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                const summary = response.data.summary || {};
                const skipped = response.data.skipped_files || 0;
                alert(`知识库 JSON 导入完成\n导入文件: ${response.data.imported_files || 0}\n跳过文件: ${skipped}\n专题数: ${summary.topics ?? '-'}\n知识点数: ${summary.knowledge_points ?? '-'}`);
                if (skipped > 0) {
                    console.warn('知识库 JSON 导入跳过项:', response.data.skipped);
                }
            } else {
                alert('导入失败: ' + (response.data.error || '未知错误'));
            }
        } catch (err) {
            console.error('导入知识库 JSON 失败:', err);
            alert('导入失败: ' + (err.response?.data?.error || err.message || err));
        } finally {
            setKnowledgeLoading(false);
        }
    };

    const importQuestionBankJsonFile = async () => {
        if (!questionBankJsonFile) {
            alert('请先选择题库 JSON 文件');
            return;
        }
        if (!questionBankJsonPreview) {
            alert('请先预览并确认 JSON 内容');
            return;
        }

        const formData = new FormData();
        formData.append('file', questionBankJsonFile);

        setParsing(true);
        try {
            const response = await axios.post('http://localhost:3001/api/banks/import-json', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                alert(`题库 JSON 导入完成\n题库: ${response.data.title}\n题目数: ${response.data.totalQuestions}\nID: ${response.data.bankId}`);
                loadBanks();
            } else {
                alert('导入失败: ' + (response.data.error || '未知错误'));
            }
        } catch (err) {
            console.error('导入题库 JSON 失败:', err);
            alert('导入失败: ' + (err.response?.data?.error || err.message || err));
        } finally {
            setParsing(false);
        }
    };

    const formatExamImportResult = (data) => {
        const lines = [
            `扫描文件: ${data.scanned ?? 0}`,
            `导入成功: ${data.imported ?? 0}`,
            `导入失败: ${data.failed ?? 0}`,
        ];
        if (data.db) {
            lines.push(`数据库题目: ${data.db.questions ?? 0}`);
        }
        if (data.enrich) {
            lines.push(
                `补全 final_answer: ${data.enrich.final_answer_updated ?? 0}`,
                `补全 score: ${data.enrich.score_updated ?? 0}`,
                `LLM 评估 difficulty: ${data.enrich.difficulty?.updated ?? 0}（规则兜底 ${data.enrich.difficulty?.fallback ?? 0}）`
            );
        }
        if (data.audit) {
            lines.push(
                `仍缺失 final_answer: ${data.audit.missing_final_answer ?? 0}`,
                `仍缺失 score: ${data.audit.missing_score ?? 0}`,
                `仍缺失 difficulty: ${data.audit.missing_difficulty ?? 0}`
            );
        }
        return lines.join('\n');
    };

    const importAllExamBanks = async () => {
        if (!window.confirm(
            '将递归导入 data/exams 下语文/数学/英语全部 qwen*.json 真题到 SQLite。\n\n'
            + '导入后会自动：\n'
            + '1. 用 JSON 中的 answer 填充 final_answer\n'
            + '2. 用 JSON 中的 score 补全分值（缺失时按整卷/大题分配）\n'
            + '3. 调用本地 Ollama 评估 difficulty（千题量级可能需 20-40 分钟，失败项会用规则兜底）\n\n'
            + '确定继续？'
        )) {
            return;
        }

        setExamImportLoading(true);
        try {
            const response = await axios.post('http://localhost:3001/api/banks/import-all-exams', {}, {
                timeout: 0
            });
            if (response.data.success) {
                alert(`真题库导入完成\n${formatExamImportResult(response.data)}`);
                loadBanks();
                if (collectionMode === 'mapping') {
                    loadMappingExportsPreview();
                }
            } else {
                alert('导入失败: ' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('一键导入真题库失败:', error);
            alert('导入失败: ' + (error.response?.data?.error || error.message));
        } finally {
            setExamImportLoading(false);
        }
    };

    const formatCompleteGapsResult = (data) => {
        const lines = [];
        const enrich = data.enrich || {};
        const diff = enrich.difficulty || {};
        lines.push(
            `补全 final_answer: ${enrich.final_answer_updated ?? 0}`,
            `补全 score: ${enrich.score_updated ?? 0}`,
            `难度评估: ${diff.updated ?? 0}（Ollama ${diff.llm_ok ?? 0}，规则兜底 ${diff.fallback ?? 0}）`
        );
        const mapping = data.mapping || {};
        const dbSummary = mapping.db_summary || {};
        if (dbSummary.link_count != null) {
            lines.push(
                `知识点映射: ${dbSummary.link_count ?? 0} 条`,
                `已关联题目: ${dbSummary.linked_question_count ?? 0} / ${dbSummary.question_count ?? 0}`
            );
        }
        const audit = data.audit || {};
        lines.push(
            `仍缺 final_answer: ${audit.missing_final_answer ?? 0}`,
            `仍缺 score: ${audit.missing_score ?? 0}`,
            `仍缺 difficulty: ${audit.missing_difficulty ?? 0}`
        );
        return lines.join('\n');
    };

    const completeExamGaps = async () => {
        if (!window.confirm(
            '将对当前 SQLite 真题库执行：\n\n'
            + '1. 从 JSON 补全 final_answer、score\n'
            + '2. 清空并用 Ollama 重新评估 difficulty（使用本机已安装模型）\n'
            + '3. 生成并导入题目-知识点映射 CSV，并用规则补充未命中题\n\n'
            + '约 1039 题 × Ollama 可能需 20-60 分钟，请保持 ollama serve 运行。\n\n'
            + '确定继续？'
        )) {
            return;
        }

        setExamGapsLoading(true);
        try {
            const response = await axios.post('http://localhost:3001/api/banks/complete-exam-gaps', {
                forceDifficulty: true
            }, { timeout: 0 });
            if (response.data.success) {
                alert(`缺失值补全完成\n${formatCompleteGapsResult(response.data)}`);
                loadBanks();
                loadMappingExportsPreview();
            } else {
                alert('补全失败: ' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('缺失值补全失败:', error);
            alert('补全失败: ' + (error.response?.data?.error || error.message));
        } finally {
            setExamGapsLoading(false);
        }
    };

    const loadMappingExportsPreview = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/knowledge/kp-mapping/exports');
            if (response.data.success) {
                setMappingExportsPreview(response.data);
            }
        } catch (error) {
            console.error('加载映射 CSV 预览失败:', error);
        }
    };

    const formatMappingImportResult = (data) => {
        const summary = data.summary || data;
        return [
            `写入关联: ${summary.links_inserted ?? data.links_inserted ?? 0}`,
            `覆盖题目: ${summary.questions_touched ?? data.questions_touched ?? 0}`,
            `跳过无效题目: ${summary.skipped_missing_question ?? data.skipped_missing_question ?? 0}`,
            `跳过无效知识点: ${summary.skipped_missing_knowledge_point ?? data.skipped_missing_knowledge_point ?? 0}`,
            summary.linked_questions_in_db
                ? `库内当前: ${summary.linked_questions_in_db.total_links ?? 0} 条映射 / ${summary.linked_questions_in_db.distinct_questions ?? 0} 道题`
                : null
        ].filter(Boolean).join('\n');
    };

    const importMappingFromExports = async () => {
        const subjectLabel = mappingImportSubject === 'all'
            ? '语文、数学、英语三门'
            : ({ chinese: '语文', math: '数学', english: '英语' }[mappingImportSubject] || mappingImportSubject);
        const actionLabel = mappingDryRun ? '试运行校验' : '导入';
        if (!window.confirm(`${actionLabel} data/exports 下的映射 CSV（${subjectLabel}）？${resetMappingBeforeImport && !mappingDryRun ? '\n将先清空对应学科的已有映射。' : ''}`)) {
            return;
        }

        setMappingLoading(true);
        try {
            const response = await axios.post('http://localhost:3001/api/knowledge/import-kp-mapping-csv', {
                subject: mappingImportSubject === 'all' ? undefined : mappingImportSubject,
                reset: resetMappingBeforeImport,
                dryRun: mappingDryRun
            });
            if (response.data.success) {
                alert(`${mappingDryRun ? '校验完成' : '映射导入完成'}\n${formatMappingImportResult(response.data)}`);
                await loadMappingExportsPreview();
            } else {
                alert(`${actionLabel}失败: ` + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('导入映射 CSV 失败:', error);
            alert(`${actionLabel}失败: ` + (error.response?.data?.error || error.message));
        } finally {
            setMappingLoading(false);
        }
    };

    const importMappingCsvUpload = async () => {
        if (!mappingCsvFile) {
            alert('请先选择映射 CSV 文件');
            return;
        }

        const formData = new FormData();
        formData.append('file', mappingCsvFile);
        formData.append('reset', resetMappingBeforeImport ? 'true' : 'false');
        formData.append('dryRun', mappingDryRun ? 'true' : 'false');
        if (mappingImportSubject !== 'all') {
            formData.append('subject', mappingImportSubject);
        }

        setMappingLoading(true);
        try {
            const response = await axios.post('http://localhost:3001/api/knowledge/import-kp-mapping-csv/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                alert(`${mappingDryRun ? '校验完成' : '映射导入完成'}\n${formatMappingImportResult(response.data)}`);
                await loadMappingExportsPreview();
            } else {
                alert('导入失败: ' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('上传映射 CSV 失败:', error);
            alert('导入失败: ' + (error.response?.data?.error || error.message));
        } finally {
            setMappingLoading(false);
        }
    };

    const previewKnowledgeJsonFile = async (selectedFile) => {
        setKnowledgeJsonFile(selectedFile);
        setKnowledgeJsonPreview(null);
        setJsonPreviewError('');
        if (!selectedFile) return;

        try {
            const parsed = await readJsonFile(selectedFile);
            setKnowledgeJsonPreview(summarizeKnowledgeJson(parsed, selectedFile));
        } catch (error) {
            setJsonPreviewError(`知识库 JSON 解析失败：${error.message}`);
        }
    };

    const previewQuestionBankJsonFile = async (selectedFile) => {
        setQuestionBankJsonFile(selectedFile);
        setQuestionBankJsonPreview(null);
        setJsonPreviewError('');
        if (!selectedFile) return;

        try {
            const parsed = await readJsonFile(selectedFile);
            setQuestionBankJsonPreview(summarizeQuestionBankJson(parsed, selectedFile));
        } catch (error) {
            setJsonPreviewError(`题库 JSON 解析失败：${error.message}`);
        }
    };

    const renderJsonImportPanel = ({
        title,
        description,
        file,
        preview,
        onFileChange,
        onImport,
        disabled,
        accent = '#13c2c2',
        extraControls = null
    }) => (
        <div style={{
            border: `1px solid ${accent}`,
            background: preview ? '#f6fffb' : '#e6fffb',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            boxShadow: '0 2px 8px rgba(19, 194, 194, 0.12)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#006d75' }}>{title}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{description}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 360px', minWidth: 0 }}>
                    <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                        style={{ maxWidth: '260px' }}
                    />
                    {extraControls}
                    <button
                        onClick={onImport}
                        disabled={disabled || !file || !preview}
                        style={{ padding: '6px 16px', background: file && preview && !disabled ? accent : '#ccc', color: 'white', border: 'none', borderRadius: '4px', cursor: file && preview && !disabled ? 'pointer' : 'not-allowed' }}
                    >
                        确认导入数据库
                    </button>
                </div>
            </div>
            {file && !preview && !jsonPreviewError && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>正在准备预览...</div>
            )}
            {preview && (
                <div style={{ marginTop: '12px', padding: '10px', background: '#fff', borderRadius: '6px', border: '1px solid #e8e8e8' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', fontSize: '13px' }}>
                        <div><strong>文件：</strong>{preview.fileName}</div>
                        <div><strong>标题：</strong>{preview.title}</div>
                        {preview.subject && <div><strong>学科：</strong>{preview.subject}</div>}
                        {preview.version && <div><strong>版本：</strong>{preview.version}</div>}
                        {preview.year && <div><strong>年份：</strong>{preview.year}</div>}
                        {preview.checkpointCount !== undefined && <div><strong>考点：</strong>{preview.checkpointCount}</div>}
                        {preview.analysisCount !== undefined && <div><strong>命题分析：</strong>{preview.analysisCount}</div>}
                        {preview.questionCount !== undefined && <div><strong>题目：</strong>{preview.questionCount}</div>}
                    </div>
                    {preview.sampleItems?.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                            <strong>预览：</strong>{preview.sampleItems.join(' / ')}
                        </div>
                    )}
                </div>
            )}
            {jsonPreviewError && (
                <div style={{ marginTop: '10px', color: '#f5222d', fontSize: '12px' }}>{jsonPreviewError}</div>
            )}
        </div>
    );

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

    const uploadQuestionAsset = async (questionId, file, assetType = 'screenshot', pageNumber = null, bboxJson = null, description = '') => {
        if (!file) return;
        const actualSubject = getActualSubject();
        const paperId = editingBank || `${actualSubject}_${makeSafeFileName(topicName)}`;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('bankId', paperId);
        formData.append('questionId', `q${questions.findIndex(q => q.id === questionId) + 1}`);
        formData.append('assetType', assetType);
        if (pageNumber) formData.append('pageNumber', pageNumber);
        if (bboxJson) formData.append('bboxJson', JSON.stringify(bboxJson));
        if (description) formData.append('description', description);

        try {
            const res = await axios.post('http://localhost:3001/api/banks/upload-asset', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                alert('上传成功');
                // 可选地把 asset 信息写入本地问题状态（后续用于显示）
                const assetInfo = { id: res.data.assetId, filePath: res.data.filePath };
                setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, assets: [...(q.assets || []), assetInfo] } : q));
            } else {
                alert('上传失败: ' + (res.data.error || '未知错误'));
            }
        } catch (err) {
            console.error('upload asset failed', err);
            alert('上传失败: ' + (err.response?.data?.error || err.message));
        }
    };

    // 第一步：只提取原始文本，不解析
    const parseDocument = async () => {
        if (!file) {
            alert('请先选择文档');
            return;
        }

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

        try {
            // 使用新的 extract-raw 接口，只提取原始文本
            const response = await axios.post('http://localhost:3001/api/docs/extract-raw', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            console.log('=== 原始文本提取 ===');
            console.log('文本长度:', response.data.text?.length);

            if (response.data.success) {
                const fullText = response.data.text || '';
                setRawPagesText(fullText);
                setCurrentPageRange({ start: pageRange.start, end: pageRange.end });
                setTempFile(file);

                setTimeout(() => {
                    console.log('打开弹窗，rawPagesText 长度:', fullText.length);
                    setShowCorrectionModal(true);
                }, 100);

                alert(`文档解析完成！共提取 ${fullText.length} 字符，请在校正弹窗中标记题目、答案和解析格式。`);
            } else {
                alert('提取失败，请手动添加题目');
            }
        } catch (error) {
            console.error('提取失败:', error);
            alert('提取失败: ' + (error.response?.data?.error || error.message));
        }
        setParsing(false);
    };

    // 第二步：校正完成后，重新解析
    const handleCorrectionConfirm = async (correctionData) => {
        setShowCorrectionModal(false);
        setParsing(true);

        // 保存上次校正文本，供一键入库使用
        setLastCorrectedText(correctionData.correctedText || '');

        try {
            const response = await axios.post('http://localhost:3001/api/docs/parse-corrected', {
                correctedText: correctionData.correctedText,
                answerMarker: correctionData.answerMarker,
                analysisMarker: correctionData.analysisMarker,
                questionPattern: correctionData.questionPattern,
                pageStart: currentPageRange.start,
                pageEnd: currentPageRange.end
            });

            if (response.data.success && response.data.questions) {
                const questionsWithTypes = response.data.questions.map(q => ({
                    ...q,
                    type: detectQuestionType(q.content)
                }));

                // 自动导入到题目列表
                const newQuestions = questionsWithTypes.map((q, idx) => ({
                    id: Date.now() + idx,
                    page: q.page || currentPageRange.start,
                    number: idx + 1,
                    type: q.type || detectQuestionType(q.content),
                    content: q.content,
                    answerFormat: '【答案】',
                    sourceAnswer: q.sourceAnswer || '',
                    finalAnswer: '',
                    myAnswer: '',
                    peerAnswers: {},
                    aiAnswers: q.aiAnswers || {},
                    aiSuggestedAnswer: q.aiSuggestedAnswer || '',
                    verdict: q.verdict || null,
                    discussion: '',
                    analysis: q.analysis || ''
                }));

                // 直接设置题目列表（替换）
                setQuestions(newQuestions);
                setShowJsonEditor(false);

                alert(`解析成功！共 ${newQuestions.length} 道题目已自动导入`);
            } else {
                alert('解析失败，请手动添加题目');
            }
        } catch (error) {
            console.error('解析失败:', error);
            alert('解析失败: ' + (error.response?.data?.error || error.message));
        } finally {
            setParsing(false);
        }
    };

    const saveCorrectedToDb = async () => {
        if (!lastCorrectedText || !lastCorrectedText.trim()) {
            // 如果页面上已有题目，提供直接保存题库的回退路径
            if (questions && questions.length > 0) {
                if (!topicName || !topicName.trim()) {
                    alert('请先填写专题名称');
                    return;
                }
                if (!window.confirm(`当前没有校正文本，但页面已有 ${questions.length} 道题目。\n是否直接将这些题目保存为题库？`)) {
                    return;
                }
                // 复用现有保存题库逻辑
                await saveQuestionBank();
                return;
            }

            alert('没有可保存的校正文本，请先解析并校正文本后再保存入库');
            return;
        }

        if (!topicName || !topicName.trim()) {
            alert('请先填写专题名称');
            return;
        }

        const actualSubject = getActualSubject();
        const actualVersion = getActualVersion();
        const paperId = `${actualSubject}_${makeSafeFileName(topicName)}`;
        const title = makeAIReferenceTitle(topicName);

        if (!window.confirm(`将把当前校正后的文本解析并保存到题库：\n题库ID: ${paperId}\n题库标题: ${title}\n确定继续？`)) {
            return;
        }

        setParsing(true);
        try {
            const response = await axios.post('http://localhost:3001/api/docs/parse-corrected', {
                correctedText: lastCorrectedText,
                answerMarker,
                analysisMarker,
                questionPattern,
                pageStart: currentPageRange.start,
                pageEnd: currentPageRange.end,
                saveToDb: true,
                paperId,
                title,
                subject: actualSubject,
                version: actualVersion,
                topicName
            });

            if (response.data.success) {
                alert(`已保存到题库：${paperId}`);
                // 尝试加载刚保存的题库以便继续编辑
                try { loadBankForEdit(paperId); } catch (e) { /* ignore */ }
                loadBanks();
            } else {
                alert('保存失败: ' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('保存到题库失败:', error);
            alert('保存失败: ' + (error.response?.data?.error || error.message));
        } finally {
            setParsing(false);
        }
    };

    const importFromJson = () => {
        try {
            const imported = JSON.parse(jsonContent);
            const newQuestions = imported.map((q, idx) => ({
                id: Date.now() + idx,
                page: q.page || pageRange.start,
                number: idx + 1,  // 重新编号，从1开始
                type: q.type || detectQuestionType(q.content),
                content: q.content,
                answerFormat: '【答案】',
                sourceAnswer: q.sourceAnswer || q.answer || '',
                aiAnswers: q.aiAnswers || {},
                aiSuggestedAnswer: q.aiSuggestedAnswer || '',
                verdict: q.verdict || null,
                finalAnswer: '',
                analysis: q.analysis || ''
            }));

            // 修复：替换而不是追加
            setQuestions(newQuestions);
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
                    finalAnswer: q.finalAnswer || q.myAnswer || '',
                    myAnswer: q.myAnswer || '',
                    peerAnswers: q.peerAnswers || {},
                    discussion: q.discussion || '',
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
                finalAnswer: '',
                myAnswer: '',
                peerAnswers: {},
                aiAnswers: {},
                aiSuggestedAnswer: '',
                verdict: null,
                discussion: '',
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

    // ========== 修改：单题验证 - 弹出提示词编辑窗口 ==========
    const prepareValidation = (q) => {
        if (!q.content.trim()) {
            alert('请先填写题目内容');
            return;
        }

        // 提取题号（如"练习1"、"第2题"等）
        let questionNumber = '';
        const numberMatch = q.content.match(/^(练习\s*\d+|第\s*\d+\s*题)/);
        if (numberMatch) {
            questionNumber = numberMatch[1].replace(/\s+/g, '');
        } else {
            questionNumber = `题目${q.number}`;
        }

        // 清理内容中的题号（避免重复）
        let cleanContent = q.content.replace(/^(练习\s*\d+[：:]\s*|第\s*\d+\s*题[：:]\s*)/, '');

        const specific = detectSpecificQuestionType(q.content);
        const defaultPrompt = generatePrecisePrompt(
            getActualSubject(),
            q.type,
            specific.type,
            topicName,
            cleanContent,
            questionNumber
        );

        setCurrentValidatingQuestion(q);
        setDetectedInfo({
            subject: getSubjectLabel(),
            questionType: q.type === 'fill' ? '填空题' : q.type === 'choice' ? '选择题' : '问答题',
            specificType: specific.label,  // 显示"选择题"、"默写题"、"填空题"、"问答题"
            typeLabel: specific.label
        });
        setValidationPrompt(defaultPrompt);
        setIsBatchValidation(false);
        setShowPromptModal(true);
    };
    
    const executeValidation = async () => {
        if (!currentValidatingQuestion) return;

        setShowPromptModal(false);
        setLoading(true);

        try {
            const response = await axios.post('http://localhost:3001/api/ai/validate', {
                subject: getActualSubject(),
                question: currentValidatingQuestion.content,
                questionType: currentValidatingQuestion.type,
                instruction: validationPrompt,
                models: getValidationModels()
            });

            if (response.data.success) {
                const suggestedAnswer = response.data.suggestedAnswer || getAISuggestedAnswer(response.data.answers);
                const discussionText = `AI 讨论记录：\n${Object.entries(response.data.answers).map(([model, ans]) => `${getModelNickname(model)}: ${ans}`).join('\n')}\n综合判断：${response.data.verdict === 'correct' ? '答案正确' : response.data.verdict === 'maybe_correct' ? '可能正确' : '答案有误'}，建议答案：${suggestedAnswer}`;

                // 一次性更新所有字段
                setQuestions(prev => prev.map(q => {
                    if (q.id === currentValidatingQuestion.id) {
                        return {
                            ...q,
                            aiAnswers: response.data.answers,
                            verdict: response.data.verdict,
                            aiSuggestedAnswer: suggestedAnswer,
                            finalAnswer: suggestedAnswer,
                            discussion: discussionText,
                            peerAnswers: response.data.answers
                        };
                    }
                    return q;
                }));
                setAnswersReviewed(false);

                alert(`验证完成！\nAI建议答案：${suggestedAnswer || '未识别'}\n已自动填入「最终答案」和「讨论记录」，请核对修改。`);
            } else {
                alert('验证失败: ' + (response.data.error || '未知错误'));
            }
        } catch (error) {
            console.error('AI验证失败:', error);
            alert('验证失败: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
            setCurrentValidatingQuestion(null);
        }
    };

    // ========== 修改：批量验证 - 先设置统一提示词 ==========
    const prepareBatchValidation = () => {
        if (questions.length === 0) {
            alert('没有题目需要验证');
            return;
        }
        
        // 分析第一道题获取推荐提示词
        const firstQuestion = questions[0];
        const specific = detectSpecificQuestionType(firstQuestion.content);
        const defaultPrompt = generatePrecisePrompt(
            getActualSubject(),
            firstQuestion.type,
            specific.type,
            topicName,
            firstQuestion.content
        );
        
        setDetectedInfo({
            subject: getSubjectLabel(),
            questionType: '批量验证',
            specificType: '多道题目',
            typeLabel: '批量'
        });
        setValidationPrompt(defaultPrompt);
        setIsBatchValidation(true);
        setBatchQuestions([...questions]);
        setBatchCurrentIndex(0);
        setShowPromptModal(true);
    };
    
    // 执行批量验证 - 修复版（包含讨论记录同步）
    const executeBatchValidation = async () => {
        setShowPromptModal(false);
        setBulkValidating(true);
        setBulkValidationResults([]);

        let updatedQuestions = [...questions];

        for (let i = 0; i < batchQuestions.length; i++) {
            // 更新进度提示
            const progress = Math.round(((i + 1) / batchQuestions.length) * 100);
            setBulkValidationResults(prev => [...prev.slice(0, -1), { ...(prev[prev.length - 1] || {}) }]);
            
            const q = batchQuestions[i];

            // 提取题号
            let questionNumber = '';
            const numberMatch = q.content.match(/^(练习\s*\d+|第\s*\d+\s*题)/);
            if (numberMatch) {
                questionNumber = numberMatch[1].replace(/\s+/g, '');
            } else {
                questionNumber = `题目${i + 1}`;
            }

            let cleanContent = q.content.replace(/^(练习\s*\d+[：:]\s*|第\s*\d+\s*题[：:]\s*)/, '');

            const specific = detectSpecificQuestionType(q.content);
            const questionPrompt = generatePrecisePrompt(
                getActualSubject(),
                q.type,
                specific.type,
                topicName,
                cleanContent,
                questionNumber
            );

            setBulkValidationResults(prev => [...prev, { 
                questionId: q.id, 
                content: q.content.substring(0, 50) + (q.content.length > 50 ? '...' : ''),
                status: 'validating',
                suggestedAnswer: null 
            }]);

            try {
                const response = await axios.post('http://localhost:3001/api/ai/validate', {
                    subject: getActualSubject(),
                    question: cleanContent,
                    questionType: q.type,
                    instruction: questionPrompt,
                    models: getValidationModels()
                });

                if (response.data.success) {
                    const suggestedAnswer = response.data.suggestedAnswer || getAISuggestedAnswer(response.data.answers);
                    
                    // 生成讨论记录
                    const discussionText = `AI 讨论记录：\n${Object.entries(response.data.answers).map(([model, ans]) => `${getModelNickname(model)}: ${ans}`).join('\n')}\n综合判断：${response.data.verdict === 'correct' ? '答案正确' : response.data.verdict === 'maybe_correct' ? '可能正确' : '答案有误'}，建议答案：${suggestedAnswer}`;

                    updatedQuestions = updatedQuestions.map(item => {
                        if (item.id === q.id) {
                            return {
                                ...item,
                                aiAnswers: response.data.answers,
                                verdict: response.data.verdict,
                                aiSuggestedAnswer: suggestedAnswer,
                                finalAnswer: suggestedAnswer,
                                discussion: discussionText,
                                peerAnswers: response.data.answers
                            };
                        }
                        return item;
                    });

                    setBulkValidationResults(prev => prev.map(r => 
                        r.questionId === q.id 
                            ? { ...r, status: 'done', suggestedAnswer, verdict: response.data.verdict }
                            : r
                    ));
                } else {
                    setBulkValidationResults(prev => prev.map(r => 
                        r.questionId === q.id ? { ...r, status: 'error', error: '验证失败' } : r
                    ));
                }
            } catch (error) {
                console.error('验证失败:', error);
                setBulkValidationResults(prev => prev.map(r => 
                    r.questionId === q.id ? { ...r, status: 'error', error: error.message } : r
                ));
            }

            // 更新页面状态，让用户看到进度
            setQuestions(updatedQuestions);

            // 等待一下再继续下一题
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setQuestions(updatedQuestions);
        setBulkValidating(false);
        setShowBulkResults(true);
        setAnswersReviewed(false);

        alert(`批量验证完成！\n\nAI建议答案已自动填入「最终答案」和「讨论记录」，请核对修改。`);
    };

    const saveQuestionBank = async () => {
        if (!topicName.trim()) {
            alert('请输入专题名称');
            return;
        }
        
        if (questions.length === 0) {
            alert('请至少添加一道题目');
            return;
        }
        
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
                myAnswer: q.myAnswer || q.finalAnswer || '',
                peerAnswers: q.peerAnswers || q.aiAnswers || {},
                aiAnswers: q.aiAnswers || {},
                aiSuggestedAnswer: q.aiSuggestedAnswer || getAISuggestedAnswer(q.aiAnswers),
                verdict: q.verdict,
                finalAnswer: q.finalAnswer || '',
                discussion: q.discussion || '',
                analysis: q.analysis || ''
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
                finalAnswer: q.finalAnswer || '',
                myAnswer: q.finalAnswer || '',
                peerAnswers: q.aiAnswers || {},
                aiAnswers: q.aiAnswers || {},
                discussion: q.discussion || '',
                aiSuggestedAnswer: q.aiSuggestedAnswer || getAISuggestedAnswer(q.aiAnswers),
                verdict: q.verdict,
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
                📝 手动输入/粘贴公式
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
                📸 上传公式截图
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
                🖼 上传题目截图
                <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        uploadQuestionAsset(questionId, f);
                        e.target.value = '';
                    }}
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
    
    // ========== 修复：提示词编辑弹窗（使用本地状态） ==========
    const PromptEditModal = () => {
        // 本地状态，避免父组件重新渲染导致光标丢失
        const [localPrompt, setLocalPrompt] = useState('');

        // 当弹窗打开时，同步外部传入的提示词到本地状态
        useEffect(() => {
            if (showPromptModal && validationPrompt) {
                setLocalPrompt(validationPrompt);
            }
        }, [showPromptModal, validationPrompt]);

        const handleConfirm = () => {
            // 将本地编辑的内容同步回父组件
            setValidationPrompt(localPrompt);
            setShowPromptModal(false);
            if (isBatchValidation) {
                executeBatchValidation();
            } else {
                executeValidation();
            }
        };

        if (!showPromptModal) return null;

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
                zIndex: 2100
            }}>
                <div style={{
                    background: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    width: '700px',
                    maxWidth: '90%',
                    maxHeight: '80%',
                    overflow: 'auto'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0 }}>✏️ AI 验证提示词</h3>
                        <button onClick={() => setShowPromptModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
                    </div>

                    {/* 识别结果展示 */}
                    <div style={{
                        background: '#f0f7ff',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '13px'
                    }}>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <span>📚 学科：<strong>{detectedInfo.subject}</strong></span>
                            <span>📝 题型：<strong>{detectedInfo.questionType}</strong></span>
                            <span>🏷️ 细分：<strong>{detectedInfo.specificType}</strong></span>
                            {topicName && <span>📁 专题：<strong>{topicName}</strong></span>}
                        </div>
                    </div>

                    {/* 提示词编辑区 */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                            验证提示词（可直接编辑修改）
                        </label>
                        <textarea
                            value={localPrompt}
                            onChange={(e) => setLocalPrompt(e.target.value)}
                            rows={12}
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontSize: '13px',
                                fontFamily: 'monospace',
                                borderRadius: '8px',
                                border: '1px solid #d9d9d9',
                                resize: 'vertical'
                            }}
                            placeholder="可以在这里编辑或修改提示词..."
                        />
                    </div>

                    {/* 提示说明 */}
                    <div style={{
                        background: '#f6ffed',
                        padding: '10px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '12px',
                        color: '#52c41a',
                        border: '1px solid #b7eb8f'
                    }}>
                        💡 提示：提示词越具体，AI回答越准确。可以根据题目特点添加额外要求。
                    </div>

                    {/* 按钮 */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setShowPromptModal(false)}
                            style={{ padding: '8px 20px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            取消
                        </button>
                        <button
                            onClick={handleConfirm}
                            style={{ padding: '8px 20px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            {isBatchValidation ? `开始验证 ${batchQuestions.length} 道题目` : '开始验证'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const groupedBanks = getBanksBySubject();
    
    // ========== 新增：计算最终答案填写情况 ==========
    const allFinalAnswersFilled = questions.length > 0 && questions.every(q => q.finalAnswer && q.finalAnswer.trim() !== '');
    const emptyFinalCount = questions.filter(q => !q.finalAnswer || !q.finalAnswer.trim()).length;

    const renderKnowledgeCollectionPanel = () => (
        <div>
            <div style={{
                background: '#f0f7ff',
                border: '1px solid #91d5ff',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px'
            }}>
                <h3 style={{ marginTop: 0 }}>知识点采集</h3>
                <div style={{ color: '#555', lineHeight: 1.7 }}>
                    本子模块用于从教材、考试分析、复习讲义中生成知识点 JSON 草稿。当前流程为：抽取资料文本 → AI 归纳 JSON → 人工校对；校对后的入库接口将在下一步接入。
                </div>
            </div>

            {renderJsonImportPanel({
                title: '上传 JSON 生成知识库',
                description: '推荐入口：先解析并预览专题、考点和命题分析摘要，确认后写入树状知识图谱。',
                file: knowledgeJsonFile,
                preview: knowledgeJsonPreview,
                onFileChange: previewKnowledgeJsonFile,
                onImport: importKnowledgeJsonFile,
                disabled: knowledgeLoading,
                accent: '#13c2c2',
                extraControls: (
                    <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="checkbox"
                            checked={clearKnowledgeBeforeImport}
                            onChange={(e) => setClearKnowledgeBeforeImport(e.target.checked)}
                        />
                        清空后导入
                    </label>
                )
            })}

            <div style={{
                background: '#f5f5f5',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '20px'
            }}>
                <h3 style={{ marginTop: 0 }}>资料信息</h3>
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
                        <label>资料主题：</label>
                        <input
                            type="text"
                            value={topicName}
                            onChange={(e) => setTopicName(e.target.value)}
                            placeholder="如：函数专题命题分析"
                            style={{ width: '280px', padding: '6px 10px' }}
                        />
                    </div>
                    <div>
                        <label>资料文件：</label>
                        <input
                            type="file"
                            accept=".pdf,.docx"
                            onChange={(e) => setKnowledgeFile(e.target.files?.[0] || null)}
                        />
                        {knowledgeFile && (
                            <div style={{ fontSize: '12px', color: '#52c41a', marginTop: '4px', maxWidth: '260px', wordBreak: 'break-all' }}>
                                已选择：{knowledgeFile.name}
                            </div>
                        )}
                    </div>
                    <div>
                        <label>页码范围：</label>
                        <input
                            type="number"
                            value={knowledgePageRange.start}
                            onChange={(e) => setKnowledgePageRange({ ...knowledgePageRange, start: parseInt(e.target.value) || 1 })}
                            style={{ width: '60px', padding: '4px' }}
                        />
                        ~
                        <input
                            type="number"
                            value={knowledgePageRange.end}
                            onChange={(e) => setKnowledgePageRange({ ...knowledgePageRange, end: parseInt(e.target.value) || 1 })}
                            style={{ width: '60px', padding: '4px' }}
                        />
                    </div>
                    <button
                        onClick={extractKnowledgeText}
                        disabled={knowledgeLoading}
                        style={{ padding: '6px 16px', background: '#fa8c16', color: 'white', border: 'none', borderRadius: '4px', cursor: knowledgeLoading ? 'not-allowed' : 'pointer' }}
                    >
                        {knowledgeLoading ? '处理中...' : '抽取文本'}
                    </button>
                    <button
                        onClick={generateKnowledgeJson}
                        disabled={knowledgeLoading || !knowledgeRawText.trim()}
                        style={{ padding: '6px 16px', background: knowledgeRawText.trim() ? '#1890ff' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', cursor: knowledgeRawText.trim() ? 'pointer' : 'not-allowed' }}
                    >
                        AI 生成 JSON
                    </button>
                    <button
                        onClick={saveKnowledgeToDb}
                        disabled={knowledgeLoading || !knowledgeJsonDraft.trim()}
                        style={{ padding: '6px 16px', background: knowledgeJsonDraft.trim() ? '#722ed1' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', cursor: knowledgeJsonDraft.trim() ? 'pointer' : 'not-allowed' }}
                        title="将当前知识点 JSON 草稿保存到知识库（会尝试写入 topics 和 knowledge_points 表）"
                    >
                        💾 保存知识点到知识库
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '16px' }}>
                    <h3 style={{ marginTop: 0 }}>原始文本</h3>
                    <textarea
                        value={knowledgeRawText}
                        onChange={(e) => setKnowledgeRawText(e.target.value)}
                        rows={22}
                        placeholder="抽取后的资料文本会显示在这里，也可以手动粘贴资料内容。"
                        style={{ width: '100%', padding: '10px', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '16px' }}>
                    <h3 style={{ marginTop: 0 }}>知识点 JSON 草稿</h3>
                    <textarea
                        value={knowledgeJsonDraft}
                        onChange={(e) => setKnowledgeJsonDraft(e.target.value)}
                        rows={22}
                        placeholder="AI 生成的知识点 JSON 会显示在这里。下一步将接入校对后入库。"
                        style={{ width: '100%', padding: '10px', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                </div>
            </div>

            <div style={{
                marginTop: '20px',
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: '8px',
                padding: '14px',
                color: '#8c5a00',
                lineHeight: 1.7
            }}>
                入库策略：JSON 草稿经人工校对后，再写入 SQLite 的知识点、来源和命题分析表；数据库作为统计分析模块的权威数据源。
            </div>
        </div>
    );

    const renderMappingCollectionPanel = () => {
        const subjectLabels = { chinese: '语文', math: '数学', english: '英语' };
        const exportFiles = mappingExportsPreview?.files || [];
        const dbLinks = mappingExportsPreview?.db_links;
        const dbQuestions = mappingExportsPreview?.db_questions;

        return (
            <div>
                <div style={{
                    background: '#f9f0ff',
                    border: '1px solid #d3adf7',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                }}>
                    <h3 style={{ marginTop: 0 }}>知识点题库映射</h3>
                    <div style={{ color: '#555', lineHeight: 1.7 }}>
                        将从 Ollama 生成的映射 CSV 写入 <code>question_knowledge_points</code> 表。
                        默认读取 <code>data/exports/question_kp_chinese.csv</code>、
                        <code>question_kp_math.csv</code>、<code>question_kp_english.csv</code>。
                        CSV 需包含 <code>question_id</code> 与 <code>knowledge_point_id</code> 列；导入前请确保题库已入库，且题目 ID 与数据库一致。
                    </div>
                </div>

                <div style={{
                    border: '1px solid #722ed1',
                    background: '#faf5ff',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                            <div style={{ fontWeight: 'bold', color: '#531dab' }}>从 exports 目录导入</div>
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                目录：{mappingExportsPreview?.export_dir || 'data/exports'}
                            </div>
                        </div>
                        <button
                            onClick={loadMappingExportsPreview}
                            disabled={mappingLoading}
                            style={{ padding: '6px 12px', background: '#f0f0f0', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            刷新状态
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                        {['chinese', 'math', 'english'].map((item) => {
                            const fileInfo = exportFiles.find((entry) => entry.subject === item) || { exists: false };
                            return (
                                <div key={item} style={{ background: 'white', border: '1px solid #eee', borderRadius: '8px', padding: '12px' }}>
                                    <div style={{ fontWeight: 'bold' }}>{subjectLabels[item]}</div>
                                    <div style={{ fontSize: '12px', color: fileInfo.exists ? '#389e0d' : '#cf1322', marginTop: '6px' }}>
                                        {fileInfo.exists ? 'CSV 已就绪' : 'CSV 未找到'}
                                    </div>
                                    {fileInfo.exists && (
                                        <div style={{ fontSize: '12px', color: '#666', marginTop: '6px', lineHeight: 1.6 }}>
                                            行数: {fileInfo.row_count}<br />
                                            映射条数: {fileInfo.link_count}<br />
                                            题目数: {fileInfo.question_count}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                        <label>
                            导入范围：
                            <select
                                value={mappingImportSubject}
                                onChange={(e) => setMappingImportSubject(e.target.value)}
                                style={{ marginLeft: '8px', padding: '4px 8px' }}
                            >
                                <option value="all">三门全部</option>
                                <option value="chinese">仅语文</option>
                                <option value="math">仅数学</option>
                                <option value="english">仅英语</option>
                            </select>
                        </label>
                        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                                type="checkbox"
                                checked={resetMappingBeforeImport}
                                onChange={(e) => setResetMappingBeforeImport(e.target.checked)}
                            />
                            导入前清空已有映射
                        </label>
                        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                                type="checkbox"
                                checked={mappingDryRun}
                                onChange={(e) => setMappingDryRun(e.target.checked)}
                            />
                            仅试运行（不写入数据库）
                        </label>
                    </div>

                    <button
                        onClick={importMappingFromExports}
                        disabled={mappingLoading}
                        style={{
                            padding: '8px 18px',
                            background: mappingLoading ? '#ccc' : '#722ed1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: mappingLoading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {mappingLoading ? '处理中...' : (mappingDryRun ? '校验 exports CSV' : '确认导入 exports CSV')}
                    </button>
                </div>

                <div style={{
                    border: '1px solid #b37feb',
                    background: '#fff',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#531dab' }}>或上传单个 CSV</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => setMappingCsvFile(e.target.files?.[0] || null)}
                        />
                        <button
                            onClick={importMappingCsvUpload}
                            disabled={mappingLoading || !mappingCsvFile}
                            style={{
                                padding: '6px 16px',
                                background: mappingCsvFile && !mappingLoading ? '#9254de' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: mappingCsvFile && !mappingLoading ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {mappingDryRun ? '校验上传 CSV' : '导入上传 CSV'}
                        </button>
                    </div>
                </div>

                <div style={{
                    background: '#fff7e6',
                    border: '1px solid #ffd591',
                    borderRadius: '8px',
                    padding: '14px',
                    color: '#8c5a00',
                    lineHeight: 1.7
                }}>
                    当前数据库题目数：{dbQuestions ?? '-'}；已有映射：{dbLinks ? `${dbLinks.total_links} 条 / ${dbLinks.distinct_questions} 道题` : '-'}。
                    若大量记录被跳过，通常是 CSV 中的 <code>question_id</code> 与 <code>questions</code> 表不一致，请先用【题库采集】导入真题后再执行映射。
                </div>
            </div>
        );
    };

    if (collectionMode === 'mapping') {
        return (
            <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
                <h1>📥 新资料采集</h1>
                {renderModeSwitcher()}
                {renderMappingCollectionPanel()}
            </div>
        );
    }

    if (collectionMode === 'knowledge') {
        return (
            <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
                <h1>📥 新资料采集</h1>
                {renderModeSwitcher()}
                {renderKnowledgeCollectionPanel()}
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            <h1>📥 新资料采集</h1>
            {renderModeSwitcher()}
            
            {/* 弹窗 */}
            <BulkValidationModal />
            <PromptEditModal />
            <TextCorrectionModal
                key={showCorrectionModal ? 'open' : 'closed'}
                isOpen={showCorrectionModal}
                onClose={() => setShowCorrectionModal(false)}
                onConfirm={handleCorrectionConfirm}
                initialText={rawPagesText || ''}  // 确保是字符串，不为 undefined
                pageStart={currentPageRange.start}
                pageEnd={currentPageRange.end}
                defaultAnswerMarker={answerMarker}
                defaultAnalysisMarker={analysisMarker}
                defaultQuestionPattern={questionPattern}
            />

            {renderJsonImportPanel({
                title: '上传 JSON 生成题库',
                description: '推荐入口：先解析并预览题库标题、学科版本和题目数量，确认后写入 SQLite 题库。',
                file: questionBankJsonFile,
                preview: questionBankJsonPreview,
                onFileChange: previewQuestionBankJsonFile,
                onImport: importQuestionBankJsonFile,
                disabled: parsing,
                accent: '#13c2c2'
            })}
            
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
                <button
                    onClick={saveCorrectedToDb}
                    disabled={!(lastCorrectedText && lastCorrectedText.trim() || questions.length > 0) || parsing}
                    title={lastCorrectedText && lastCorrectedText.trim() ? "将最近校正的文本解析并保存到 SQLite 题库（生成 JSON 备份）" : "当前没有校正文本，点击将把页面上的题目直接保存为题库"}
                    style={{ padding: '6px 16px', background: '#722ed1', color: 'white', border: 'none', borderRadius: '4px', cursor: (lastCorrectedText && lastCorrectedText.trim() || questions.length > 0) && !parsing ? 'pointer' : 'not-allowed' }}
                >
                    💾 保存解析结果入库
                </button>
            </div>

            {/* 新建题库表单 */}
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

            {/* 题库列表 */}
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

                {/* 未填写最终答案的提示条 */}
                {questions.length > 0 && !allFinalAnswersFilled && (
                    <div style={{
                        background: '#fff7e6',
                        border: '1px solid #ffc53d',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <span>⚠️</span>
                        <span>还有 <strong>{emptyFinalCount}</strong> 道题目的「最终答案」未填写，请确认后保存。</span>
                    </div>
                )}

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
                                    <TextEditorWithShortcuts
                                        value={q.content}
                                        onChange={(e) => updateQuestion(q.id, 'content', e.target.value)}
                                        rows={3}
                                        placeholder="输入题目内容...（支持 Ctrl+Z撤销 / Ctrl+Y重做）"
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

                                {/* AI 验证区域 - 改为同学讨论模式 */}
                                <div style={{
                                    background: '#f0f7ff',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <strong>🤝 答案管理（讨论确认）</strong>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => {
                                                    setEditingAnswerQuestion(q);
                                                    setShowAnswerEditor(true);
                                                }}
                                                style={{ padding: '4px 12px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                            >
                                                ✏️ 编辑答案
                                            </button>
                                            <button
                                                onClick={() => prepareValidation(q)}
                                                disabled={loading}
                                                style={{ padding: '4px 12px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                💬 邀请同学讨论
                                            </button>
                                        </div>
                                    </div>

                                    {/* 四栏对比 - 参考答案 vs 我的答案 vs 同学答案 vs 讨论记录 */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginTop: '12px' }}>
                                        {/* 参考答案（试卷原答案） */}
                                        <div style={{ background: '#fff7e6', padding: '10px', borderRadius: '6px', border: '2px solid #fa8c16' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#fa8c16', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>📖 参考答案</span>
                                                <button
                                                    onClick={() => {
                                                        setEditingAnswerQuestion(q);
                                                        setShowAnswerEditor(true);
                                                    }}
                                                    style={{
                                                        padding: '2px 8px',
                                                        background: '#fa8c16',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '11px'
                                                    }}
                                                >
                                                    ✏️
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '13px', wordBreak: 'break-all', minHeight: '40px', padding: '6px', background: '#fff', borderRadius: '4px' }}>
                                                {q.sourceAnswer || '🔲 暂无'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>原始试卷答案</div>
                                        </div>

                                        {/* 我的答案（讨论后确定） */}
                                        <div style={{ background: '#e6f7ff', padding: '10px', borderRadius: '6px', border: '2px solid #1890ff' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#1890ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>✅ 我的答案</span>
                                                <button
                                                    onClick={() => {
                                                        setEditingAnswerQuestion(q);
                                                        setShowAnswerEditor(true);
                                                    }}
                                                    style={{
                                                        padding: '2px 8px',
                                                        background: '#1890ff',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '11px'
                                                    }}
                                                >
                                                    ✏️
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '13px', wordBreak: 'break-all', minHeight: '40px', padding: '6px', background: '#fff', borderRadius: '4px' }}>
                                                {q.finalAnswer || '🔲 讨论中'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>讨论后决定的答案</div>
                                        </div>

                                        {/* 同学的答案（AI建议） */}
                                        <div style={{ background: '#f6ffed', padding: '10px', borderRadius: '6px', border: '2px solid #52c41a' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#52c41a' }}>
                                                👨‍🎓 同学的答案
                                            </div>
                                            <div style={{ maxHeight: '100px', overflow: 'auto', fontSize: '12px', wordBreak: 'break-all', padding: '6px', background: '#fff', borderRadius: '4px' }}>
                                                {q.aiAnswers && Object.keys(q.aiAnswers).length > 0 ? (
                                                    <div>
                                                        {Object.entries(q.aiAnswers).map(([model, answer], idx) => (
                                                            <div key={model} style={{ marginBottom: idx < Object.keys(q.aiAnswers).length - 1 ? '6px' : 0, paddingBottom: '4px', borderBottom: idx < Object.keys(q.aiAnswers).length - 1 ? '1px solid #eee' : 'none' }}>
                                                                <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
                                                                    {getModelNickname(model)}
                                                                </span>
                                                                <div style={{ fontSize: '11px', marginTop: '2px' }}>
                                                                    {answer}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    '🔲 暂无'
                                                )}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>多个AI的答案</div>
                                        </div>

                                        {/* 讨论记录 */}
                                        <div style={{ background: '#fff0f6', padding: '10px', borderRadius: '6px', border: '2px solid #eb2f96' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#eb2f96', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>💬 讨论记录</span>
                                                <button
                                                    onClick={() => {
                                                        setEditingAnswerQuestion(q);
                                                        setShowAnswerEditor(true);
                                                    }}
                                                    style={{
                                                        padding: '2px 8px',
                                                        background: '#eb2f96',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '11px'
                                                    }}
                                                >
                                                    ✏️
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '12px', wordBreak: 'break-all', minHeight: '40px', padding: '6px', background: '#fff', borderRadius: '4px', color: '#666', fontStyle: q.discussion ? 'normal' : 'italic' }}>
                                                {q.discussion || '暂无记录'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>记录决策过程</div>
                                        </div>
                                    </div>

                                    {/* 答案验证提示 */}
                                    {q.sourceAnswer && q.sourceAnswer.trim() && !q.finalAnswer && (
                                        <div style={{ marginTop: '8px', padding: '8px', background: '#fff7e6', borderRadius: '4px', fontSize: '12px', color: '#ff9800' }}>
                                            ⚠️ 【参考答案】已有，请先讨论确认后填入【我的答案】
                                        </div>
                                    )}
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

            {/* 底部按钮 */}
            <div style={{ 
                display: 'flex', 
                gap: '16px', 
                justifyContent: 'flex-end', 
                borderTop: '1px solid #eee', 
                paddingTop: '20px',
                marginTop: '20px'
            }}>
                <div style={{ flex: 1, fontSize: '12px', color: '#666' }}>
                    💡 操作流程：解析文档 → 校正格式 → 导入题目 → AI验证 → 确认答案 → 保存
                </div>
                <button
                    onClick={prepareBatchValidation}
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
                    📤 导出 JSON
                </button>
                <button
                    onClick={saveQuestionBank}
                    disabled={!topicName || questions.length === 0 || !allFinalAnswersFilled}
                    style={{ 
                        padding: '10px 20px', 
                        background: (!topicName || questions.length === 0 || !allFinalAnswersFilled) ? '#ccc' : '#1890ff', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: (!topicName || questions.length === 0 || !allFinalAnswersFilled) ? 'not-allowed' : 'pointer' 
                    }}
                    title={!allFinalAnswersFilled ? `还有 ${emptyFinalCount} 道题目的「最终答案」未填写` : ""}
                >
                    💾 保存到答案库
                </button>
            </div>
            
            {/* 答案编辑器弹窗 */}
            {showAnswerEditor && editingAnswerQuestion && (
                <AnswerEditor
                    question={editingAnswerQuestion}
                    onUpdate={(field, value) => {
                        updateQuestion(editingAnswerQuestion.id, field, value);
                        // 更新本地状态以保持一致性
                        setEditingAnswerQuestion({
                            ...editingAnswerQuestion,
                            [field]: value
                        });
                    }}
                    onClose={() => {
                        setShowAnswerEditor(false);
                        setEditingAnswerQuestion(null);
                    }}
                />
            )}
        </div>
    );
}

export default DataImport;
