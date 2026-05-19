import { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

export const useOCR = () => {
    const [uploading, setUploading] = useState(false);
    const [recognizedFormulas, setRecognizedFormulas] = useState([]);
    const [textOcrContent, setTextOcrContent] = useState('');
    const [textOcrUploading, setTextOcrUploading] = useState(false);
    const [showTextOcrModal, setShowTextOcrModal] = useState(false);

    // 识别公式（从图片文件）
    const recognizeFormula = async (file, onSuccess) => {
        if (!file) return null;
        
        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await axios.post(`${API_BASE}/api/ocr/recognize`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            if (response.data.success) {
                const latex = response.data.latex || '';
                if (onSuccess) {
                    onSuccess(latex);
                } else {
                    // 默认存入待插入队列
                    setRecognizedFormulas(prev => [...prev, { id: Date.now(), latex }]);
                }
                return latex;
            } else {
                alert(`识别失败：${response.data.error || '未知错误'}`);
                return null;
            }
        } catch (error) {
            console.error('公式识别失败:', error);
            alert('识别失败，请重试');
            return null;
        } finally {
            setUploading(false);
        }
    };

    // 识别图文
    const recognizeText = async (file) => {
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
                return response.data.text;
            } else {
                alert(`图文识别失败：${response.data.error || '未知错误'}`);
                return null;
            }
        } catch (error) {
            console.error('图文识别失败:', error);
            alert('图文识别失败，请确认后端服务和 PaddleOCR 环境正常。');
            return null;
        } finally {
            setTextOcrUploading(false);
        }
    };

    // 粘贴识别公式（监听粘贴事件）
    const setupPasteListener = (enabled, onRecognized) => {
        const handlePaste = async (e) => {
            if (!enabled) return;
            
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    const latex = await recognizeFormula(file, onRecognized);
                    return latex;
                }
            }
        };
        
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    };

    return {
        // 状态
        uploading,
        recognizedFormulas,
        setRecognizedFormulas,
        textOcrContent,
        setTextOcrContent,
        textOcrUploading,
        showTextOcrModal,
        setShowTextOcrModal,
        // 方法
        recognizeFormula,
        recognizeText,
        setupPasteListener
    };
};