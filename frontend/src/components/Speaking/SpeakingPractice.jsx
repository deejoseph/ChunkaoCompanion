// frontend/src/components/Speaking/SpeakingPractice.jsx
import { useState } from 'react';
import SpeakingNav from './shared/SpeakingNav';
import GeneralSpeaking from './modules/GeneralSpeaking';
import IELTSSpeaking from './modules/IELTS';
import TOEFLSpeaking from './modules/TOEFL';  // 新增

function SpeakingPractice() {
    const [activeModule, setActiveModule] = useState('general');
    const [recognitionEngine, setRecognitionEngine] = useState(() => {
        return localStorage.getItem('speaking_recognition_engine') || 'webspeech';
    });

    const renderModule = () => {
        const commonProps = { recognitionEngine, setRecognitionEngine };
        switch (activeModule) {
            case 'ielts':
                return <IELTSSpeaking {...commonProps} />;
            case 'toefl':
                return <TOEFLSpeaking {...commonProps} />;  // 改为真实组件
            default:
                return <GeneralSpeaking {...commonProps} />;
        }
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            <SpeakingNav 
                activeModule={activeModule} 
                onSwitch={setActiveModule}
                recognitionEngine={recognitionEngine}
                onRecognitionEngineChange={setRecognitionEngine}
            />
            {renderModule()}
        </div>
    );
}

export default SpeakingPractice;