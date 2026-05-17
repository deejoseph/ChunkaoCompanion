import { useState, useEffect } from 'react';
import axios from 'axios';
import KnowledgeLearning from './components/KnowledgeLearning';
import AIAssistant from './components/AIAssistant';
import './App.css';
import ExamPapers from './components/ExamPapers';
import Listening from './components/Listening';
import LearningStats from './components/LearningStats';
import SpeakingPractice from './components/SpeakingPractice';
import DataImport from './components/DataImport';

function App() {
  const [activeTab, setActiveTab] = useState('learn');
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processLog, setProcessLog] = useState('');
  const [deleteOriginal, setDeleteOriginal] = useState(false);

  // ========== 学科模型配置（核心） ==========
  // 每个学科独立配置模型，不再使用全局单一模型
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
        { value: 'glm4:9b', label: '参考模式：glm4:9b（15-30秒，古文优化）', description: '适合古文理解、文学分析' }  // 替换为 glm4:9b
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
    // 返回默认配置
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
    
    // 触发事件通知 AIAssistant 更新
    window.dispatchEvent(new CustomEvent('modelsChanged', {
      detail: subjectModels
    }));
    
    setShowSettingsModal(false);
    alert('学科模型配置已保存');
  };

  // 更新单个学科的模型
  const updateSubjectModel = (subject, modelValue) => {
    setSubjectModels(prev => ({
      ...prev,
      [subject]: modelValue
    }));
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

  // 获取当前激活的导航项样式
  const getNavButtonStyle = (tab) => ({
    background: activeTab === tab ? '#1890ff' : 'transparent',
    color: 'white',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '4px',
    cursor: 'pointer'
  });

  return (
    <div className="App">
      {/* 导航栏 */}
      <div style={{
        display: 'flex',
        background: '#001529',
        padding: '0 12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        minHeight: '60px',
        gap: '8px'
      }}>
        {/* 左侧 Logo + 导航按钮 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <h1 style={{ 
            color: 'white', 
            margin: 0, 
            fontSize: 'clamp(16px, 5vw, 20px)',
            whiteSpace: 'nowrap'
          }}>
            🎯 春考伴学
          </h1>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('learn')} style={getNavButtonStyle('learn')}>📚 知识点学习</button>
            <button onClick={() => setActiveTab('exam')} style={getNavButtonStyle('exam')}>📝 真题模考</button>
            <button onClick={() => setActiveTab('listening')} style={getNavButtonStyle('listening')}>🎧 听力训练</button>
            <button onClick={() => setActiveTab('speaking')} style={getNavButtonStyle('speaking')}>🎤 口语练习</button>
            <button onClick={() => setActiveTab('ai')} style={getNavButtonStyle('ai')}>🤖 AI助教</button>
          </div>
        </div>

        {/* 右侧功能图标区 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('import')} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 'clamp(16px, 4vw, 20px)', cursor: 'pointer', padding: '6px' }} title="新资料采集">📥</button>
          <button onClick={() => setShowSettingsModal(true)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 'clamp(16px, 4vw, 20px)', cursor: 'pointer', padding: '6px' }} title="系统设置">⚙️</button>
          <button onClick={() => setActiveTab('stats')} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 'clamp(16px, 4vw, 20px)', cursor: 'pointer', padding: '6px' }} title="学习统计">📊</button>
          <button style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 'clamp(16px, 4vw, 20px)', cursor: 'pointer', padding: '6px' }} title="学习进度">📈</button>
          <button style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 'clamp(16px, 4vw, 20px)', cursor: 'pointer', padding: '6px' }} title="帮助">ℹ️</button>
        </div>
      </div>

      {/* 内容区域 */}
      {activeTab === 'learn' && <KnowledgeLearning />}
      {activeTab === 'ai' && <AIAssistant key={JSON.stringify(subjectModels)} />}
      {activeTab === 'exam' && <ExamPapers />}
      {activeTab === 'listening' && <Listening />}
      {activeTab === 'speaking' && <SpeakingPractice />}
      {activeTab === 'stats' && <LearningStats />}
      {activeTab === 'import' && <DataImport />}

      {/* 📄 批量处理Word弹窗 */}
      {showProcessModal && (
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
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '500px',
            maxWidth: '90%'
          }}>
            <h3>📄 批量处理Word文档</h3>
            <div style={{
              background: '#f5f5f5',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p><strong>使用说明：</strong></p>
              <ol style={{ margin: '8px 0 0 20px', lineHeight: '1.6' }}>
                <li>将Word文档（.docx）放入 <code>data/docs/学科/版本/</code> 文件夹</li>
                <li>学科可选：<code>chinese</code>、<code>math</code>、<code>english</code></li>
                <li>版本可选：<code>2025</code>、<code>2026</code></li>
                <li>点击下方按钮自动清理广告并转换为PDF</li>
              </ol>
            </div>
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input type="checkbox" id="deleteOriginal" checked={deleteOriginal} onChange={(e) => setDeleteOriginal(e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <label htmlFor="deleteOriginal">处理完成后删除原始 .docx 文件（节省空间）</label>
            </div>
            {processLog && (
              <div style={{
                background: '#e6f7ff',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '15px',
                fontSize: '12px',
                fontFamily: 'monospace',
                maxHeight: '150px',
                overflow: 'auto'
              }}>
                {processLog}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowProcessModal(false); setProcessLog(''); setDeleteOriginal(false); }} style={{ padding: '8px 16px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
              <button onClick={handleProcessDocs} disabled={processing} style={{ padding: '8px 16px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: processing ? 'not-allowed' : 'pointer' }}>{processing ? '处理中...' : '开始预处理'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 系统设置弹窗 - 学科中心化模型配置 */}
      {showSettingsModal && (
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
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '650px',
            maxWidth: '95%',
            maxHeight: '85vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>⚙️ 系统设置</h3>
            
            {/* 家长邮箱 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>📧 家长邮箱</label>
              <input type="email" placeholder="parent@example.com" defaultValue={localStorage.getItem('parent_email') || ''} onChange={(e) => localStorage.setItem('parent_email', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
              <p style={{ fontSize: '12px', color: '#999', marginTop: '4px', marginBottom: 0 }}>学习报告将发送到此邮箱</p>
            </div>

            {/* 春考日期 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>📅 春考日期</label>
              <input type="date" defaultValue={localStorage.getItem('exam_date') || '2027-01-09'} onChange={(e) => localStorage.setItem('exam_date', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            </div>

            {/* 分隔线 */}
            <div style={{ borderTop: '1px solid #e8e8e8', margin: '20px 0 16px 0', textAlign: 'center', position: 'relative' }}>
              <span style={{ background: 'white', padding: '0 12px', position: 'relative', top: '-12px', color: '#999', fontSize: '12px' }}>🤖 AI 模型配置（各学科独立）</span>
            </div>

            {/* 数学学科模型 */}
            <div style={{ marginBottom: '20px', background: SUBJECT_MODELS_CONFIG.math.bgColor, padding: '16px', borderRadius: '8px', border: `1px solid ${SUBJECT_MODELS_CONFIG.math.borderColor}` }}>
              <h4 style={{ margin: '0 0 12px 0', color: SUBJECT_MODELS_CONFIG.math.color }}>{SUBJECT_MODELS_CONFIG.math.icon} {SUBJECT_MODELS_CONFIG.math.name}学科模型</h4>
              <select
                value={subjectModels.math}
                onChange={(e) => updateSubjectModel('math', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                {SUBJECT_MODELS_CONFIG.math.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginBottom: 0 }}>
                💡 {SUBJECT_MODELS_CONFIG.math.options.find(o => o.value === subjectModels.math)?.description || '选择适合的模型'}
              </p>
            </div>

            {/* 语文学科模型 */}
            <div style={{ marginBottom: '20px', background: SUBJECT_MODELS_CONFIG.chinese.bgColor, padding: '16px', borderRadius: '8px', border: `1px solid ${SUBJECT_MODELS_CONFIG.chinese.borderColor}` }}>
              <h4 style={{ margin: '0 0 12px 0', color: SUBJECT_MODELS_CONFIG.chinese.color }}>{SUBJECT_MODELS_CONFIG.chinese.icon} {SUBJECT_MODELS_CONFIG.chinese.name}学科模型</h4>
              <select
                value={subjectModels.chinese}
                onChange={(e) => updateSubjectModel('chinese', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                {SUBJECT_MODELS_CONFIG.chinese.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginBottom: 0 }}>
                💡 {SUBJECT_MODELS_CONFIG.chinese.options.find(o => o.value === subjectModels.chinese)?.description || '选择适合的模型'}
              </p>
            </div>

            {/* 英语学科模型 */}
            <div style={{ marginBottom: '20px', background: SUBJECT_MODELS_CONFIG.english.bgColor, padding: '16px', borderRadius: '8px', border: `1px solid ${SUBJECT_MODELS_CONFIG.english.borderColor}` }}>
              <h4 style={{ margin: '0 0 12px 0', color: SUBJECT_MODELS_CONFIG.english.color }}>{SUBJECT_MODELS_CONFIG.english.icon} {SUBJECT_MODELS_CONFIG.english.name}学科模型</h4>
              <select
                value={subjectModels.english}
                onChange={(e) => updateSubjectModel('english', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                {SUBJECT_MODELS_CONFIG.english.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginBottom: 0 }}>
                💡 {SUBJECT_MODELS_CONFIG.english.options.find(o => o.value === subjectModels.english)?.description || '选择适合的模型'}
              </p>
            </div>

            {/* 按钮组 */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowSettingsModal(false)} style={{ padding: '8px 20px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveModels} style={{ padding: '8px 20px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>保存配置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;