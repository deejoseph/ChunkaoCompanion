#!/usr/bin/env python3
"""
生成个性化学习报告（周报/月报）
用法: python backend/scripts/generate_report.py --days 7
      python backend/scripts/generate_report.py --days 30 --format html
"""

import sqlite3
import json
import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def get_student_data(days=7, student_id="default_user"):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    since_date = (datetime.now() - timedelta(days=days)).isoformat()

    # 1. 答题卡记录（成绩、得分率）
    sheets = cursor.execute("""
        SELECT sas.id, sas.bank_id, qb.title AS bank_title, qb.subject_id,
               sas.total_score, sas.max_score, sas.wrong_count, sas.answers, sas.created_at
        FROM student_answer_sheets sas
        LEFT JOIN question_banks qb ON sas.bank_id = qb.id
        WHERE sas.created_at >= ? AND sas.student_id = ?
        ORDER BY sas.created_at
    """, (since_date, student_id)).fetchall()

    sheets_data = []
    for s in sheets:
        # 解析 answers JSON，计算实际作答正确率
        answers = {}
        try:
            answers = json.loads(s["answers"]) if s["answers"] else {}
        except (json.JSONDecodeError, TypeError):
            pass
        attempted = len(answers)
        correct = sum(1 for v in answers.values() if v == "correct")
        wrong = sum(1 for v in answers.values() if v == "wrong")

        # 得分率：优先用实际作答正确率，否则用 total_score/max_score
        if attempted > 0:
            rate = round(correct / attempted * 100, 1)
        elif s["max_score"] and s["max_score"] > 0:
            rate = round(s["total_score"] / s["max_score"] * 100, 1)
        else:
            rate = 0
        # 学科检测：优先用 JOIN 结果，否则从 bank_id 提取
        subj = s["subject_id"]
        if not subj:
            bid = s["bank_id"] or ""
            for tag in ("chinese", "math", "english"):
                if bid.startswith(tag):
                    subj = tag
                    break
            subj = subj or "未知"
        # 试卷标题：优先用 JOIN 结果，否则从 bank_id 提取可读标题
        title = s["bank_title"]
        if not title:
            bid = s["bank_id"] or ""
            # 去掉学科_年份_前缀，保留可读部分
            parts = bid.split("_", 2)
            title = parts[2] if len(parts) > 2 else bid
        sheets_data.append({
            "bank_title": title,
            "subject": subj,
            "total_score": s["total_score"],
            "max_score": s["max_score"],
            "correct": correct,
            "wrong": wrong,
            "attempted": attempted,
            "score_rate": rate,
            "wrong_count": s["wrong_count"],
            "date": s["created_at"][:10],
            "time": s["created_at"][11:16] if len(s["created_at"]) > 16 else ""
        })

    # 2. 得分率统计
    rates = [s["score_rate"] for s in sheets_data]
    avg_rate = round(sum(rates) / len(rates), 1) if rates else 0
    max_rate = max(rates) if rates else 0
    min_rate = min(rates) if rates else 0

    # 3. 按学科分组统计
    subject_stats = {}
    for s in sheets_data:
        subj = s["subject"]
        if subj not in subject_stats:
            subject_stats[subj] = {"count": 0, "scores": [], "wrong": 0}
        subject_stats[subj]["count"] += 1
        subject_stats[subj]["scores"].append(s["score_rate"])
        subject_stats[subj]["wrong"] += s["wrong_count"]
    for subj, stat in subject_stats.items():
        stat["avg_rate"] = round(sum(stat["scores"]) / len(stat["scores"]), 1) if stat["scores"] else 0

    # 4. 每日学习热力图（按日期分组答题卡数 + 正确率）
    daily_map = {}
    for s in sheets_data:
        d = s["date"]
        if d not in daily_map:
            daily_map[d] = {"count": 0, "correct": 0, "wrong": 0, "rates": []}
        daily_map[d]["count"] += 1
        daily_map[d]["correct"] += s["correct"]
        daily_map[d]["wrong"] += s["wrong"]
        daily_map[d]["rates"].append(s["score_rate"])
    daily_activity = []
    for d, info in sorted(daily_map.items()):
        avg_r = round(sum(info["rates"]) / len(info["rates"]), 1) if info["rates"] else 0
        daily_activity.append({
            "date": d, "count": info["count"],
            "correct": info["correct"], "wrong": info["wrong"],
            "avg_rate": avg_r
        })

    # 5. 薄弱知识点（从 student_profile 读取）
    weak_points = []
    profile = cursor.execute("""
        SELECT weak_knowledge_points, total_questions_answered, total_correct,
               total_wrong, average_score
        FROM student_profile WHERE student_id = ?
    """, (student_id,)).fetchone()

    profile_summary = {}
    if profile:
        profile_summary = {
            "total_answered": profile["total_questions_answered"] or 0,
            "total_correct": profile["total_correct"] or 0,
            "total_wrong": profile["total_wrong"] or 0,
            "average_score": round(profile["average_score"] or 0, 1),
        }
        if profile["weak_knowledge_points"]:
            try:
                all_weak = json.loads(profile["weak_knowledge_points"])
                # 按掌握度排序，取最薄弱的
                all_weak.sort(key=lambda x: x.get("accuracy", 100))
                weak_points = [
                    {"name": wp.get("name", "未知"), "wrong_count": wp.get("wrong_count", 0),
                     "accuracy": wp.get("accuracy", 0)}
                    for wp in all_weak if wp.get("accuracy", 100) < 60
                ]
            except (json.JSONDecodeError, TypeError):
                pass

    # 6. 从 student_wrong_knowledge 补充近期错误统计
    recent_wrong = cursor.execute("""
        SELECT kp.name, COUNT(*) as cnt
        FROM student_wrong_knowledge swk
        JOIN knowledge_points kp ON kp.id = swk.knowledge_point_id
        WHERE swk.student_id = ? AND swk.created_at >= ?
        GROUP BY kp.id
        ORDER BY cnt DESC
        LIMIT 10
    """, (student_id, since_date)).fetchall()
    recent_wrong_list = [{"name": r["name"], "wrong_count": r["cnt"]} for r in recent_wrong]

    # 7. 预估学习时长（每份答题卡约 30 分钟做题 + 每题约 2 分钟）
    estimated_minutes = sum(30 + s["wrong_count"] * 2 for s in sheets_data)

    conn.close()

    return {
        "period_days": days,
        "sheets_count": len(sheets_data),
        "sheets": sheets_data,
        "avg_rate": avg_rate,
        "max_rate": max_rate,
        "min_rate": min_rate,
        "subject_stats": subject_stats,
        "daily_activity": daily_activity,
        "weak_points": weak_points[:10],
        "recent_wrong": recent_wrong_list,
        "profile": profile_summary,
        "estimated_minutes": estimated_minutes,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }


def render_markdown(data):
    period_label = "周报" if data["period_days"] <= 7 else "月报"
    md = f"""# 📊 学习{period_label}（最近 {data['period_days']} 天）

> 生成时间：{data['generated_at']}

---

## 📋 总体概览

| 指标 | 数值 |
|------|------|
| 完成试卷数 | {data['sheets_count']} 套 |
| 预估学习时长 | {data['estimated_minutes']} 分钟（约 {data['estimated_minutes']//60} 小时 {data['estimated_minutes']%60} 分钟） |
| 平均得分率 | {data['avg_rate']}% |
| 最高得分率 | {data['max_rate']}% |
| 最低得分率 | {data['min_rate']}% |
| 累计答题 | {data['profile'].get('total_answered', 0)} 题（正确 {data['profile'].get('total_correct', 0)} 题） |
| 历史平均分 | {data['profile'].get('average_score', 0)}% |

"""

    # 学科分组
    if data["subject_stats"]:
        md += "## 📚 各学科表现\n\n"
        md += "| 学科 | 做题次数 | 平均得分率 | 错题数 |\n"
        md += "|------|---------|-----------|--------|\n"
        subj_names = {"chinese": "语文", "math": "数学", "english": "英语"}
        for subj, stat in data["subject_stats"].items():
            name = subj_names.get(subj, subj)
            md += f"| {name} | {stat['count']} 次 | {stat['avg_rate']}% | {stat['wrong']} 题 |\n"
        md += "\n"

    # 每日学习热力图
    if data["daily_activity"]:
        md += "## 📅 每日学习记录\n\n"
        md += "| 日期 | 试卷数 | 正确 | 错误 | 平均正确率 |\n"
        md += "|------|--------|------|------|-----------|\n"
        for day in data["daily_activity"]:
            bar = "█" * day["count"]
            md += f"| {day['date']} | {bar} {day['count']} | ✅{day['correct']} | ❌{day['wrong']} | {day['avg_rate']}% |\n"
        md += "\n"

    # 薄弱知识点
    md += "## 📉 薄弱知识点（掌握度 < 60%）\n\n"
    if data["weak_points"]:
        md += "| 知识点 | 错误次数 | 掌握度 |\n"
        md += "|--------|---------|--------|\n"
        for wp in data["weak_points"]:
            md += f"| {wp['name']} | {wp['wrong_count']} 次 | {wp['accuracy']}% |\n"
    else:
        md += "✅ 所有知识点掌握度 ≥ 60%，继续保持！\n"
    md += "\n"

    # 近期错题
    if data["recent_wrong"]:
        md += "## 🔴 近期高频错题知识点\n\n"
        for wp in data["recent_wrong"]:
            md += f"- **{wp['name']}**：错 {wp['wrong_count']} 次\n"
        md += "\n"

    # 试卷明细
    if data["sheets"]:
        md += "## 📝 试卷明细\n\n"
        md += "| 日期 | 试卷 | 作答 | 正确 | 错误 | 正确率 |\n"
        md += "|------|------|------|------|------|--------|\n"
        for s in data["sheets"]:
            md += f"| {s['date']} {s['time']} | {s['bank_title']} | {s['attempted']} | ✅{s['correct']} | ❌{s['wrong']} | {s['score_rate']}% |\n"
        md += "\n"

    # 建议
    md += """## 🎯 学习建议

"""
    if data["weak_points"]:
        md += "- 重点复习上述薄弱知识点，可使用 AI 讲解功能加深理解\n"
    if data["sheets_count"] < 3:
        md += "- 本周做题量偏少，建议每天至少完成 1 套真题模拟\n"
    if data["avg_rate"] < 50:
        md += "- 得分率偏低，建议先巩固基础知识再做难题\n"
    if data["avg_rate"] >= 80:
        md += "- 表现优秀！继续保持并挑战更高难度的题目\n"
    md += "- 记录每天的学习时长，与周报数据对比，持续改进\n"

    md += f"""
---
*本报告由 Chunkao Companion 自动生成，数据仅供参考。*
"""
    return md


def render_html(data):
    """生成可直接打印/分享的 HTML 报告"""
    period_label = "周报" if data["period_days"] <= 7 else "月报"
    subj_names = {"chinese": "语文", "math": "数学", "english": "英语"}

    # 学科统计行
    subject_rows = ""
    for subj, stat in data["subject_stats"].items():
        name = subj_names.get(subj, subj)
        color = {"chinese": "#52c41a", "math": "#1890ff", "english": "#fa8c16"}.get(subj, "#666")
        subject_rows += f"""<tr>
            <td><span style="color:{color};font-weight:bold">{name}</span></td>
            <td>{stat['count']} 次</td>
            <td>{stat['avg_rate']}%</td>
            <td>{stat['wrong']} 题</td>
        </tr>"""

    # 薄弱知识点行
    weak_rows = ""
    if data["weak_points"]:
        for wp in data["weak_points"]:
            weak_rows += f"""<tr>
                <td>{wp['name']}</td>
                <td>{wp['wrong_count']} 次</td>
                <td><span style="color:{'#ff4d4f' if wp['accuracy'] < 40 else '#faad14'}">{wp['accuracy']}%</span></td>
            </tr>"""
    else:
        weak_rows = '<tr><td colspan="3" style="text-align:center;color:#52c41a">✅ 所有知识点掌握度 ≥ 60%</td></tr>'

    # 试卷明细行
    sheet_rows = ""
    for s in data["sheets"]:
        rate_color = "#52c41a" if s["score_rate"] >= 70 else ("#faad14" if s["score_rate"] >= 40 else "#ff4d4f")
        sheet_rows += f"""<tr>
            <td>{s['date']}</td>
            <td>{s['bank_title']}</td>
            <td>{s['attempted']} 题（✅{s['correct']} ❌{s['wrong']}）</td>
            <td style="color:{rate_color};font-weight:bold">{s['score_rate']}%</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>学习{period_label}</title>
<style>
    body {{ font-family: -apple-system, "Microsoft YaHei", sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }}
    h1 {{ color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px; }}
    h2 {{ color: #333; margin-top: 24px; }}
    table {{ width: 100%; border-collapse: collapse; margin: 12px 0; }}
    th, td {{ padding: 8px 12px; border: 1px solid #e8e8e8; text-align: left; }}
    th {{ background: #fafafa; font-weight: bold; }}
    .stat-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }}
    .stat-card {{ background: #f6f8fa; border-radius: 8px; padding: 16px; text-align: center; }}
    .stat-card .value {{ font-size: 28px; font-weight: bold; color: #1890ff; }}
    .stat-card .label {{ font-size: 13px; color: #666; margin-top: 4px; }}
    .suggestion {{ background: #e6f7ff; border-left: 4px solid #1890ff; padding: 12px 16px; border-radius: 4px; margin: 16px 0; }}
    .footer {{ text-align: center; color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #e8e8e8; padding-top: 12px; }}
    @media print {{ body {{ max-width: 100%; }} }}
</style>
</head>
<body>
<h1>📊 学习{period_label}（最近 {data['period_days']} 天）</h1>
<p style="color:#999">生成时间：{data['generated_at']}</p>

<div class="stat-grid">
    <div class="stat-card"><div class="value">{data['sheets_count']}</div><div class="label">完成试卷（套）</div></div>
    <div class="stat-card"><div class="value">{data['avg_rate']}%</div><div class="label">平均得分率</div></div>
    <div class="stat-card"><div class="value">{data['estimated_minutes']}</div><div class="label">预估学习时长（分钟）</div></div>
</div>

<h2>📚 各学科表现</h2>
<table>
    <tr><th>学科</th><th>做题次数</th><th>平均得分率</th><th>错题数</th></tr>
    {subject_rows if subject_rows else '<tr><td colspan="4" style="text-align:center;color:#999">暂无数据</td></tr>'}
</table>

<h2>📉 薄弱知识点</h2>
<table>
    <tr><th>知识点</th><th>错误次数</th><th>掌握度</th></tr>
    {weak_rows}
</table>

<h2>📝 试卷明细</h2>
<table>
    <tr><th>日期</th><th>试卷</th><th>作答情况</th><th>正确率</th></tr>
    {sheet_rows if sheet_rows else '<tr><td colspan="4" style="text-align:center;color:#999">暂无记录</td></tr>'}
</table>

<div class="suggestion">
    <strong>🎯 学习建议</strong>
    <ul>
        {"<li>重点复习薄弱知识点，使用 AI 讲解功能加深理解</li>" if data["weak_points"] else ""}
        {"<li>本周做题量偏少，建议每天至少完成 1 套真题</li>" if data["sheets_count"] < 3 else ""}
        <li>记录每天的学习时长，持续改进学习计划</li>
    </ul>
</div>

<div class="footer">本报告由 Chunkao Companion 自动生成，数据仅供参考。</div>
</body>
</html>"""
    return html


def main():
    parser = argparse.ArgumentParser(description="生成个性化学习报告")
    parser.add_argument("--days", type=int, default=7, help="统计最近多少天（默认7天）")
    parser.add_argument("--format", choices=["markdown", "html", "json"], default="markdown", help="输出格式")
    parser.add_argument("--output", type=str, default=None, help="输出文件路径（默认自动生成）")
    args = parser.parse_args()

    data = get_student_data(args.days)

    if args.format == "json":
        output = json.dumps(data, ensure_ascii=False, indent=2)
        ext = ".json"
    elif args.format == "html":
        output = render_html(data)
        ext = ".html"
    else:
        output = render_markdown(data)
        ext = ".md"

    if args.output:
        output_path = Path(args.output)
    else:
        label = "周报" if args.days <= 7 else "月报"
        output_path = PROJECT_ROOT / "data" / "exports" / f"学习{label}_{datetime.now().strftime('%Y%m%d_%H%M')}{ext}"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output, encoding="utf-8")
    print(f"✅ 报告已生成：{output_path}")

    # JSON 输出模式直接打印到 stdout（供 API 调用）
    if args.format == "json":
        print(output)


if __name__ == "__main__":
    main()
