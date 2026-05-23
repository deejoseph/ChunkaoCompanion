// frontend/src/components/Speaking/SpeakingPractice.jsx
import { useState } from 'react';
import SpeakingNav from './shared/SpeakingNav';
import GeneralSpeaking from './modules/GeneralSpeaking';
import IELTSSpeaking from './modules/IELTS';

function SpeakingPractice() {
    const [activeModule, setActiveModule] = useState('general');

    const renderModule = () => {
        switch (activeModule) {
            case 'ielts':
                return <IELTSSpeaking />;
            case 'toefl':
                return <div style={{ textAlign: 'center', padding: '60px' }}>
                    <span style={{ fontSize: '48px' }}>🌍</span>
                    <h3>托福口语模块</h3>
                    <p style={{ color: '#666' }}>开发中，敬请期待...</p>
                </div>;
            default:
                return <GeneralSpeaking />;
        }
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            <SpeakingNav activeModule={activeModule} onSwitch={setActiveModule} />
            {renderModule()}
        </div>
    );
}

export default SpeakingPractice;