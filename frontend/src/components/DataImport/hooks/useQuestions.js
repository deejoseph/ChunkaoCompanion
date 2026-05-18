import { useState } from 'react';
import { detectQuestionType } from '../utils';

export const useQuestions = (initialQuestions = []) => {
    const [questions, setQuestions] = useState(initialQuestions);
    const [answersReviewed, setAnswersReviewed] = useState(false);

    const updateQuestion = (id, field, value) => {
        if (['content', 'sourceAnswer', 'aiSuggestedAnswer', 'finalAnswer', 'analysis', 'type'].includes(field)) {
            setAnswersReviewed(false);
        }
        setQuestions(prevQuestions => 
            prevQuestions.map(q => q.id === id ? { ...q, [field]: value } : q)
        );
    };

    const addQuestion = (pageRange) => {
        setQuestions(prev => [...prev, {
            id: Date.now(),
            page: pageRange.start,
            number: prev.length + 1,
            type: 'fill',
            content: '',
            answerFormat: '【答案】',
            sourceAnswer: '',
            aiAnswers: {},
            aiSuggestedAnswer: '',
            verdict: null,
            finalAnswer: '',
            analysis: ''
        }]);
    };

    const deleteQuestion = (id, confirmDelete) => {
        if (window.confirm('确定删除这道题目吗？')) {
            setQuestions(prev => prev.filter(q => q.id !== id));
        }
    };

    const importFromJson = (jsonContent, pageRange, currentQuestions) => {
        try {
            const imported = JSON.parse(jsonContent);
            const newQuestions = imported.map((q, idx) => ({
                id: Date.now() + idx,
                page: q.page || pageRange.start,
                number: currentQuestions.length + idx + 1,
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
            setQuestions([...currentQuestions, ...newQuestions]);
            return { success: true, count: newQuestions.length };
        } catch (error) {
            return { success: false, error: 'JSON 格式错误，请检查' };
        }
    };

    const loadBankQuestions = (bank) => {
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
    };

    const allFinalAnswersFilled = questions.length > 0 && questions.every(q => q.finalAnswer && q.finalAnswer.trim() !== '');
    const emptyFinalCount = questions.filter(q => !q.finalAnswer || !q.finalAnswer.trim()).length;

    return {
        questions,
        setQuestions,
        answersReviewed,
        setAnswersReviewed,
        updateQuestion,
        addQuestion,
        deleteQuestion,
        importFromJson,
        loadBankQuestions,
        allFinalAnswersFilled,
        emptyFinalCount
    };
};