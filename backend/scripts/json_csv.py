import json
import csv
import os
from collections import OrderedDict

def flatten_knowledge(data):
    """将知识点JSON展平为行列表，每个考点一行"""
    rows = []
    topic = data.get("专题", "")
    pa = data.get("命题分析", {})
    # 命题分析字段：题型、命题特点、高频考查内容
    question_types = "; ".join(pa.get("题型", []))
    features = "; ".join(pa.get("命题特点", []))
    high_freq = "; ".join(pa.get("高频考查内容", []))

    exam_system = data.get("考点体系", {})
    for kp_name, kp_content in exam_system.items():
        # 提取核心能力
        core = "; ".join(kp_content.get("核心能力", []))
        # 提取命题重点（嵌套对象）
        focus = kp_content.get("命题重点", {})
        # 将命题重点展平为 "子项: 值列表" 的字符串
        focus_str = "; ".join([f"{k}: {', '.join(v) if isinstance(v, list) else v}" for k, v in focus.items()])
        # 提取答题方法
        methods = kp_content.get("答题方法", {})
        methods_str = "; ".join([f"{k}: {', '.join(v) if isinstance(v, list) else v}" for k, v in methods.items()])

        rows.append({
            "专题": topic,
            "题型": question_types,
            "命题特点": features,
            "高频考查内容": high_freq,
            "考点名称": kp_name,
            "核心能力": core,
            "命题重点": focus_str,
            "答题方法": methods_str
        })
    return rows

def flatten_questions(data):
    """将真题JSON展平为行列表，每个小题一行"""
    rows = []
    exam_info = data.get("exam_info", {})
    year = exam_info.get("year", "")
    title = exam_info.get("title", "")
    total_score = exam_info.get("total_score", "")
    duration = exam_info.get("duration_minutes", "")

    sections = data.get("sections", [])
    for section in sections:
        section_type = section.get("type", "")
        section_desc = section.get("description", "")
        questions = section.get("questions", [])
        for q in questions:
            parent_id = q.get("id")
            # 处理有子题的情况
            sub_qs = q.get("sub_questions", [])
            if sub_qs:
                for sub in sub_qs:
                    part = sub.get("part", "")
                    score = sub.get("score", "")
                    content = sub.get("content", "")
                    answer = sub.get("answer", "")
                    analysis = sub.get("analysis", "")
                    rows.append({
                        "年份": year,
                        "试卷标题": title,
                        "总分": total_score,
                        "考试时长(分钟)": duration,
                        "题型": section_type,
                        "题型描述": section_desc,
                        "大题号": parent_id,
                        "小题号": part,
                        "分值": score,
                        "题干": content,
                        "答案": answer,
                        "解析": analysis
                    })
            else:
                # 无子题的情况
                score = q.get("score", "")
                content = q.get("content", "")
                answer = q.get("answer", "")
                analysis = q.get("analysis", "")
                options = q.get("options", [])
                options_str = "; ".join(options) if options else ""
                rows.append({
                    "年份": year,
                    "试卷标题": title,
                    "总分": total_score,
                    "考试时长(分钟)": duration,
                    "题型": section_type,
                    "题型描述": section_desc,
                    "大题号": parent_id,
                    "小题号": "",
                    "分值": score,
                    "题干": content,
                    "选项": options_str,
                    "答案": answer,
                    "解析": analysis
                })
    return rows

def main():
    print("请选择转换类型：")
    print("1. 知识点JSON -> CSV")
    print("2. 真题JSON -> CSV")
    choice = input("请输入数字（1或2）：").strip()
    if choice not in ("1", "2"):
        print("输入无效，退出。")
        return

    input_file = input("请输入JSON文件路径：").strip()
    if not os.path.isfile(input_file):
        print("文件不存在，请检查路径。")
        return

    # 读取JSON
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"读取JSON失败：{e}")
        return

    # 根据类型处理
    if choice == "1":
        rows = flatten_knowledge(data)
        if not rows:
            print("未找到有效的知识点数据。")
            return
        # 定义CSV列顺序
        fieldnames = ["专题", "题型", "命题特点", "高频考查内容", "考点名称", "核心能力", "命题重点", "答题方法"]
        output_file = os.path.splitext(input_file)[0] + "_knowledge.csv"
    else:
        rows = flatten_questions(data)
        if not rows:
            print("未找到有效的题目数据。")
            return
        fieldnames = ["年份", "试卷标题", "总分", "考试时长(分钟)", "题型", "题型描述", "大题号", "小题号", "分值", "题干", "选项", "答案", "解析"]
        output_file = os.path.splitext(input_file)[0] + "_questions.csv"

    # 写入CSV
    try:
        with open(output_file, 'w', newline='', encoding='utf-8-sig') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"转换成功！CSV文件已保存至：{output_file}")
    except Exception as e:
        print(f"写入CSV失败：{e}")

if __name__ == "__main__":
    main()