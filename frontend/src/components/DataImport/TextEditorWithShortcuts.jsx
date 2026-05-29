import React, { useRef, useEffect } from 'react';

/**
 * 支持快捷键的文本编辑器组件
 * 支持: Ctrl+Z(撤销), Ctrl+Y/Ctrl+Shift+Z(重做), Ctrl+A(全选), Ctrl+C(复制), Ctrl+V(粘贴), Ctrl+X(剪切)
 */
const TextEditorWithShortcuts = ({
    value,
    onChange,
    placeholder = '',
    rows = 3,
    style = {},
    disabled = false,
    id = ''
}) => {
    const textareaRef = useRef(null);
    const historyRef = useRef({
        past: [],
        present: value,
        future: []
    });

    // 更新历史记录
    useEffect(() => {
        if (value !== historyRef.current.present) {
            historyRef.current.past.push(historyRef.current.present);
            historyRef.current.present = value;
            historyRef.current.future = [];
            // 限制历史记录数量，防止内存溢出
            if (historyRef.current.past.length > 50) {
                historyRef.current.past.shift();
            }
        }
    }, [value]);

    // 处理快捷键
    const handleKeyDown = (e) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Ctrl+Z 撤销
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (historyRef.current.past.length > 0) {
                historyRef.current.future.push(historyRef.current.present);
                historyRef.current.present = historyRef.current.past.pop();
                onChange({ target: { value: historyRef.current.present } });
            }
            return;
        }

        // Ctrl+Y 或 Ctrl+Shift+Z 重做
        if (
            ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
            ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
        ) {
            e.preventDefault();
            if (historyRef.current.future.length > 0) {
                historyRef.current.past.push(historyRef.current.present);
                historyRef.current.present = historyRef.current.future.pop();
                onChange({ target: { value: historyRef.current.present } });
            }
            return;
        }

        // Ctrl+A 全选
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            textarea.select();
            return;
        }

        // 注意: Ctrl+C, Ctrl+V, Ctrl+X 浏览器已原生支持，不需要特殊处理
    };

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
                // 更新历史记录
                historyRef.current.past.push(historyRef.current.present);
                historyRef.current.present = e.target.value;
                historyRef.current.future = [];
                if (historyRef.current.past.length > 50) {
                    historyRef.current.past.shift();
                }
                onChange(e);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            id={id}
            style={{
                width: '100%',
                padding: '8px',
                marginTop: '4px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                ...style
            }}
        />
    );
};

export default TextEditorWithShortcuts;
