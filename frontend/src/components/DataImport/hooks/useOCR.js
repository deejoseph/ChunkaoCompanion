import { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../constants';

export const useOCR = (updateQuestion) => {
    const [showFormulaInput, setShowFormulaInput] = useState(false);
    const [formulaLatex, setFormulaLatex] = useState('');
    const [uploading, setUploading] = useState(false);
    const [currentEditingQuestionId, setCurrentEditingQuestionId] = useState(null);
    const [showTextOcrModal, setShowTextOcrModal] = useState(false);
    const [textOcrContent, setTextOcrContent] = useState('');
    const [textOcrUploading, setTextOcrUploading] = useState(false);

    const handleFormulaUpload = async (e, questions) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await axios.post(`${API_BASE}/api/ocr/recognize`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                const latex = response.data.latex;
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
            const response = await axios.post(`${API_BASE}/api/ocr/recognize-text`, formData, {
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
            updateQuestion(currentEditingQuestionId, 'content', 
                (prev) => prev + '\n' + textOcrContent);
            setShowTextOcrModal(false);
            setTextOcrContent('');
        }
    };

    return {
        showFormulaInput,
        setShowFormulaInput,
        formulaLatex,
        setFormulaLatex,
        uploading,
        currentEditingQuestionId,
        setCurrentEditingQuestionId,
        showTextOcrModal,
        setShowTextOcrModal,
        textOcrContent,
        textOcrUploading,
        handleFormulaUpload,
        handleTextImageUpload,
        insertTextOcrToQuestion
    };
};