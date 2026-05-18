import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../constants';

export const useBanks = () => {
    const [savedBanks, setSavedBanks] = useState([]);

    const loadBanks = async () => {
        try {
            const response = await axios.get(`${API_BASE}/api/banks/list`);
            if (response.data.success) {
                setSavedBanks(response.data.banks);
            }
        } catch (error) {
            console.error('加载题库列表失败:', error);
        }
    };

    const deleteBank = async (bankId, bankTitle, onConfirmDelete) => {
        if (window.confirm(`确定删除题库「${bankTitle}」吗？此操作不可恢复。`)) {
            try {
                await axios.delete(`${API_BASE}/api/banks/${bankId}`);
                loadBanks();
                alert('删除成功');
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败');
            }
        }
    };

    const deleteSubject = async (subjectKey, subjectName) => {
        if (window.confirm(`确定删除「${subjectName}」学科下的所有题库吗？此操作不可恢复。`)) {
            try {
                await axios.delete(`${API_BASE}/api/banks/subject/${subjectKey}`);
                loadBanks();
                alert('删除成功');
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败');
            }
        }
    };

    useEffect(() => {
        loadBanks();
    }, []);

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

    return { savedBanks, loadBanks, deleteBank, deleteSubject, getBanksBySubject };
};