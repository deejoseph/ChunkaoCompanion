const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { decrypt } = require('../utils/encryption');

const dbPath = path.join(__dirname, '../data/springkao.db');
const db = new sqlite3.Database(dbPath);
const OLLAMA_URL = 'http://localhost:11434/api/generate';

// 调用本地 Ollama
async function callOllama(prompt, model) {
    try {
        const response = await axios.post(OLLAMA_URL, {
            model: model || 'qwen2.5:14b',
            prompt: prompt,
            stream: false,
            options: { temperature: 0.3, num_predict: 2048 }
        });
        return { success: true, answer: response.data.response, source: 'ollama' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 调用云端 API
async function callCloudAPI(provider, prompt) {
    const { api_url, api_key, model_name } = provider;
    if (!api_url || !api_key || !model_name) {
        return { success: false, error: 'API 配置不完整' };
    }
    
    try {
        const response = await axios.post(
            `${api_url}/chat/completions`,
            {
                model: model_name,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 2048
            },
            {
                headers: { 'Authorization': `Bearer ${api_key}`, 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );
        
        const answer = response.data?.choices?.[0]?.message?.content || '';
        return { success: true, answer, source: provider.name };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 获取启用的云端提供商（按优先级排序）
async function getActiveCloudProviders() {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT id, name, api_key, api_url, model_name, priority FROM api_providers WHERE is_active = 1 ORDER BY priority',
            async (err, rows) => {
                if (err) return reject(err);
                
                // 解密 api_key
                const providers = rows.map(row => ({
                    ...row,
                    api_key: decrypt(row.api_key)
                }));
                resolve(providers);
            }
        );
    });
}

// 获取 AI 优先级配置
async function getAIPriority() {
    return new Promise((resolve) => {
        db.get('SELECT value FROM system_configs WHERE key = ?', ['ai_priority'], (err, row) => {
            resolve(row?.value || 'local_first');
        });
    });
}

// 主入口：智能路由
async function askWithFallback(prompt, options = {}) {
    const priority = await getAIPriority();
    const cloudProviders = await getActiveCloudProviders();
    
    // 本地优先模式
    if (priority === 'local_first') {
        // 先试本地
        const localResult = await callOllama(prompt, options.model);
        if (localResult.success) return localResult;
        
        // 本地失败，试云端
        for (const provider of cloudProviders) {
            const result = await callCloudAPI(provider, prompt);
            if (result.success) return result;
        }
    }
    
    // 云端优先模式
    if (priority === 'cloud_first') {
        for (const provider of cloudProviders) {
            const result = await callCloudAPI(provider, prompt);
            if (result.success) return result;
        }
        // 云端都失败，试本地
        const localResult = await callOllama(prompt, options.model);
        if (localResult.success) return localResult;
    }
    
    // 仅本地模式
    if (priority === 'local_only') {
        return await callOllama(prompt, options.model);
    }
    
    // 仅云端模式
    if (priority === 'cloud_only') {
        for (const provider of cloudProviders) {
            const result = await callCloudAPI(provider, prompt);
            if (result.success) return result;
        }
        return { success: false, error: '所有云端服务均不可用' };
    }
    
    return { success: false, error: '无可用 AI 服务' };
}

module.exports = { callOllama, callCloudAPI, askWithFallback, getActiveCloudProviders };