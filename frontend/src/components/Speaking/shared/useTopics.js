import { useState, useEffect } from 'react';

export function useTopics(initialBuiltinTopics, storageKey = 'speaking_custom_topics') {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);

    // 排序函数：按 category 字母序，再按 question 字母序
    const sortTopics = (topicList) => {
        return [...topicList].sort((a, b) => {
            const catCompare = (a.category || '').localeCompare(b.category || '');
            if (catCompare !== 0) return catCompare;
            return (a.question || '').localeCompare(b.question || '');
        });
    };

    const loadTopics = () => {
        const stored = localStorage.getItem(storageKey);
        let custom = [];
        if (stored) {
            try {
                custom = JSON.parse(stored);
            } catch(e) { console.error(e); }
        }
        const all = [...initialBuiltinTopics, ...custom];
        const sorted = sortTopics(all);
        setTopics(sorted);
        setLoading(false);
    };

    const addTopic = (question, category = '自定义') => {
        const newId = `custom_${Date.now()}`;
        const newTopic = { id: newId, question, category };
        const stored = localStorage.getItem(storageKey);
        let custom = stored ? JSON.parse(stored) : [];
        custom.push(newTopic);
        localStorage.setItem(storageKey, JSON.stringify(custom));
        loadTopics(); // 重新加载并排序
        return newTopic;
    };

    const deleteTopic = (id) => {
        if (!id.startsWith('custom_')) return false;
        const stored = localStorage.getItem(storageKey);
        let custom = stored ? JSON.parse(stored) : [];
        const newCustom = custom.filter(t => t.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(newCustom));
        loadTopics();
        return true;
    };

    useEffect(() => {
        loadTopics();
    }, [initialBuiltinTopics]);

    return { topics, loading, addTopic, deleteTopic, reload: loadTopics };
}