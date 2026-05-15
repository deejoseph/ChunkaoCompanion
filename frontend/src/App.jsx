import { useState } from 'react';
import axios from 'axios';
import KnowledgeLearning from './components/KnowledgeLearning';
import AIAssistant from './components/AIAssistant';
import './App.css';
import ExamPapers from './components/ExamPapers';
import Listening from './components/Listening';
import LearningStats from './components/LearningStats';

function App() {
  const [activeTab, setActiveTab] = useState('learn');
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processLog, setProcessLog] = useState('');
  const [deleteOriginal, setDeleteOriginal] = useState(false);

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

  // 保存设置并发送模型变更事件
  const handleSaveSettings = () => {
    // 保存设置
    if (window._tempParentEmail !== undefined) {
      localStorage.setItem('parent_email', window._tempParentEmail);
    }
    if (window._tempAiModel !== undefined) {
      localStorage.setItem('ai_model', window._tempAiModel);
    }
    if (window._tempExamDate !== undefined) {
      localStorage.setItem('exam_date', window._tempExamDate);
    }
    
    // 发送自定义事件，通知 AI 助教模型已变更
    const event = new CustomEvent('modelPreferenceChanged', {
      detail: { 
        model: window._tempAiModel || localStorage.getItem('ai_model') || 'math_medium'
      }
    });
    window.dispatchEvent(event);
    
    setShowSettingsModal(false);
    alert('设置已保存');
  };

  return (
    <div className="App">
      {/* 导航栏 */}
    {/* 导航栏 - 响应式 */}
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
            <div style={{ 
                display: 'flex', 
                gap: '8px',
                flexWrap: 'wrap'
            }}>
                <button
                    onClick={() => setActiveTab('learn')}
                    style={{
                        background: activeTab === 'learn' ? '#1890ff' : 'transparent',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: 'clamp(12px, 3vw, 14px)',
                        whiteSpace: 'nowrap'
                    }}
                >
                    📚 学习
                </button>
                <button
                    onClick={() => setActiveTab('exam')}
                    style={{
                        background: activeTab === 'exam' ? '#1890ff' : 'transparent',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: 'clamp(12px, 3vw, 14px)',
                        whiteSpace: 'nowrap'
                    }}
                >
                    📝 真题
                </button>
                <button
                    onClick={() => setActiveTab('listening')}
                    style={{
                        background: activeTab === 'listening' ? '#1890ff' : 'transparent',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: 'clamp(12px, 3vw, 14px)',
                        whiteSpace: 'nowrap'
                    }}
                >
                    🎧 听力
                </button>    
                <button
                    onClick={() => setActiveTab('ai')}
                    style={{
                        background: activeTab === 'ai' ? '#1890ff' : 'transparent',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: 'clamp(12px, 3vw, 14px)',
                        whiteSpace: 'nowrap'
                    }}
                >
                    🤖 AI
                </button>
            </div>
        </div>

        {/* 右侧功能图标区 */}
        <div style={{ 
            display: 'flex', 
            gap: '12px', 
            alignItems: 'center',
            flexWrap: 'wrap'
        }}>
            {/* 📄 批量处理Word转PDF */}
            <button
                onClick={() => setShowProcessModal(true)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: 'clamp(16px, 4vw, 20px)',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="批量处理Word文档（清理广告+转PDF）"
            >
                📄
            </button>

            {/* ⚙️ 系统设置 */}
            <button
                onClick={() => setShowSettingsModal(true)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: 'clamp(16px, 4vw, 20px)',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="系统设置"
            >
                ⚙️
            </button>

            {/* 学习统计 */}
            <button
                onClick={() => setActiveTab('stats')}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: 'clamp(16px, 4vw, 20px)',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="学习统计"
            >
                📊
            </button>

            {/* 进度报告 */}
            <button
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: 'clamp(16px, 4vw, 20px)',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="学习进度"
            >
                📈
            </button>

            {/* 帮助 */}
            <button
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: 'clamp(16px, 4vw, 20px)',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="帮助"
            >
                ℹ️
            </button>
        </div>
    </div>

      {/* 内容区域 */}
      {activeTab === 'learn' && <KnowledgeLearning />}
      {activeTab === 'ai' && <AIAssistant />}
      {activeTab === 'exam' && <ExamPapers />}
      {activeTab === 'listening' && <Listening />}
    {activeTab === 'stats' && <LearningStats />}

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

            {/* 是否删除原文件 */}
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                id="deleteOriginal"
                checked={deleteOriginal}
                onChange={(e) => setDeleteOriginal(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="deleteOriginal">
                处理完成后删除原始 .docx 文件（节省空间）
              </label>
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
              <button
                onClick={() => {
                  setShowProcessModal(false);
                  setProcessLog('');
                  setDeleteOriginal(false);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleProcessDocs}
                disabled={processing}
                style={{
                  padding: '8px 16px',
                  background: '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: processing ? 'not-allowed' : 'pointer'
                }}
              >
                {processing ? '处理中...' : '开始预处理'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 系统设置弹窗 */}
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
            width: '500px',
            maxWidth: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>⚙️ 系统设置</h3>
            
            {/* 家长邮箱 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                家长邮箱
              </label>
              <input
                type="email"
                placeholder="parent@example.com"
                defaultValue={localStorage.getItem('parent_email') || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  window._tempParentEmail = value;
                }}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: '12px', color: '#999', marginTop: '4px', marginBottom: 0 }}>
                学习报告将发送到此邮箱
              </p>
            </div>

            {/* AI模型选择 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                🤖 AI模型选择
              </label>
              <select
                id="aiModelSelect"
                defaultValue={localStorage.getItem('ai_model') || 'math_medium'}
                onChange={(e) => {
                  const value = e.target.value;
                  window._tempAiModel = value;
                }}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box',
                  fontSize: '14px'
                }}
              >
                <option value="math_fast">⚡ 快速模式 - qwen2-math:1.5b（5-10秒，普通题型）</option>
                <option value="math_medium">🚀 中速模式 - qwen2-math:7b（20-30秒，疑难题目）</option>
                <option value="math_balanced">🎨 均衡模式 - qwen2.5-coder:7b（40-60秒，公式美观）</option>
              </select>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '4px', marginBottom: 0 }}>
                快速模式：响应快，但公式显示格式可能不完美；美观模式：公式显示更好，适合正式学习
              </p>
            </div>

            {/* 春考日期 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                📅 春考日期
              </label>
              <input
                type="date"
                defaultValue={localStorage.getItem('exam_date') || '2027-01-09'}
                onChange={(e) => {
                  const value = e.target.value;
                  window._tempExamDate = value;
                }}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* 按钮组 */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  padding: '8px 20px',
                  background: '#f0f0f0',
                  color: '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleSaveSettings}
                style={{
                  padding: '8px 20px',
                  background: '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                保存并关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;