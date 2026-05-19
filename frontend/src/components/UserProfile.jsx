import { useState, useEffect, useRef } from 'react';

function UserProfile() {
    const [profile, setProfile] = useState({
        avatar: null,
        nickname: '',
        grade: '',
        targetSchool: '',
        motto: '',
        studyDays: 0,
        completedTopics: 0,
        totalTopics: 0
    });
    const [isEditing, setIsEditing] = useState(false);
    const [tempProfile, setTempProfile] = useState({});
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadUserData();
        loadStudyStats();
    }, []);

    const loadUserData = () => {
        const saved = localStorage.getItem('user_profile');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setProfile(prev => ({ ...prev, ...parsed }));
                setTempProfile({ ...parsed });
            } catch (e) {
                console.error('加载用户数据失败', e);
            }
        } else {
            const defaultProfile = {
                avatar: null,
                nickname: '同学',
                grade: '高三',
                targetSchool: '上海大学',
                motto: '天道酬勤',
                studyDays: 1,
                completedTopics: 0,
                totalTopics: 0
            };
            setProfile(defaultProfile);
            setTempProfile(defaultProfile);
        }
    };

    const loadStudyStats = () => {
        let completed = 0;
        let total = 0;
        
        const subjects = ['chinese', 'math', 'english'];
        const versions = ['2025', '2026'];
        
        subjects.forEach(subject => {
            versions.forEach(version => {
                const totalKey = `total_${subject}_${version}`;
                const totalCount = parseInt(localStorage.getItem(totalKey) || '0');
                total += totalCount;
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(`topic_${subject}_`)) {
                        const status = localStorage.getItem(key);
                        if (status) {
                            try {
                                const parsed = JSON.parse(status);
                                if (parsed.completed) completed++;
                            } catch (e) {}
                        }
                    }
                }
            });
        });
        
        setProfile(prev => ({ ...prev, completedTopics: completed, totalTopics: total }));
    };

    const handleAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            setTempProfile({ ...tempProfile, avatar: event.target.result });
        };
        reader.readAsDataURL(file);
    };

    const handleInputChange = (field, value) => {
        setTempProfile({ ...tempProfile, [field]: value });
    };

    const saveProfile = () => {
        const joinDate = localStorage.getItem('join_date');
        let studyDays = 1;
        if (joinDate) {
            const start = new Date(joinDate);
            const now = new Date();
            const diffTime = Math.abs(now - start);
            studyDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        } else {
            localStorage.setItem('join_date', new Date().toISOString());
        }
        
        const finalProfile = {
            ...tempProfile,
            studyDays: studyDays,
            completedTopics: profile.completedTopics,
            totalTopics: profile.totalTopics
        };
        
        localStorage.setItem('user_profile', JSON.stringify(finalProfile));
        setProfile(finalProfile);
        setIsEditing(false);
        alert('保存成功');
    };

    const cancelEdit = () => {
        setTempProfile(profile);
        setIsEditing(false);
    };

    const grades = ['高一', '高二', '高三', '复读'];
    const targetSchools = ['上海大学', '上海交通大学', '复旦大学', '同济大学', '华东师范大学', '上海财经大学', '其他'];

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
            {/* 个人资料卡片 - 无蓝色封面 */}
            <div style={{
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                padding: '24px'
            }}>
                {/* 编辑按钮 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            style={{
                                padding: '6px 16px',
                                background: '#f0f0f0',
                                color: '#333',
                                border: 'none',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontSize: '13px'
                            }}
                        >
                            编辑资料
                        </button>
                    )}
                </div>

                {/* 头像和昵称区域 - 全部在白色卡片内 */}
                <div style={{ display: 'flex', marginBottom: '24px', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <div
                        style={{
                            width: '80px',
                            height: '80px',
                            background: '#f5f5f5',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            cursor: isEditing ? 'pointer' : 'default',
                            border: '2px solid #e8e8e8'
                        }}
                        onClick={() => isEditing && fileInputRef.current?.click()}
                    >
                        {tempProfile.avatar ? (
                            <img src={tempProfile.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span style={{ fontSize: '40px' }}>👤</span>
                        )}
                    </div>
                    {isEditing && (
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleAvatarUpload}
                        />
                    )}
                    <div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={tempProfile.nickname || ''}
                                onChange={(e) => handleInputChange('nickname', e.target.value)}
                                placeholder="昵称"
                                style={{
                                    fontSize: '20px',
                                    fontWeight: 'bold',
                                    border: '1px solid #d9d9d9',
                                    borderRadius: '8px',
                                    padding: '4px 12px',
                                    width: '180px'
                                }}
                            />
                        ) : (
                            <h2 style={{ margin: 0, fontSize: '22px' }}>{profile.nickname || '同学'}</h2>
                        )}
                        {!isEditing && profile.motto && (
                            <p style={{ margin: '8px 0 0', color: '#999', fontSize: '13px' }}>“{profile.motto}”</p>
                        )}
                    </div>
                </div>

                {/* 信息表单 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div>
                        <label style={{ display: 'block', color: '#666', fontSize: '12px', marginBottom: '4px' }}>年级</label>
                        {isEditing ? (
                            <select
                                value={tempProfile.grade || ''}
                                onChange={(e) => handleInputChange('grade', e.target.value)}
                                style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '8px' }}
                            >
                                <option value="">请选择</option>
                                {grades.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        ) : (
                            <div style={{ padding: '8px 0', fontSize: '14px' }}>{profile.grade || '未设置'}</div>
                        )}
                    </div>
                    <div>
                        <label style={{ display: 'block', color: '#666', fontSize: '12px', marginBottom: '4px' }}>目标院校</label>
                        {isEditing ? (
                            <select
                                value={tempProfile.targetSchool || ''}
                                onChange={(e) => handleInputChange('targetSchool', e.target.value)}
                                style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '8px' }}
                            >
                                <option value="">请选择</option>
                                {targetSchools.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        ) : (
                            <div style={{ padding: '8px 0', fontSize: '14px' }}>{profile.targetSchool || '未设置'}</div>
                        )}
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', color: '#666', fontSize: '12px', marginBottom: '4px' }}>座右铭</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={tempProfile.motto || ''}
                                onChange={(e) => handleInputChange('motto', e.target.value)}
                                placeholder="写一句激励自己的话"
                                style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '8px' }}
                            />
                        ) : (
                            <div style={{ padding: '8px 0', fontSize: '14px', color: '#666' }}>{profile.motto || '未设置'}</div>
                        )}
                    </div>
                </div>

                {/* 学习统计卡片 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                    padding: '16px',
                    background: '#fafafa',
                    borderRadius: '12px',
                    marginBottom: '16px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                            {profile.completedTopics || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>已完成专题</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                            {profile.totalTopics || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>总专题数</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                            {profile.totalTopics ? Math.round((profile.completedTopics / profile.totalTopics) * 100) : 0}%
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>学习进度</div>
                    </div>
                </div>

                {/* 学习天数 */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderTop: '1px solid #f0f0f0'
                }}>
                    <span style={{ color: '#666', fontSize: '14px' }}>📅 加入天数</span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>{profile.studyDays || 1} 天</span>
                </div>

                {/* 编辑模式按钮 */}
                {isEditing && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={cancelEdit}
                            style={{
                                padding: '8px 20px',
                                background: '#f0f0f0',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            取消
                        </button>
                        <button
                            onClick={saveProfile}
                            style={{
                                padding: '8px 20px',
                                background: '#1890ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            保存
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default UserProfile;