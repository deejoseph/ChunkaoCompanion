import { useState, useEffect } from 'react';
import axios from 'axios';
import KnowledgeLearning from './components/KnowledgeLearning';
import AIAssistant from './components/AIAssistant';
import './App.css';
import ExamPapers from './components/ExamPapers';
import ListeningLearning from './components/ListeningLearning';
import LearningStats from './components/LearningStats';
import UserProfile from './components/UserProfile';
import SpeakingPractice from './components/Speaking/SpeakingPractice';
import DataImport from './components/DataImport';
import SideToolPanel from './components/SideToolPanel';
import InternationalCourses from './components/InternationalCourses';
import ModelNicknamePanel from './components/ModelNicknamePanel';

function App() {
  const [activeTab, setActiveTab] = useState('learn');
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processLog, setProcessLog] = useState('');
  const [deleteOriginal, setDeleteOriginal] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  
  // 超级AI开关状态
  const [superAIEnabled, setSuperAIEnabled] = useState(() => {
    return localStorage.getItem('super_ai_enabled') === 'true';
  });
  
  // 添加头像状态
  const [userAvatar, setUserAvatar] = useState(null);
  
  // 监听头像变化
  useEffect(() => {
    const loadAvatar = () => {
      const profile = localStorage.getItem('user_profile');
      if (profile) {
        try {
          const parsed = JSON.parse(profile);
          setUserAvatar(parsed.avatar);
        } catch (e) {}
      }
    };
    loadAvatar();

    // 监听 storage 变化，跨标签页同步
    window.addEventListener('storage', loadAvatar);
    return () => window.removeEventListener('storage', loadAvatar);
  }, []);

  // 保存超级AI配置
  const handleSaveSuperAI = () => {
    localStorage.setItem('super_ai_enabled', superAIEnabled);
    // 触发事件通知其他组件
    window.dispatchEvent(new CustomEvent('superAIChanged', { detail: superAIEnabled }));
  };

  // ========== 学科模型配置（核心） ==========
  const SUBJECT_MODELS_CONFIG = {
    math: {
      name: '数学',
      icon: '🧮',
      color: '#1890ff',
      bgColor: '#f6ffed',
      borderColor: '#b7eb8f',
      options: [
        { value: 'qwen2-math:1.5b', label: '轻量模式：qwen2-math:1.5b（3-8秒，极速响应）', description: '适合基础计算、简单填空题' },
        { value: 'qwen2.5:7b', label: '快速模式：qwen2.5:7b（5-15秒，通用快速）', description: '适合中等难度题目' },
        { value: 'qwen2-math:7b', label: '标准模式：qwen2-math:7b（15-30秒，数学专项）', description: '适合数学难题、公式推导' },
        { value: 'qwen2.5:14b', label: '专业模式：qwen2.5:14b（20-40秒，大参数推理）', description: '适合压轴题、证明题' },
        { value: 'qwen2.5-coder:7b', label: '参考模式：qwen2.5-coder:7b（30-60秒，LaTeX美观）', description: '适合需要规范输出公式的场景' }
      ],
      defaultModel: 'qwen2-math:7b'
    },
    chinese: {
      name: '语文',
      icon: '📖',
      color: '#52c41a',
      bgColor: '#fff7e6',
      borderColor: '#ffc53d',
      options: [
        { value: 'qwen2.5:7b', label: '快速模式：qwen2.5:7b（5-15秒，基础阅读）', description: '适合基础知识、简单阅读理解' },
        { value: 'qwen2.5:14b', label: '专业模式：qwen2.5:14b（20-40秒，作文/阅读）', description: '适合阅读理解分析、作文批改' },
        { value: 'glm4:9b', label: '参考模式：glm4:9b（15-30秒，古文优化）', description: '适合古文理解、文学分析' }
      ],
      defaultModel: 'qwen2.5:14b'
    },
    english: {
      name: '英语',
      icon: '🇬🇧',
      color: '#fa8c16',
      bgColor: '#e6f7ff',
      borderColor: '#91d5ff',
      options: [
        { value: 'gemma3:4b', label: '快速模式：gemma3:4b（5-15秒，英语专用）', description: '适合基础语法、词汇' },
        { value: 'qwen2.5:7b', label: '标准模式：qwen2.5:7b（5-15秒，通用能力）', description: '适合中等难度阅读' },
        { value: 'qwen2.5:14b', label: '专业模式：qwen2.5:14b（20-40秒，阅读/写作）', description: '适合长难句分析、作文批改' },
        { value: 'qwen2.5-coder:7b', label: '参考模式：qwen2.5-coder:7b（30-60秒，翻译优化）', description: '适合中英互译、长难句解析' }
      ],
      defaultModel: 'gemma3:4b'
    }
  };

  // 初始化学科模型配置
  const getInitialSubjectModels = () => {
    const saved = localStorage.getItem('subject_models');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('解析保存的模型配置失败', e);
      }
    }
    return {
      math: SUBJECT_MODELS_CONFIG.math.defaultModel,
      chinese: SUBJECT_MODELS_CONFIG.chinese.defaultModel,
      english: SUBJECT_MODELS_CONFIG.english.defaultModel
    };
  };

  const [subjectModels, setSubjectModels] = useState(getInitialSubjectModels);

  // 保存学科模型配置
  const handleSaveModels = () => {
    localStorage.setItem('subject_models', JSON.stringify(subjectModels));
    window.dispatchEvent(new CustomEvent('modelsChanged', { detail: subjectModels }));
    setShowSettingsModal(false);
    alert('学科模型配置已保存');
  };

  // 更新单个学科的模型
  const updateSubjectModel = (subject, modelValue) => {
    setSubjectModels(prev => ({ ...prev, [subject]: modelValue }));
  };

  // ========== API 配置相关 ==========
  const [apiConfig, setApiConfig] = useState({
    aiPriority: localStorage.getItem('ai_priority') || 'local_first',
    deepseek: {
      apiUrl: localStorage.getItem('deepseek_api_url') || 'https://api.deepseek.com/v1',
      apiKey: localStorage.getItem('deepseek_api_key') || '',
      model: localStorage.getItem('deepseek_model') || 'deepseek-v4-flash',
      active: localStorage.getItem('deepseek_active') === 'true'
    },
    custom: {
      apiKey: localStorage.getItem('custom_api_key') || '',
      apiUrl: localStorage.getItem('custom_api_url') || '',
      model: localStorage.getItem('custom_model') || 'gpt-3.5-turbo',
      active: localStorage.getItem('custom_active') === 'true'
    }
  });

  // 测试 API 连接
  const testAPIConnection = async (type) => {
    let apiUrl, apiKey, modelName;

    if (type === 'deepseek') {
      apiUrl = apiConfig.deepseek.apiUrl || 'https://api.deepseek.com/v1';
      apiKey = apiConfig.deepseek.apiKey;
      modelName = apiConfig.deepseek.model;
    } else {
      apiUrl = apiConfig.custom.apiUrl;
      apiKey = apiConfig.custom.apiKey;
      modelName = apiConfig.custom.model;
    }

    if (!apiKey) {
      alert('请先填写 API Key');
      return;
    }
    if (type === 'custom' && !apiUrl) {
      alert('请先填写 API 地址');
      return;
    }

    try {
      const response = await axios.post('http://localhost:3001/api/config/test', {
        api_url: apiUrl,
        api_key: apiKey,
        model_name: modelName
      });
      
      if (response.data.success) {
        alert('✅ 连接成功！');
      } else {
        alert(`❌ 连接失败: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ 连接失败: ${error.message}`);
    }
  };

  // 保存 API 配置
  const saveApiConfig = () => {
    localStorage.setItem('ai_priority', apiConfig.aiPriority);
    localStorage.setItem('deepseek_api_url', apiConfig.deepseek.apiUrl);
    localStorage.setItem('deepseek_api_key', apiConfig.deepseek.apiKey);
    localStorage.setItem('deepseek_model', apiConfig.deepseek.model);
    localStorage.setItem('deepseek_active', apiConfig.deepseek.active);
    localStorage.setItem('custom_api_key', apiConfig.custom.apiKey);
    localStorage.setItem('custom_api_url', apiConfig.custom.apiUrl);
    localStorage.setItem('custom_model', apiConfig.custom.model);
    localStorage.setItem('custom_active', apiConfig.custom.active);
    
    alert('API 配置已保存（API Key 将加密存储在服务器）');
  };

  // 调用后端处理PDF
  const handleProcessDocs = async () => {
    setProcessing(true);
    setProcessLog('开始处理...');
    try {
      const response = await axios.post('http://localhost:3001/api/docs/process', {
        deleteOriginal: deleteOriginal
      });
      setProcessLog(response.data.message || '处理完成！');
      alert('学习资料处理完成！刷新页面查看新内容。');
      window.location.reload();
    } catch (error) {
      setProcessLog('处理失败: ' + error.message);
      alert('处理失败，请检查后端服务');
    }
    setProcessing(false);
  };

  const getNavButtonStyle = (tab) => ({
    background: activeTab === tab ? '#1890ff' : 'transparent',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    whiteSpace: 'nowrap'
  });

  return (
    <div className="App">
      {/* 侧边工具面板 */}
      <SideToolPanel 
        isOpen={showSidePanel} 
        onClose={() => setShowSidePanel(false)} 
      />
      
      {/* 导航栏 */}
      <div style={{
        display: 'flex',
        background: '#001529',
        padding: '0 12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        minHeight: '50px',
        gap: '8px'
      }}>
        {/* 左侧：菜单按钮 + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setShowSidePanel(!showSidePanel)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '8px'
            }}
            title="工具面板"
          >
            ☰
          </button>
          <img 
            src="/logo.png" 
            alt="AI伴学" 
            style={{ height: '32px', width: 'auto' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        {/* 中间：导航按钮 */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <button onClick={() => setActiveTab('learn')} style={getNavButtonStyle('learn')}>📚 学习</button>
          <button onClick={() => setActiveTab('exam')} style={getNavButtonStyle('exam')}>📝 真题</button>
          <button onClick={() => setActiveTab('listening')} style={getNavButtonStyle('listening')}>🎧 听力</button>
          <button onClick={() => setActiveTab('speaking')} style={getNavButtonStyle('speaking')}>🎤 口语</button>
          <button onClick={() => setActiveTab('ai')} style={getNavButtonStyle('ai')}>🤖 AI助教</button>
          <button onClick={() => setActiveTab('import')} style={getNavButtonStyle('import')}>📥 采集</button>
          <button onClick={() => setActiveTab('stats')} style={getNavButtonStyle('stats')}>📊 统计</button>
          <button onClick={() => setActiveTab('international')} style={getNavButtonStyle('international')}>🌍 国际</button>
        </div>

        {/* 右侧：用户头像 + 设置 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => setShowSettingsModal(true)} 
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer', padding: '6px' }} 
            title="系统设置"
          >
            ⚙️
          </button>
          <button 
            onClick={() => setActiveTab('profile')} 
            style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}
            title="我的"
          >
            {userAvatar ? (
              <img src={userAvatar} alt="avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '20px' }}>👤</span>
            )}
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      {activeTab === 'learn' && <KnowledgeLearning />}
      {activeTab === 'ai' && <AIAssistant />}
      {activeTab === 'exam' && <ExamPapers />}
      {activeTab === 'listening' && <ListeningLearning />}
      {activeTab === 'speaking' && <SpeakingPractice />}
      {activeTab === 'stats' && <LearningStats />}
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'import' && <DataImport />}
      {activeTab === 'international' && <InternationalCourses />}

      {/* 📄 批量处理Word弹窗 */}
      {showProcessModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%' }}>
            <h3>📄 批量处理Word文档</h3>
            <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <p><strong>使用说明：</strong></p>
              <ol style={{ margin: '8px 0 0 20px', lineHeight: '1.6' }}>
                <li>将Word文档（.docx）放入 <code>data/docs/学科/版本/</code> 文件夹</li>
                <li>学科可选：<code>chinese</code>、<code>math</code>、<code>english</code></li>
                <li>版本可选：<code>2025</code>、<code>2026</code></li>
                <li>点击下方按钮自动清理广告并转换为PDF</li>
              </ol>
            </div>
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input type="checkbox" id="deleteOriginal" checked={deleteOriginal} onChange={(e) => setDeleteOriginal(e.target.checked)} />
              <label htmlFor="deleteOriginal">处理完成后删除原始 .docx 文件（节省空间）</label>
            </div>
            {processLog && <div style={{ background: '#e6f7ff', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '12px', fontFamily: 'monospace', maxHeight: '150px', overflow: 'auto' }}>{processLog}</div>}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowProcessModal(false); setProcessLog(''); setDeleteOriginal(false); }} style={{ padding: '8px 16px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
              <button onClick={handleProcessDocs} disabled={processing} style={{ padding: '8px 16px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: processing ? 'not-allowed' : 'pointer' }}>{processing ? '处理中...' : '开始预处理'}</button>
            </div>
          </div>
        </div>
      )}

    {/* ⚙️ 系统设置弹窗 */}
    {showSettingsModal && (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{
                background: 'white', padding: '24px', borderRadius: '12px', width: '750px', maxWidth: '95%',
                maxHeight: '85vh', overflow: 'auto'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px' }}>⚙️ 系统设置</h3>

                {/* 标签页切换 */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '20px',
                    borderBottom: '1px solid #e8e8e8',
                    paddingBottom: '10px'
                }}>
                    <button
                        onClick={() => setSettingsTab('general')}
                        style={{
                            padding: '6px 16px',
                            background: settingsTab === 'general' ? '#1890ff' : '#f0f0f0',
                            color: settingsTab === 'general' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        ⚙️ 通用设置
                    </button>
                    <button
                        onClick={() => setSettingsTab('models')}
                        style={{
                            padding: '6px 16px',
                            background: settingsTab === 'models' ? '#1890ff' : '#f0f0f0',
                            color: settingsTab === 'models' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        🤖 AI 模型配置
                    </button>
                    <button
                        onClick={() => setSettingsTab('nickname')}
                        style={{
                            padding: '6px 16px',
                            background: settingsTab === 'nickname' ? '#1890ff' : '#f0f0f0',
                            color: settingsTab === 'nickname' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        🎭 AI 模型昵称
                    </button>
                    <button
                        onClick={() => setSettingsTab('api')}
                        style={{
                            padding: '6px 16px',
                            background: settingsTab === 'api' ? '#1890ff' : '#f0f0f0',
                            color: settingsTab === 'api' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        🌐 云端 API 配置
                    </button>
                </div>

                {/* 根据标签页显示不同内容 */}
                {settingsTab === 'general' && (
                    <>
                        {/* 家长邮箱 */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>📧 家长邮箱</label>
                            <input type="email" placeholder="parent@example.com" defaultValue={localStorage.getItem('parent_email') || ''} onChange={(e) => localStorage.setItem('parent_email', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                            <p style={{ fontSize: '12px', color: '#999', marginTop: '4px', marginBottom: 0 }}>学习报告将发送到此邮箱</p>
                        </div>

                        {/* 春考日期 */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>📅 目标考试日期</label>
                            <input type="date" defaultValue={localStorage.getItem('exam_date') || '2027-01-09'} onChange={(e) => localStorage.setItem('exam_date', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                        </div>

                        {/* 🔥 超级AI入口 */}
                        <div style={{ marginBottom: '20px', padding: '16px', background: '#f0f7ff', borderRadius: '8px', border: '1px solid #91d5ff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                    <strong>🧠 超级AI（35B本地模型）</strong>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                        适合难题，响应慢但效果好，需要 8GB+ 显存
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#ff9800', marginTop: '8px', padding: '6px', background: '#fff7e6', borderRadius: '6px' }}>
                                        💡 提示：请先运行 ollama.bat 启动服务
                                    </div>
                                </div>
                                <button
                                    onClick={() => window.open('http://127.0.0.1:8080', '_blank')}
                                    style={{
                                        padding: '8px 20px',
                                        background: '#52c41a',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    🚀 打开超级AI
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {settingsTab === 'models' && (
                    <>
                        {/* 数学学科模型 */}
                        <div style={{ marginBottom: '20px', background: SUBJECT_MODELS_CONFIG.math.bgColor, padding: '16px', borderRadius: '8px', border: `1px solid ${SUBJECT_MODELS_CONFIG.math.borderColor}` }}>
                            <h4 style={{ margin: '0 0 12px 0', color: SUBJECT_MODELS_CONFIG.math.color }}>{SUBJECT_MODELS_CONFIG.math.icon} {SUBJECT_MODELS_CONFIG.math.name}学科模型</h4>
                            <select value={subjectModels.math} onChange={(e) => updateSubjectModel('math', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}>
                                {SUBJECT_MODELS_CONFIG.math.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>

                        {/* 语文学科模型 */}
                        <div style={{ marginBottom: '20px', background: SUBJECT_MODELS_CONFIG.chinese.bgColor, padding: '16px', borderRadius: '8px', border: `1px solid ${SUBJECT_MODELS_CONFIG.chinese.borderColor}` }}>
                            <h4 style={{ margin: '0 0 12px 0', color: SUBJECT_MODELS_CONFIG.chinese.color }}>{SUBJECT_MODELS_CONFIG.chinese.icon} {SUBJECT_MODELS_CONFIG.chinese.name}学科模型</h4>
                            <select value={subjectModels.chinese} onChange={(e) => updateSubjectModel('chinese', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}>
                                {SUBJECT_MODELS_CONFIG.chinese.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>

                        {/* 英语学科模型 */}
                        <div style={{ marginBottom: '20px', background: SUBJECT_MODELS_CONFIG.english.bgColor, padding: '16px', borderRadius: '8px', border: `1px solid ${SUBJECT_MODELS_CONFIG.english.borderColor}` }}>
                            <h4 style={{ margin: '0 0 12px 0', color: SUBJECT_MODELS_CONFIG.english.color }}>{SUBJECT_MODELS_CONFIG.english.icon} {SUBJECT_MODELS_CONFIG.english.name}学科模型</h4>
                            <select value={subjectModels.english} onChange={(e) => updateSubjectModel('english', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}>
                                {SUBJECT_MODELS_CONFIG.english.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                    </>
                )}

                {settingsTab === 'nickname' && (
                    <ModelNicknamePanel />
                )}

                {settingsTab === 'api' && (
                    <>
                        {/* API 优先级 */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>AI 调用优先级</label>
                            <select 
                                value={apiConfig.aiPriority}
                                onChange={(e) => setApiConfig({ ...apiConfig, aiPriority: e.target.value })}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d9d9d9' }}
                            >
                                <option value="local_first">本地优先（本地失败时自动切换到云端）</option>
                                <option value="cloud_first">云端优先（云端失败时切换到本地）</option>
                                <option value="local_only">仅使用本地 Ollama</option>
                                <option value="cloud_only">仅使用云端 API</option>
                            </select>
                        </div>

                        {/* DeepSeek 配置 */}
                        <div style={{ marginBottom: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <strong>🔗 DeepSeek API</strong>
                                <button onClick={() => testAPIConnection('deepseek')} style={{ padding: '4px 12px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>测试连接</button>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="text" placeholder="API 地址" value={apiConfig.deepseek.apiUrl} onChange={(e) => setApiConfig({ ...apiConfig, deepseek: { ...apiConfig.deepseek, apiUrl: e.target.value } })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="password" placeholder="API Key" value={apiConfig.deepseek.apiKey} onChange={(e) => setApiConfig({ ...apiConfig, deepseek: { ...apiConfig.deepseek, apiKey: e.target.value } })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input type="text" placeholder="模型名称" value={apiConfig.deepseek.model} onChange={(e) => setApiConfig({ ...apiConfig, deepseek: { ...apiConfig.deepseek, model: e.target.value } })} style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input type="checkbox" checked={apiConfig.deepseek.active} onChange={(e) => setApiConfig({ ...apiConfig, deepseek: { ...apiConfig.deepseek, active: e.target.checked } })} />
                                    启用
                                </label>
                            </div>
                        </div>

                        {/* 自定义 API */}
                        <div style={{ marginBottom: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <strong>⚙️ 自定义 API（OpenAI 兼容）</strong>
                                <button onClick={() => testAPIConnection('custom')} style={{ padding: '4px 12px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>测试连接</button>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="password" placeholder="API Key" value={apiConfig.custom.apiKey} onChange={(e) => setApiConfig({ ...apiConfig, custom: { ...apiConfig.custom, apiKey: e.target.value } })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="text" placeholder="API 地址" value={apiConfig.custom.apiUrl} onChange={(e) => setApiConfig({ ...apiConfig, custom: { ...apiConfig.custom, apiUrl: e.target.value } })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input type="text" placeholder="模型名称" value={apiConfig.custom.model} onChange={(e) => setApiConfig({ ...apiConfig, custom: { ...apiConfig.custom, model: e.target.value } })} style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input type="checkbox" checked={apiConfig.custom.active} onChange={(e) => setApiConfig({ ...apiConfig, custom: { ...apiConfig.custom, active: e.target.checked } })} />
                                    启用
                                </label>
                            </div>
                        </div>

                        <div style={{ fontSize: '12px', color: '#999', padding: '8px', background: '#fff7e6', borderRadius: '6px' }}>
                            🔒 API Key 将加密存储在服务器端
                        </div>
                    </>
                )}

                {/* 按钮组 */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button onClick={() => setShowSettingsModal(false)} style={{ padding: '8px 20px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>关闭</button>
                    {settingsTab !== 'nickname' && (
                        <button onClick={() => { saveApiConfig(); handleSaveModels(); handleSaveSuperAI(); }} style={{ padding: '8px 20px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>保存配置</button>
                    )}
                </div>
            </div>
        </div>
    )}
    </div>
  );
}

export default App;