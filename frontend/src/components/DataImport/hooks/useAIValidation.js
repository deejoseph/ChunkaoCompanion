import { useState } from 'react';
import axios from 'axios';
import { API_BASE, getValidationModels, getAISuggestedAnswer, generatePrecisePrompt, getSubjectLabel } from '../utils';
import { detectSpecificQuestionType } from '../utils';

export const useAIValidation = (getActualSubject, topicName, updateQuestion, setQuestions) => {
    const [loading, setLoading] = useState(false);
    const [bulkValidating, setBulkValidating] = useState(false);
    const [bulkValidationResults, setBulkValidationResults] = useState([]);
    const [showBulkResults, setShowBulkResults] = useState(false);
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [currentValidatingQuestion, setCurrentValidatingQuestion] = useState(null);
    const [validationPrompt, setValidationPrompt] = useState('');
    const [detectedInfo, setDetectedInfo] = useState({ subject: '', questionType: '', specificType: '', typeLabel: '' });
    const [isBatchValidation, setIsBatchValidation] = useState(false);
    const [batchQuestions, setBatchQuestions] = useState([]);

    const prepareValidation = (q, getSubjectLabelFn) => {
        if (!q.content.trim()) {
            alert('请先填写题目内容');
            return;
        }
        
        const specific = detectSpecificQuestionType(q.content);
        const defaultPrompt = generatePrecisePrompt(
            getActualSubject(),
            q.type,
            specific.type,
            topicName,
            q.content,
            getSubjectLabelFn(getActualSubject())
        );
        
        setCurrentValidatingQuestion(q);
        setDetectedInfo({
            subject: getSubjectLabelFn(getActualSubject()),
            questionType: q.type === 'fill' ? '填空题' : q.type === 'choice' ? '选择题' : '问答题',
            specificType: specific.label,
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
            const response = await axios.post(`${API_BASE}/api/ai/validate`, {
                subject: getActualSubject(),
                question: currentValidatingQuestion.content,
                questionType: currentValidatingQuestion.type,
                instruction: validationPrompt,
                models: getValidationModels(getActualSubject())
            });

            if (response.data.success) {
                const suggestedAnswer = response.data.suggestedAnswer || getAISuggestedAnswer(response.data.answers);
                
                updateQuestion(currentValidatingQuestion.id, 'aiAnswers', response.data.answers);
                updateQuestion(currentValidatingQuestion.id, 'verdict', response.data.verdict);
                updateQuestion(currentValidatingQuestion.id, 'aiSuggestedAnswer', suggestedAnswer);
                updateQuestion(currentValidatingQuestion.id, 'finalAnswer', suggestedAnswer);

                alert(`验证完成！\nAI建议答案：${suggestedAnswer || '未识别'}\n已自动填入「最终答案」，请核对修改。`);
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

    const prepareBatchValidation = (questions, getSubjectLabelFn) => {
        if (questions.length === 0) {
            alert('没有题目需要验证');
            return;
        }
        
        const firstQuestion = questions[0];
        const specific = detectSpecificQuestionType(firstQuestion.content);
        const defaultPrompt = generatePrecisePrompt(
            getActualSubject(),
            firstQuestion.type,
            specific.type,
            topicName,
            firstQuestion.content,
            getSubjectLabelFn(getActualSubject())
        );
        
        setDetectedInfo({
            subject: getSubjectLabelFn(getActualSubject()),
            questionType: '批量验证',
            specificType: '多道题目',
            typeLabel: '批量'
        });
        setValidationPrompt(defaultPrompt);
        setIsBatchValidation(true);
        setBatchQuestions([...questions]);
        setShowPromptModal(true);
    };

    const executeBatchValidation = async () => {
        setShowPromptModal(false);
        setBulkValidating(true);
        setBulkValidationResults([]);

        const results = [];
        let updatedQuestions = [...batchQuestions];

        for (let i = 0; i < batchQuestions.length; i++) {
            const q = batchQuestions[i];

            setBulkValidationResults(prev => [...prev, { 
                questionId: q.id, 
                content: q.content.substring(0, 50) + (q.content.length > 50 ? '...' : ''),
                status: 'validating',
                suggestedAnswer: null 
            }]);

            try {
                const response = await axios.post(`${API_BASE}/api/ai/validate`, {
                    subject: getActualSubject(),
                    question: q.content,
                    questionType: q.type,
                    instruction: validationPrompt,
                    models: getValidationModels(getActualSubject())
                });

                if (response.data.success) {
                    const suggestedAnswer = response.data.suggestedAnswer || getAISuggestedAnswer(response.data.answers);

                    updatedQuestions = updatedQuestions.map(item => {
                        if (item.id === q.id) {
                            return {
                                ...item,
                                aiAnswers: response.data.answers,
                                verdict: response.data.verdict,
                                aiSuggestedAnswer: suggestedAnswer,
                                finalAnswer: suggestedAnswer
                            };
                        }
                        return item;
                    });

                    results.push({ ...q, suggestedAnswer, verdict: response.data.verdict });

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

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        setQuestions(updatedQuestions);
        setBulkValidating(false);
        setShowBulkResults(true);

        const successCount = results.filter(r => r.suggestedAnswer).length;
        const failCount = results.filter(r => r.error).length;
        alert(`批量验证完成！\n\n✅ 成功：${successCount} 题\n❌ 失败：${failCount} 题\n\nAI建议答案已自动填入「最终答案」，请核对修改。`);
    };

    return {
        loading,
        bulkValidating,
        bulkValidationResults,
        showBulkResults,
        setShowBulkResults,
        showPromptModal,
        setShowPromptModal,
        validationPrompt,
        setValidationPrompt,
        detectedInfo,
        currentValidatingQuestion,
        isBatchValidation,
        prepareValidation,
        executeValidation,
        prepareBatchValidation,
        executeBatchValidation
    };
};