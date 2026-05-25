// frontend/src/components/Speaking/shared/useTOEFLTopics.js
import { useState, useEffect } from 'react';

export function useTOEFLTopics(initialTopics, storageKey = 'toefl_custom_topics') {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadTopics = () => {
        const stored = localStorage.getItem(storageKey);
        let custom = [];
        if (stored) {
            try {
                custom = JSON.parse(stored);
            } catch(e) { console.error(e); }
        }
        const all = [...initialTopics, ...custom];
        // 按题型排序（1,2,3,4）
        const sorted = all.sort((a,b) => a.taskType - b.taskType);
        setTopics(sorted);
        setLoading(false);
    };

    const addTopic = (topic) => {
        const newId = `custom_${Date.now()}`;
        const newTopic = { id: newId, ...topic };
        const stored = localStorage.getItem(storageKey);
        let custom = stored ? JSON.parse(stored) : [];
        custom.push(newTopic);
        localStorage.setItem(storageKey, JSON.stringify(custom));
        loadTopics();
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
    }, [initialTopics]);

    return { topics, loading, addTopic, deleteTopic, reload: loadTopics };
}