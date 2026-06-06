# AI 对话修改日程 100 次压力测试记录

生成时间：2026-06-06T04:30:35.235Z
模型：gpt-5.5
API 预检：通过
总数：100
触发修改：90/100
语义一致：100/100
Preview 全部 applied 或按预期无动作：81/100

| ID | 组 | 用户话术 | 触发 | 语义一致 | 动作 | Preview | 问题/备注 |
|---|---|---|---:|---:|---|---|---|
| zh-add-001 | add | 今晚7点到8点阅读 | 是 | 是 | add_task_block title=阅读 match=阅读 19:00-20:00 | add_task_block:conflict |  |
| zh-add-002 | add | 八点20到九点10学英语 | 是 | 是 | add_task_block title=学英语 match=学英语 08:20-09:10 | add_task_block:conflict |  |
| zh-add-003 | add | 晚上8：三十到9：10复盘 | 是 | 是 | add_task_block title=复盘 match=复盘 20:30-21:10 | add_task_block:applied |  |
| zh-add-004 | add | 晚上九点;40到十点20写报告 | 是 | 是 | add_task_block title=写报告 match=写报告 21:40-22:20 | add_task_block:applied |  |
| zh-add-005 | add | 19点5到19点35整理房间 | 是 | 是 | add_task_block title=整理房间 match=整理房间 19:05-19:35 | add_task_block:conflict |  |
| zh-add-006 | add | 七点半到八点跑步 | 是 | 是 | add_task_block title=跑步 match=跑步 07:30-08:00 | add_task_block:applied |  |
| zh-add-007 | add | 给我加个13:15-13:45午休 | 是 | 是 | add_task_block title=午休 match=午休 13:15-13:45 | add_task_block:applied |  |
| zh-add-008 | add | 明早8点到8点25背书 | 是 | 是 | add_task_block title=背书 match=背书 08:00-08:25 | add_task_block:applied |  |
| zh-add-009 | add | 十六点到十七点做PPT | 是 | 是 | add_task_block title=做PPT match=做PPT 16:00-17:00 | add_task_block:applied |  |
| zh-add-010 | add | 下午三点一刻到四点开组会 | 是 | 是 | add_task_block title=组会 match=组会 15:15-16:00 | add_task_block:applied |  |
| zh-add-011 | add | 晚上11点到11点20拉伸 | 是 | 是 | add_task_block title=拉伸 match=拉伸 23:00-23:20 | add_task_block:applied |  |
| zh-add-012 | add | 中午12点到12点半吃饭 | 是 | 是 | add_task_block title=吃饭 match=吃饭 12:00-12:30 | add_task_block:applied |  |
| zh-add-013 | add | 14：00-14：50 读论文 | 是 | 是 | add_task_block title=读论文 match=读论文 14:00-14:50 | add_task_block:conflict |  |
| zh-add-014 | add | 15;10到15;55 debug | 是 | 是 | add_task_block title=debug match=debug 15:10-15:55 | add_task_block:applied |  |
| zh-add-015 | add | 晚上六点四十到七点十分买东西 | 是 | 是 | add_task_block title=买东西 match=买东西 18:40-19:10 | add_task_block:conflict |  |
| zh-add-016 | add | 8.30-9.00 冥想 | 是 | 是 | add_task_block title=冥想 match=冥想 08:30-09:00 | add_task_block:applied |  |
| zh-add-017 | add | 22:10 至 22:40 复盘今天 | 是 | 是 | add_task_block title=复盘今天 match=复盘今天 22:10-22:40 | add_task_block:applied |  |
| zh-add-018 | add | 帮我在17:05~17:35安排洗衣服 | 是 | 是 | add_task_block title=洗衣服 match=洗衣服 17:05-17:35 | add_task_block:applied |  |
| zh-add-019 | add | 晚上8点零5到8点35看书 | 是 | 是 | add_task_block title=看书 match=看书 20:05-20:35 | add_task_block:applied |  |
| zh-add-020 | add | 一点半到两点处理邮件 | 是 | 是 | add_task_block title=处理邮件 match=处理邮件 13:30-14:00 | add_task_block:applied |  |
| en-add-021 | add | Add reading from 4pm to 4:30pm. | 是 | 是 | add_task_block title=reading match=reading 16:00-16:30 | add_task_block:applied |  |
| en-add-022 | add | Schedule project planning 11:15-noon. | 是 | 是 | add_task_block title=project planning match=project planning 11:15-12:00 | add_task_block:applied |  |
| en-add-023 | add | Put laundry at 17:05-17:35. | 是 | 是 | add_task_block title=Laundry match=Laundry 17:05-17:35 | add_task_block:applied |  |
| en-add-024 | add | Add a quick walk between 7:30 and 8 pm. | 是 | 是 | add_task_block title=Quick walk match=Quick walk 19:30-20:00 | add_task_block:conflict |  |
| en-add-025 | add | Need meditation 8.30-9.00 | 是 | 是 | add_task_block title=meditation match=meditation 08:30-09:00 | add_task_block:applied |  |
| en-add-026 | add | Please create dinner 18:40 to 19:10. | 是 | 是 | add_task_block title=dinner match=dinner 18:40-19:10 | add_task_block:conflict |  |
| en-add-027 | add | slot in report writing from 21:40 to 22:20 | 是 | 是 | add_task_block title=report writing match=report writing 21:40-22:20 | add_task_block:applied |  |
| en-add-028 | add | new task: email cleanup 13:30-14:00 | 是 | 是 | add_task_block title=email cleanup match=email cleanup 13:30-14:00 | add_task_block:applied |  |
| en-add-029 | add | Can you add stretch 23:00-23:20? | 是 | 是 | add_task_block title=stretch match=stretch 23:00-23:20 | add_task_block:applied |  |
| en-add-030 | add | Block 15:10-15:55 for debugging. | 是 | 是 | add_task_block title=debugging match=debugging 15:10-15:55 | add_task_block:applied |  |
| zh-move-031 | move | 把写代码改到15:30-16:00 | 是 | 是 | move_block match=写代码 15:30-16:00 | move_block:applied |  |
| zh-move-032 | move | 代码下午三点半到四点 | 是 | 是 | move_block match=写代码 15:30-16:00 | move_block:applied |  |
| zh-move-033 | move | 背单词推迟到11:30-12:00 | 是 | 是 | move_block match=背单词 11:30-12:00 | move_block:applied |  |
| zh-move-034 | move | Gym提前到17:00-17:45 | 是 | 是 | move_block match=Gym 17:00-17:45 | move_block:applied |  |
| zh-move-035 | move | 数学改到八点半到九点 | 是 | 是 | move_block match=复习数学 20:30-21:00 | move_block:applied |  |
| zh-move-036 | move | 把课程挪到10:00-11:00 | 是 | 是 | move_block match=课程 10:00-11:00 | move_block:conflict |  |
| zh-move-037 | move | 写代吗放到15:30到16:30 | 是 | 是 | move_block match=写代码 15:30-16:30 | move_block:applied |  |
| zh-move-038 | move | 把背单词往后挪半小时 | 是 | 是 | move_block match=背单词 11:00-11:30 | move_block:applied |  |
| zh-move-039 | move | 复习数学提前到18:00-19:00 | 是 | 是 | move_block match=复习数学 18:00-19:00 | move_block:conflict |  |
| zh-move-040 | move | Gym 17点到17点45 | 是 | 是 | move_block match=Gym 17:00-17:45 | move_block:applied |  |
| zh-move-041 | move | 写代码 16点;20到17点;20 | 是 | 是 | move_block match=写代码 16:20-17:20 | move_block:applied |  |
| zh-move-042 | move | 背单词 8：三十到9：00 | 是 | 是 | move_block match=背单词 08:30-09:00 | move_block:applied |  |
| zh-move-043 | move | 把数学拖到晚上九点;40到十点20 | 是 | 是 | move_block match=复习数学 21:40-22:20 | move_block:applied |  |
| zh-move-044 | move | 课程改成上午十点半到十一点半 | 是 | 是 | move_block match=课程 10:30-11:30 | move_block:conflict |  |
| zh-move-045 | move | 写代码不要14点了，改15点到16点 | 是 | 是 | move_block match=写代码 15:00-16:00 | move_block:applied |  |
| en-move-046 | move | Move Gym to 17:00-17:45. | 是 | 是 | move_block match=Gym 17:00-17:45 | move_block:applied |  |
| en-move-047 | move | Shift coding to 3:30pm-4:30pm. | 是 | 是 | move_block match=写代码 15:30-16:30 | move_block:applied |  |
| en-move-048 | move | Put vocab at 11:30-12:00. | 是 | 是 | move_block match=背单词 11:30-12:00 | move_block:applied |  |
| en-move-049 | move | Reschedule math review to 20:30-21:00. | 是 | 是 | move_block match=复习数学 20:30-21:00 | move_block:applied |  |
| en-move-050 | move | Move class to 10:00-11:00. | 是 | 是 | move_block match=课程 10:00-11:00 | move_block:conflict |  |
| en-move-051 | move | code block 16:20-17:20 please | 是 | 是 | move_block match=写代码 16:20-17:20 | move_block:applied |  |
| en-move-052 | move | delay vocab by 30 minutes | 是 | 是 | move_block match=背单词 11:00-11:30 | move_block:applied |  |
| en-move-053 | move | bring Gym forward to 5pm-5:45pm | 是 | 是 | move_block match=Gym 17:00-17:45 | move_block:applied |  |
| en-move-054 | move | math 9:40pm to 10:20pm | 是 | 是 | move_block match=复习数学 21:40-22:20 | move_block:applied |  |
| en-move-055 | move | change course to 10:30-11:30 | 是 | 是 | move_block match=课程 10:30-11:30 | move_block:conflict |  |
| zh-remove-056 | remove | 取消Gym | 是 | 是 | remove_block match=Gym | remove_block:applied |  |
| zh-remove-057 | remove | 复习数学删掉 | 是 | 是 | remove_block match=复习数学 | remove_block:applied |  |
| zh-remove-058 | remove | 写代码不要了 | 是 | 是 | remove_block match=写代码 | remove_block:applied |  |
| zh-remove-059 | remove | 背单词去掉 | 是 | 是 | remove_block match=背单词 | remove_block:applied |  |
| zh-remove-060 | remove | 课程先移除 | 是 | 是 | remove_block match=课程 | remove_block:applied |  |
| zh-remove-061 | remove | 删了Gym吧 | 是 | 是 | remove_block match=Gym | remove_block:applied |  |
| zh-remove-062 | remove | 数学复习不做了 | 是 | 是 | remove_block match=复习数学 | remove_block:applied |  |
| zh-remove-063 | remove | 把写代码这个块取消 | 是 | 是 | remove_block match=写代码 | remove_block:applied |  |
| zh-remove-064 | remove | 今天不背单词了 | 是 | 是 | remove_block match=背单词 | remove_block:applied |  |
| zh-remove-065 | remove | 课程从日程里拿掉 | 是 | 是 | remove_block match=课程 | remove_block:applied |  |
| en-remove-066 | remove | Delete Gym. | 是 | 是 | remove_block match=Gym | remove_block:applied |  |
| en-remove-067 | remove | Remove math review. | 是 | 是 | remove_block match=复习数学 | remove_block:applied |  |
| en-remove-068 | remove | Cancel coding. | 是 | 是 | remove_block match=写代码 | remove_block:applied |  |
| en-remove-069 | remove | Drop vocab. | 是 | 是 | remove_block match=背单词 | remove_block:applied |  |
| en-remove-070 | remove | Remove class from schedule. | 是 | 是 | remove_block match=课程 | remove_block:applied |  |
| en-remove-071 | remove | delte Gym | 是 | 是 | remove_block match=Gym | remove_block:applied |  |
| en-remove-072 | remove | cnacel coding block | 是 | 是 | remove_block match=写代码 | remove_block:applied |  |
| en-remove-073 | remove | skip vocab today | 是 | 是 | remove_block match=背单词 | remove_block:applied |  |
| en-remove-074 | remove | No math review today | 是 | 是 | remove_block match=复习数学 | remove_block:applied |  |
| en-remove-075 | remove | take out course | 是 | 是 | remove_block match=课程 | remove_block:applied |  |
| multi-076 | multi | 7点半到8点跑步，8点到8点半洗澡 | 是 | 是 | add_task_block title=跑步 match=跑步 07:30-08:00<br>add_task_block title=洗澡 match=洗澡 08:00-08:30 | add_task_block:applied<br>add_task_block:applied |  |
| multi-077 | multi | 把写代码改到16:00-17:00，顺便删掉Gym | 是 | 是 | move_block match=写代码 16:00-17:00<br>remove_block match=Gym | move_block:applied<br>remove_block:applied |  |
| multi-078 | multi | Add reading 16:00-16:30 and move Gym to 17:00-17:45. | 是 | 是 | add_task_block title=reading match=reading 16:00-16:30<br>move_block match=Gym 17:00-17:45 | add_task_block:applied<br>move_block:applied |  |
| multi-079 | multi | 背单词改11:30-12:00，再加一个22:10-22:40复盘 | 是 | 是 | move_block match=背单词 11:30-12:00<br>add_task_block title=复盘 match=复盘 22:10-22:40 | move_block:applied<br>add_task_block:applied |  |
| multi-080 | multi | Delete Gym and cancel math review. | 是 | 是 | remove_block match=Gym<br>remove_block match=复习数学 | remove_block:applied<br>remove_block:applied |  |
| amb-081 | ambiguous | 明天学习一下 | 否 | 是 |  | (no action expected) |  |
| amb-082 | ambiguous | 帮我调整一下写代码 | 否 | 是 |  | (no action expected) |  |
| amb-083 | ambiguous | 晚上安排点东西 | 否 | 是 |  | (no action expected) |  |
| amb-084 | ambiguous | I need to study tomorrow | 否 | 是 |  | (no action expected) |  |
| amb-085 | ambiguous | move it later | 否 | 是 |  | (no action expected) |  |
| amb-086 | ambiguous | delete that | 否 | 是 |  | (no action expected) |  |
| amb-087 | ambiguous | 八点以后别太累 | 否 | 是 |  | (no action expected) |  |
| amb-088 | ambiguous | maybe gym sometime | 否 | 是 |  | (no action expected) |  |
| amb-089 | ambiguous | 周末看看数学 | 否 | 是 |  | (no action expected) |  |
| amb-090 | ambiguous | 安排一下 | 否 | 是 |  | (no action expected) |  |
| special-091-user-example | special | 我这周日晚上七点半要到教一601考试，然后大概九点要去居酒屋 | 是 | 是 | add_task_block title=教一601考试 match=教一601考试 19:30-21:00<br>add_task_block title=居酒屋 match=居酒屋 21:00-21:30 | add_task_block:conflict<br>add_task_block:applied | 当前 action schema 没有 date 字段；居酒屋缺结束时间时按 30 分钟暂定，AI 文本应提醒用户自行修改。 |
| special-092-date-specific | special | 这周日19:30-21:00教一601考试 | 是 | 是 | add_task_block title=教一601考试 match=教一601考试 19:30-21:00 | add_task_block:conflict | schema 无 date 字段，只能记录时间块，无法落到周日。 |
| special-093-start-only | special | 九点去居酒屋 | 是 | 是 | add_task_block title=居酒屋 match=居酒屋 21:00-21:30 | add_task_block:applied | 只有开始时间，没有结束时间；按 30 分钟暂定，AI 文本应提醒用户自行修改。 |
| special-094-location | special | 19:30-21:00在教一601考试 | 是 | 是 | add_task_block title=教一601考试 match=教一601考试 19:30-21:00 | add_task_block:conflict |  |
| special-095-typo-time | special | 8：三十-9；40 刷题 | 是 | 是 | add_task_block title=刷题 match=刷题 08:30-09:40 | add_task_block:conflict |  |
| special-096-half | special | 晚上七点半到九点考试 | 是 | 是 | add_task_block title=考试 match=考试 19:30-21:00 | add_task_block:conflict |  |
| special-097-semi | special | 九点;40到十点20复盘 | 是 | 是 | add_task_block title=复盘 match=复盘 09:40-10:20 | add_task_block:conflict |  |
| special-098-english-start-only | special | Bar at 9 tonight | 是 | 是 | add_task_block title=Bar match=Bar 21:00-21:30 | add_task_block:applied | Only a start time is provided; default to 30 minutes and tell the user to adjust. |
| special-099-english-location | special | Exam in room Jiao 1-601 from 7:30pm to 9pm this Sunday. | 是 | 是 | add_task_block title=Exam - Jiao 1-601 match=Exam - Jiao 1-601 19:30-21:00 | add_task_block:conflict | schema 无 date 字段，只能记录时间块，无法落到周日。 |
| special-100-noisy | special | 额那个...晚上8：三十吧到9点10，搞一下英语听力 | 是 | 是 | add_task_block title=英语听力 match=英语听力 20:30-21:10 | add_task_block:applied |  |

## 原始结果

```json
{
  "apiPreflight": {
    "ok": true,
    "model": "gpt-5.5",
    "error": ""
  },
  "results": [
    {
      "id": "zh-add-001",
      "group": "add",
      "user": "今晚7点到8点阅读",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "阅读",
          "start": "19:00",
          "end": "20:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "阅读",
          "matchTitle": "阅读",
          "start": "19:00",
          "end": "20:00",
          "category": "study",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "阅读"
        }
      ],
      "previewError": "",
      "aiText": "已帮你安排今晚 `19:00-20:00` 阅读。注意这会和现有的 `复习数学 19:00-20:00` 冲突，建议你确认是否要替换、挪动数学，或保留重叠安排。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4613
    },
    {
      "id": "zh-add-002",
      "group": "add",
      "user": "八点20到九点10学英语",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "学英语",
          "startOneOf": [
            "08:20",
            "20:20"
          ],
          "endOneOf": [
            "09:10",
            "21:10"
          ]
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "学英语",
          "matchTitle": "学英语",
          "start": "08:20",
          "end": "09:10",
          "category": "study",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "学英语"
        }
      ],
      "previewError": "",
      "aiText": "可以，我会把“学英语”加到 08:20-09:10。注意它会和 09:00 开始的“课程”重叠 10 分钟，可能需要之后微调。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 8229
    },
    {
      "id": "zh-add-003",
      "group": "add",
      "user": "晚上8：三十到9：10复盘",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "复盘",
          "start": "20:30",
          "end": "21:10"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "复盘",
          "matchTitle": "复盘",
          "start": "20:30",
          "end": "21:10",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "复盘"
        }
      ],
      "previewError": "",
      "aiText": "已安排：今晚 `20:30-21:10` 复盘。这个时间段刚好在复习数学后面，适合做收尾整理。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4941
    },
    {
      "id": "zh-add-004",
      "group": "add",
      "user": "晚上九点;40到十点20写报告",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "写报告",
          "start": "21:40",
          "end": "22:20"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "写报告",
          "matchTitle": "写报告",
          "start": "21:40",
          "end": "22:20",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "写报告"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `写报告`：21:40-22:20。  \n这个时间段在当前计划里是空的，适合放一段中等强度的收尾型任务。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 5063
    },
    {
      "id": "zh-add-005",
      "group": "add",
      "user": "19点5到19点35整理房间",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "整理房间",
          "start": "19:05",
          "end": "19:35"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "整理房间",
          "matchTitle": "整理房间",
          "start": "19:05",
          "end": "19:35",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "整理房间"
        }
      ],
      "previewError": "",
      "aiText": "已安排：19:05-19:35 整理房间。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4211
    },
    {
      "id": "zh-add-006",
      "group": "add",
      "user": "七点半到八点跑步",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "跑步",
          "startOneOf": [
            "07:30",
            "19:30"
          ],
          "endOneOf": [
            "08:00",
            "20:00"
          ]
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "跑步",
          "matchTitle": "跑步",
          "start": "07:30",
          "end": "08:00",
          "category": "workout",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "跑步"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `跑步`：07:30-08:00。早上这个时段适合轻到中等强度，跑完留点缓冲再进入上午安排。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 10664
    },
    {
      "id": "zh-add-007",
      "group": "add",
      "user": "给我加个13:15-13:45午休",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "午休",
          "start": "13:15",
          "end": "13:45"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "午休",
          "matchTitle": "午休",
          "start": "13:15",
          "end": "13:45",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "午休"
        }
      ],
      "previewError": "",
      "aiText": "已添加 `13:15-13:45` 的午休。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3204
    },
    {
      "id": "zh-add-008",
      "group": "add",
      "user": "明早8点到8点25背书",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "背书",
          "start": "08:00",
          "end": "08:25"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "背书",
          "matchTitle": "背书",
          "start": "08:00",
          "end": "08:25",
          "category": "study",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "背书"
        }
      ],
      "previewError": "",
      "aiText": "已安排明早 `08:00-08:25` 背书，适合作为低干扰的晨间记忆块。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4985
    },
    {
      "id": "zh-add-009",
      "group": "add",
      "user": "十六点到十七点做PPT",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "做PPT",
          "start": "16:00",
          "end": "17:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "做PPT",
          "matchTitle": "做PPT",
          "start": "16:00",
          "end": "17:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "做PPT"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `做PPT` 在 16:00-17:00。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4257
    },
    {
      "id": "zh-add-010",
      "group": "add",
      "user": "下午三点一刻到四点开组会",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "组会",
          "start": "15:15",
          "end": "16:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "组会",
          "matchTitle": "组会",
          "start": "15:15",
          "end": "16:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "组会"
        }
      ],
      "previewError": "",
      "aiText": "已安排：`15:15-16:00 组会`。我归到 `other`，优先级先设为 3。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4071
    },
    {
      "id": "zh-add-011",
      "group": "add",
      "user": "晚上11点到11点20拉伸",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "拉伸",
          "start": "23:00",
          "end": "23:20"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "拉伸",
          "matchTitle": "拉伸",
          "start": "23:00",
          "end": "23:20",
          "category": "workout",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "拉伸"
        }
      ],
      "previewError": "",
      "aiText": "已安排：今晚 `23:00-23:20` 拉伸，放在睡前收尾比较合适。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3849
    },
    {
      "id": "zh-add-012",
      "group": "add",
      "user": "中午12点到12点半吃饭",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "吃饭",
          "start": "12:00",
          "end": "12:30"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "吃饭",
          "matchTitle": "吃饭",
          "start": "12:00",
          "end": "12:30",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "吃饭"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `12:00-12:30` 吃饭。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 5885
    },
    {
      "id": "zh-add-013",
      "group": "add",
      "user": "14：00-14：50 读论文",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "读论文",
          "start": "14:00",
          "end": "14:50"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "读论文",
          "matchTitle": "读论文",
          "start": "14:00",
          "end": "14:50",
          "category": "study",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "读论文"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `读论文`：14:00-14:50。注意这会和现有 `写代码` 14:00-15:00 重叠，可能需要稍后挪开其中一个。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4375
    },
    {
      "id": "zh-add-014",
      "group": "add",
      "user": "15;10到15;55 debug",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "debug",
          "start": "15:10",
          "end": "15:55"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "debug",
          "matchTitle": "debug",
          "start": "15:10",
          "end": "15:55",
          "category": "code",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "debug"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `debug` 到 `15:10-15:55`，我归到 `code` 类别，优先级先按中等处理。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3235
    },
    {
      "id": "zh-add-015",
      "group": "add",
      "user": "晚上六点四十到七点十分买东西",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "买东西",
          "start": "18:40",
          "end": "19:10"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "买东西",
          "matchTitle": "买东西",
          "start": "18:40",
          "end": "19:10",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "买东西"
        }
      ],
      "previewError": "",
      "aiText": "已准备添加 `买东西`：18:40-19:10。注意它会和 `Gym` 后 5 分钟、`复习数学` 前 10 分钟重叠，可能需要顺手调整一下。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 5023
    },
    {
      "id": "zh-add-016",
      "group": "add",
      "user": "8.30-9.00 冥想",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "冥想",
          "start": "08:30",
          "end": "09:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "冥想",
          "matchTitle": "冥想",
          "start": "08:30",
          "end": "09:00",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "冥想"
        }
      ],
      "previewError": "",
      "aiText": "已安排 08:30-09:00 冥想。这个时间刚好在 09:00 课程前，适合做低强度启动。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3636
    },
    {
      "id": "zh-add-017",
      "group": "add",
      "user": "22:10 至 22:40 复盘今天",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "复盘今天",
          "start": "22:10",
          "end": "22:40"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "复盘今天",
          "matchTitle": "复盘今天",
          "start": "22:10",
          "end": "22:40",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "复盘今天"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `22:10-22:40` 复盘今天。这个时间段适合做低压回顾：记录完成事项、卡点和明天第一步。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4128
    },
    {
      "id": "zh-add-018",
      "group": "add",
      "user": "帮我在17:05~17:35安排洗衣服",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "洗衣服",
          "start": "17:05",
          "end": "17:35"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "洗衣服",
          "matchTitle": "洗衣服",
          "start": "17:05",
          "end": "17:35",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "洗衣服"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `洗衣服` 在 `17:05-17:35`，归为 `other`，中等精力、优先级 3。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3448
    },
    {
      "id": "zh-add-019",
      "group": "add",
      "user": "晚上8点零5到8点35看书",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "看书",
          "start": "20:05",
          "end": "20:35"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "看书",
          "matchTitle": "看书",
          "start": "20:05",
          "end": "20:35",
          "category": "study",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "看书"
        }
      ],
      "previewError": "",
      "aiText": "已安排：今晚 `20:05-20:35` 看书，30 分钟，放在复习数学后面刚好。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3883
    },
    {
      "id": "zh-add-020",
      "group": "add",
      "user": "一点半到两点处理邮件",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "处理邮件",
          "start": "13:30",
          "end": "14:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "处理邮件",
          "matchTitle": "处理邮件",
          "start": "13:30",
          "end": "14:00",
          "category": "workout",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "处理邮件"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `13:30-14:00` 处理邮件。这个时间块比较短，适合清空紧急邮件和标记后续要深度处理的内容。\n\n有 1 个事项缺少结束时间，我先按 30 分钟生成；这个时间段不确定，请你在日程里自行修改。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3660
    },
    {
      "id": "en-add-021",
      "group": "add",
      "user": "Add reading from 4pm to 4:30pm.",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "reading",
          "start": "16:00",
          "end": "16:30"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "reading",
          "matchTitle": "reading",
          "start": "16:00",
          "end": "16:30",
          "category": "study",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "reading"
        }
      ],
      "previewError": "",
      "aiText": "Added reading for 16:00-16:30.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3335
    },
    {
      "id": "en-add-022",
      "group": "add",
      "user": "Schedule project planning 11:15-noon.",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "project planning",
          "start": "11:15",
          "end": "12:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "project planning",
          "matchTitle": "project planning",
          "start": "11:15",
          "end": "12:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "project planning"
        }
      ],
      "previewError": "",
      "aiText": "Added `project planning` for 11:15-12:00.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3927
    },
    {
      "id": "en-add-023",
      "group": "add",
      "user": "Put laundry at 17:05-17:35.",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "laundry",
          "start": "17:05",
          "end": "17:35"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "Laundry",
          "matchTitle": "Laundry",
          "start": "17:05",
          "end": "17:35",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "Laundry"
        }
      ],
      "previewError": "",
      "aiText": "已安排 Laundry 在 17:05-17:35，类别先归到 other。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3520
    },
    {
      "id": "en-add-024",
      "group": "add",
      "user": "Add a quick walk between 7:30 and 8 pm.",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "walk",
          "start": "19:30",
          "end": "20:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "Quick walk",
          "matchTitle": "Quick walk",
          "start": "19:30",
          "end": "20:00",
          "category": "workout",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "Quick walk"
        }
      ],
      "previewError": "",
      "aiText": "Added a quick 30-minute walk from 19:30 to 20:00.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4982
    },
    {
      "id": "en-add-025",
      "group": "add",
      "user": "Need meditation 8.30-9.00",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "meditation",
          "start": "08:30",
          "end": "09:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "meditation",
          "matchTitle": "meditation",
          "start": "08:30",
          "end": "09:00",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "meditation"
        }
      ],
      "previewError": "",
      "aiText": "Added `meditation` from `08:30` to `09:00`. It fits neatly before `课程` at 09:00.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 6166
    },
    {
      "id": "en-add-026",
      "group": "add",
      "user": "Please create dinner 18:40 to 19:10.",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "dinner",
          "start": "18:40",
          "end": "19:10"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "dinner",
          "matchTitle": "dinner",
          "start": "18:40",
          "end": "19:10",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "dinner"
        }
      ],
      "previewError": "",
      "aiText": "Added dinner from 18:40 to 19:10. Note it overlaps with `Gym` from 18:40-18:45 and `复习数学` from 19:00-19:10, so you may want to adjust one of those.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 5606
    },
    {
      "id": "en-add-027",
      "group": "add",
      "user": "slot in report writing from 21:40 to 22:20",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "report writing",
          "start": "21:40",
          "end": "22:20"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "report writing",
          "matchTitle": "report writing",
          "start": "21:40",
          "end": "22:20",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "report writing"
        }
      ],
      "previewError": "",
      "aiText": "Added `report writing` for `21:40-22:20`.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3384
    },
    {
      "id": "en-add-028",
      "group": "add",
      "user": "new task: email cleanup 13:30-14:00",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "email cleanup",
          "start": "13:30",
          "end": "14:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "email cleanup",
          "matchTitle": "email cleanup",
          "start": "13:30",
          "end": "14:00",
          "category": "workout",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "email cleanup"
        }
      ],
      "previewError": "",
      "aiText": "Added `email cleanup` from 13:30 to 14:00. I marked it as a medium-energy work block; adjust category/priority if you want it treated differently.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3756
    },
    {
      "id": "en-add-029",
      "group": "add",
      "user": "Can you add stretch 23:00-23:20?",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "stretch",
          "start": "23:00",
          "end": "23:20"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "stretch",
          "matchTitle": "stretch",
          "start": "23:00",
          "end": "23:20",
          "category": "workout",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "stretch"
        }
      ],
      "previewError": "",
      "aiText": "Added `stretch` for 23:00-23:20.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3563
    },
    {
      "id": "en-add-030",
      "group": "add",
      "user": "Block 15:10-15:55 for debugging.",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "debugging",
          "start": "15:10",
          "end": "15:55"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "debugging",
          "matchTitle": "debugging",
          "start": "15:10",
          "end": "15:55",
          "category": "code",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "debugging"
        }
      ],
      "previewError": "",
      "aiText": "Added debugging for `15:10-15:55`.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 5045
    },
    {
      "id": "zh-move-031",
      "group": "move",
      "user": "把写代码改到15:30-16:00",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "写代码",
          "start": "15:30",
          "end": "16:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "15:30",
          "end": "16:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已把「写代码」改到 `15:30-16:00`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4626
    },
    {
      "id": "zh-move-032",
      "group": "move",
      "user": "代码下午三点半到四点",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "写代码",
          "start": "15:30",
          "end": "16:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "15:30",
          "end": "16:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已把“写代码”调整到下午 15:30-16:00。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 5746
    },
    {
      "id": "zh-move-033",
      "group": "move",
      "user": "背单词推迟到11:30-12:00",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "背单词",
          "start": "11:30",
          "end": "12:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "11:30",
          "end": "12:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "已把「背单词」推迟到 11:30-12:00。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4679
    },
    {
      "id": "zh-move-034",
      "group": "move",
      "user": "Gym提前到17:00-17:45",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "Gym",
          "start": "17:00",
          "end": "17:45"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "17:00",
          "end": "17:45",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "已将 `Gym` 提前到 `17:00-17:45`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3483
    },
    {
      "id": "zh-move-035",
      "group": "move",
      "user": "数学改到八点半到九点",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "复习数学",
          "start": "20:30",
          "end": "21:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "复习数学",
          "start": "20:30",
          "end": "21:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "已把「复习数学」改到 20:30-21:00。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3713
    },
    {
      "id": "zh-move-036",
      "group": "move",
      "user": "把课程挪到10:00-11:00",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "课程",
          "start": "10:00",
          "end": "11:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "课程",
          "start": "10:00",
          "end": "11:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "conflict",
          "reason": "",
          "title": "课程"
        }
      ],
      "previewError": "",
      "aiText": "已把「课程」挪到 10:00-11:00。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3206
    },
    {
      "id": "zh-move-037",
      "group": "move",
      "user": "写代吗放到15:30到16:30",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "写代码",
          "start": "15:30",
          "end": "16:30"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "15:30",
          "end": "16:30",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已把“写代码”调整到 15:30-16:30。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 9498
    },
    {
      "id": "zh-move-038",
      "group": "move",
      "user": "把背单词往后挪半小时",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "背单词",
          "start": "11:00",
          "end": "11:30"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "11:00",
          "end": "11:30",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "已把“背单词”往后挪半小时：`11:00-11:30`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4331
    },
    {
      "id": "zh-move-039",
      "group": "move",
      "user": "复习数学提前到18:00-19:00",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "复习数学",
          "start": "18:00",
          "end": "19:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "复习数学",
          "start": "18:00",
          "end": "19:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "conflict",
          "reason": "",
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "可以，把`复习数学`提前到 18:00-19:00。注意这会和 18:00-18:45 的 `Gym` 重叠，建议你之后决定是否移动 Gym。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4924
    },
    {
      "id": "zh-move-040",
      "group": "move",
      "user": "Gym 17点到17点45",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "Gym",
          "start": "17:00",
          "end": "17:45"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "17:00",
          "end": "17:45",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "已把 `Gym` 调整为 `17:00-17:45`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3616
    },
    {
      "id": "zh-move-041",
      "group": "move",
      "user": "写代码 16点;20到17点;20",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "写代码",
          "start": "16:20",
          "end": "17:20"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "16:20",
          "end": "17:20",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已把 `写代码` 移到 16:20-17:20。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4431
    },
    {
      "id": "zh-move-042",
      "group": "move",
      "user": "背单词 8：三十到9：00",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "背单词",
          "start": "08:30",
          "end": "09:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "08:30",
          "end": "09:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "已把「背单词」调整到 08:30-09:00，正好接在 09:00 课程前，时间比较紧凑但可行。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4379
    },
    {
      "id": "zh-move-043",
      "group": "move",
      "user": "把数学拖到晚上九点;40到十点20",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "复习数学",
          "start": "21:40",
          "end": "22:20"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "复习数学",
          "start": "21:40",
          "end": "22:20",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "已把「复习数学」移动到晚上 21:40-22:20。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 5603
    },
    {
      "id": "zh-move-044",
      "group": "move",
      "user": "课程改成上午十点半到十一点半",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "课程",
          "start": "10:30",
          "end": "11:30"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "课程",
          "start": "10:30",
          "end": "11:30",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "conflict",
          "reason": "",
          "title": "课程"
        }
      ],
      "previewError": "",
      "aiText": "已把「课程」改到 `10:30-11:30`。注意这会和「背单词」`10:30-11:00` 重叠，可能需要顺手挪一下背单词。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4789
    },
    {
      "id": "zh-move-045",
      "group": "move",
      "user": "写代码不要14点了，改15点到16点",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "写代码",
          "start": "15:00",
          "end": "16:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "15:00",
          "end": "16:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已把 `写代码` 从 14:00-15:00 改到 15:00-16:00。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4442
    },
    {
      "id": "en-move-046",
      "group": "move",
      "user": "Move Gym to 17:00-17:45.",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "Gym",
          "start": "17:00",
          "end": "17:45"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "17:00",
          "end": "17:45",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "Done. I moved `Gym` to `17:00-17:45`.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4015
    },
    {
      "id": "en-move-047",
      "group": "move",
      "user": "Shift coding to 3:30pm-4:30pm.",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "写代码",
          "start": "15:30",
          "end": "16:30"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "15:30",
          "end": "16:30",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "Done. I moved `写代码` to `15:30-16:30`.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4033
    },
    {
      "id": "en-move-048",
      "group": "move",
      "user": "Put vocab at 11:30-12:00.",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "背单词",
          "start": "11:30",
          "end": "12:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "11:30",
          "end": "12:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "已把 `背单词` 移到 11:30-12:00。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3905
    },
    {
      "id": "en-move-049",
      "group": "move",
      "user": "Reschedule math review to 20:30-21:00.",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "复习数学",
          "start": "20:30",
          "end": "21:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "复习数学",
          "start": "20:30",
          "end": "21:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "Done. I’ll move `复习数学` to `20:30-21:00`.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3480
    },
    {
      "id": "en-move-050",
      "group": "move",
      "user": "Move class to 10:00-11:00.",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "课程",
          "start": "10:00",
          "end": "11:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "课程",
          "start": "10:00",
          "end": "11:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "conflict",
          "reason": "",
          "title": "课程"
        }
      ],
      "previewError": "",
      "aiText": "Done, moving `课程` to `10:00-11:00`.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 5550
    },
    {
      "id": "en-move-051",
      "group": "move",
      "user": "code block 16:20-17:20 please",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "写代码",
          "start": "16:20",
          "end": "17:20"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "16:20",
          "end": "17:20",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "Sure, I’ll move `写代码` to `16:20-17:20`.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4960
    },
    {
      "id": "en-move-052",
      "group": "move",
      "user": "delay vocab by 30 minutes",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "背单词",
          "start": "11:00",
          "end": "11:30"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "11:00",
          "end": "11:30",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "Moved `背单词` 30 minutes later, from `10:30-11:00` to `11:00-11:30`.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4588
    },
    {
      "id": "en-move-053",
      "group": "move",
      "user": "bring Gym forward to 5pm-5:45pm",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "Gym",
          "start": "17:00",
          "end": "17:45"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "17:00",
          "end": "17:45",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "Moved `Gym` earlier to 17:00-17:45.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 2911
    },
    {
      "id": "en-move-054",
      "group": "move",
      "user": "math 9:40pm to 10:20pm",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "复习数学",
          "start": "21:40",
          "end": "22:20"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "复习数学",
          "start": "21:40",
          "end": "22:20",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "Moved `复习数学` to `21:40-22:20`.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4505
    },
    {
      "id": "en-move-055",
      "group": "move",
      "user": "change course to 10:30-11:30",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "课程",
          "start": "10:30",
          "end": "11:30"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "课程",
          "start": "10:30",
          "end": "11:30",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "conflict",
          "reason": "",
          "title": "课程"
        }
      ],
      "previewError": "",
      "aiText": "Moved `课程` to `10:30-11:30`. Note this overlaps with `背单词` at `10:30-11:00`, so you may want to move that next.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 6569
    },
    {
      "id": "zh-remove-056",
      "group": "remove",
      "user": "取消Gym",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "Gym"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "已取消 `Gym`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 2733
    },
    {
      "id": "zh-remove-057",
      "group": "remove",
      "user": "复习数学删掉",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "复习数学"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "复习数学",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "已删除 `复习数学`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3736
    },
    {
      "id": "zh-remove-058",
      "group": "remove",
      "user": "写代码不要了",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "写代码"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "好的，已准备移除 `写代码` 这个时间块。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3443
    },
    {
      "id": "zh-remove-059",
      "group": "remove",
      "user": "背单词去掉",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "背单词"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "已去掉 `背单词`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 2583
    },
    {
      "id": "zh-remove-060",
      "group": "remove",
      "user": "课程先移除",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "课程"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "课程",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "课程"
        }
      ],
      "previewError": "",
      "aiText": "已移除 `课程`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3556
    },
    {
      "id": "zh-remove-061",
      "group": "remove",
      "user": "删了Gym吧",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "Gym"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "已删除 `Gym`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3775
    },
    {
      "id": "zh-remove-062",
      "group": "remove",
      "user": "数学复习不做了",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "复习数学"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "复习数学",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "已把 `复习数学` 标记为移除。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3007
    },
    {
      "id": "zh-remove-063",
      "group": "remove",
      "user": "把写代码这个块取消",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "写代码"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已取消「写代码」这个时间块。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4672
    },
    {
      "id": "zh-remove-064",
      "group": "remove",
      "user": "今天不背单词了",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "背单词"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "好的，今天把 `背单词` 这块移除，空出来的 10:30-11:00 可以留作缓冲或休息。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3741
    },
    {
      "id": "zh-remove-065",
      "group": "remove",
      "user": "课程从日程里拿掉",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "课程"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "课程",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "课程"
        }
      ],
      "previewError": "",
      "aiText": "已将「课程」从日程里拿掉。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 2995
    },
    {
      "id": "en-remove-066",
      "group": "remove",
      "user": "Delete Gym.",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "Gym"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "Removed `Gym` from today’s plan.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3027
    },
    {
      "id": "en-remove-067",
      "group": "remove",
      "user": "Remove math review.",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "复习数学"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "复习数学",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "Removed `复习数学` from the plan.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3226
    },
    {
      "id": "en-remove-068",
      "group": "remove",
      "user": "Cancel coding.",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "写代码"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已取消今天的「写代码」安排。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 2926
    },
    {
      "id": "en-remove-069",
      "group": "remove",
      "user": "Drop vocab.",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "背单词"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "已帮你移除 `背单词`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3047
    },
    {
      "id": "en-remove-070",
      "group": "remove",
      "user": "Remove class from schedule.",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "课程"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "课程",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "课程"
        }
      ],
      "previewError": "",
      "aiText": "Removed `课程` from the schedule.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3110
    },
    {
      "id": "en-remove-071",
      "group": "remove",
      "user": "delte Gym",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "Gym"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "Removed `Gym` from your plan.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3996
    },
    {
      "id": "en-remove-072",
      "group": "remove",
      "user": "cnacel coding block",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "写代码"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已取消 `写代码` 这个时间块。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3934
    },
    {
      "id": "en-remove-073",
      "group": "remove",
      "user": "skip vocab today",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "背单词"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "Done, I’ll remove today’s `背单词` block.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3807
    },
    {
      "id": "en-remove-074",
      "group": "remove",
      "user": "No math review today",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "复习数学"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "复习数学",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "已把今天的 `复习数学` 取消。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3445
    },
    {
      "id": "en-remove-075",
      "group": "remove",
      "user": "take out course",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "课程"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "课程",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "课程"
        }
      ],
      "previewError": "",
      "aiText": "Removed `课程` from the plan.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 2843
    },
    {
      "id": "multi-076",
      "group": "multi",
      "user": "7点半到8点跑步，8点到8点半洗澡",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "跑步",
          "startOneOf": [
            "07:30",
            "19:30"
          ],
          "endOneOf": [
            "08:00",
            "20:00"
          ]
        },
        {
          "type": "add_task_block",
          "titleIncludes": "洗澡",
          "startOneOf": [
            "08:00",
            "20:00"
          ],
          "endOneOf": [
            "08:30",
            "20:30"
          ]
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "跑步",
          "matchTitle": "跑步",
          "start": "07:30",
          "end": "08:00",
          "category": "workout",
          "energy": "medium",
          "priority": 3
        },
        {
          "type": "add_task_block",
          "title": "洗澡",
          "matchTitle": "洗澡",
          "start": "08:00",
          "end": "08:30",
          "category": "other",
          "energy": "low",
          "priority": 2
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "跑步"
        },
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "洗澡"
        }
      ],
      "previewError": "",
      "aiText": "已安排：07:30-08:00 跑步，08:00-08:30 洗澡。早上这一段很顺，运动后直接收拾，不会挤到 09:00 的课程。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4796
    },
    {
      "id": "multi-077",
      "group": "multi",
      "user": "把写代码改到16:00-17:00，顺便删掉Gym",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "写代码",
          "start": "16:00",
          "end": "17:00"
        },
        {
          "type": "remove_block",
          "matchTitleIncludes": "Gym"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "写代码",
          "start": "16:00",
          "end": "17:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        },
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "写代码"
        },
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "已调整：把「写代码」移动到 16:00-17:00，并删除「Gym」。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3344
    },
    {
      "id": "multi-078",
      "group": "multi",
      "user": "Add reading 16:00-16:30 and move Gym to 17:00-17:45.",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "reading",
          "start": "16:00",
          "end": "16:30"
        },
        {
          "type": "move_block",
          "matchTitleIncludes": "Gym",
          "start": "17:00",
          "end": "17:45"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "reading",
          "matchTitle": "reading",
          "start": "16:00",
          "end": "16:30",
          "category": "study",
          "energy": "medium",
          "priority": 3
        },
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "17:00",
          "end": "17:45",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "reading"
        },
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "Done. I’ll add `reading` from 16:00-16:30 and move `Gym` to 17:00-17:45.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4612
    },
    {
      "id": "multi-079",
      "group": "multi",
      "user": "背单词改11:30-12:00，再加一个22:10-22:40复盘",
      "expected": [
        {
          "type": "move_block",
          "matchTitleIncludes": "背单词",
          "start": "11:30",
          "end": "12:00"
        },
        {
          "type": "add_task_block",
          "titleIncludes": "复盘",
          "start": "22:10",
          "end": "22:40"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "11:30",
          "end": "12:00",
          "category": "other",
          "energy": "medium",
          "priority": 3
        },
        {
          "type": "add_task_block",
          "title": "复盘",
          "matchTitle": "复盘",
          "start": "22:10",
          "end": "22:40",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "title": "背单词"
        },
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "复盘"
        }
      ],
      "previewError": "",
      "aiText": "已调整：`背单词`改到 11:30-12:00，并新增 22:10-22:40 的`复盘`。晚上这段适合做低强度总结，别安排太硬的输出任务。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 8409
    },
    {
      "id": "multi-080",
      "group": "multi",
      "user": "Delete Gym and cancel math review.",
      "expected": [
        {
          "type": "remove_block",
          "matchTitleIncludes": "Gym"
        },
        {
          "type": "remove_block",
          "matchTitleIncludes": "复习数学"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "Gym",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        },
        {
          "type": "remove_block",
          "title": "",
          "matchTitle": "复习数学",
          "start": "",
          "end": "",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "Gym"
        },
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "已删除 `Gym`，并取消 `复习数学`。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4373
    },
    {
      "id": "amb-081",
      "group": "ambiguous",
      "user": "明天学习一下",
      "expected": [],
      "expectNoAction": true,
      "triggered": false,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [],
      "preview": null,
      "previewError": "",
      "aiText": "可以。先别排太满，建议明天留 2-3 个学习块就够：\n\n- 上午：1 个高专注块，做最难的科目或任务，约 60-90 分钟\n- 下午：1 个中等强度块，整理笔记、刷题或复习，约 45-60 分钟\n- 晚上：1 个轻量块，回顾错题或背诵，约 30 分钟\n\n如果你想让我直接放进日程，告诉我具体时间，比如“明天 9 点到 10 点复习数学”。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4080
    },
    {
      "id": "amb-082",
      "group": "ambiguous",
      "user": "帮我调整一下写代码",
      "expected": [],
      "expectNoAction": true,
      "triggered": false,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [],
      "preview": null,
      "previewError": "",
      "aiText": "可以。你想把「写代码」从现在的 `14:00-15:00` 调到几点？\n\n给我一个开始时间就行，比如：\n- 调到 `16:00`\n- 改成 `20:30-21:30`\n- 往后推半小时",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 10537
    },
    {
      "id": "amb-083",
      "group": "ambiguous",
      "user": "晚上安排点东西",
      "expected": [],
      "expectNoAction": true,
      "triggered": false,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [],
      "preview": null,
      "previewError": "",
      "aiText": "晚上可以轻量补一块，不要排太满。你已经有：\n\n- `18:00-18:45` Gym\n- `19:00-20:00` 复习数学\n\n建议 `20:15-21:00` 做一块低压力整理，比如回顾今天课程、整理代码笔记或收尾杂事；`21:00` 后留给洗漱、放松和睡前缓冲。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 7908
    },
    {
      "id": "amb-084",
      "group": "ambiguous",
      "user": "I need to study tomorrow",
      "expected": [],
      "expectNoAction": true,
      "triggered": false,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [],
      "preview": null,
      "previewError": "",
      "aiText": "Tomorrow, keep it simple: pick one focused study block and one lighter review block.\n\nTry:\n- `09:30-11:00` deep study or problem practice\n- `16:00-16:30` quick review, flashcards, or summary notes\n\nIf tomorrow is busy, start with a single `45-60 min` block and choose the exact subject before you begin.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 3842
    },
    {
      "id": "amb-085",
      "group": "ambiguous",
      "user": "move it later",
      "expected": [],
      "expectNoAction": true,
      "triggered": false,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [],
      "preview": null,
      "previewError": "",
      "aiText": "Which block should I move, and to what time? For example: “move 写代码 to 15:30” or “把背单词挪到 11:30”.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 6250
    },
    {
      "id": "amb-086",
      "group": "ambiguous",
      "user": "delete that",
      "expected": [],
      "expectNoAction": true,
      "triggered": false,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [],
      "preview": null,
      "previewError": "",
      "aiText": "Which block should I delete? Please name it, for example `背单词`, `写代码`, `Gym`, or `复习数学`.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 8505
    },
    {
      "id": "amb-087",
      "group": "ambiguous",
      "user": "八点以后别太累",
      "expected": [],
      "expectNoAction": true,
      "triggered": false,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [],
      "preview": null,
      "previewError": "",
      "aiText": "可以。你现在 20:00 以后已经没有安排，挺适合做低负荷收尾。\n\n建议这样处理：\n\n- `19:00-20:00 复习数学` 保持专注，但别硬冲太难的题。\n- `20:00-20:30` 做轻量整理：错题标记、明天待办、收书桌。\n- `20:30` 之后尽量不安排高强度学习或代码，可以放松、洗澡、拉伸、早点睡。\n- 如果还想补一点东西，控制在 20-30 分钟以内，选低能量任务，比如背几个词或复盘笔记。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 6022
    },
    {
      "id": "amb-088",
      "group": "ambiguous",
      "user": "maybe gym sometime",
      "expected": [],
      "expectNoAction": true,
      "triggered": false,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [],
      "preview": null,
      "previewError": "",
      "aiText": "Gym is already on the plan at **18:00-18:45**. That’s a solid slot: late enough to reset after afternoon work, early enough that it won’t crowd dinner or evening study.\n\nIf you want a lighter option, shift it mentally to **18:00-18:30** and keep **18:30-18:45** for shower/stretching.",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4294
    },
    {
      "id": "amb-089",
      "group": "ambiguous",
      "user": "周末看看数学",
      "expected": [],
      "expectNoAction": true,
      "triggered": false,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [],
      "preview": null,
      "previewError": "",
      "aiText": "可以，把数学放在周末比较适合做“轻复习 + 查漏补缺”，别排太满。\n\n建议这样安排：\n\n周六：  \n`10:00-11:00` 复习本周错题和薄弱点  \n`15:30-16:00` 做一小组练习题\n\n周日：  \n`10:30-11:30` 整理公式/方法  \n`19:30-20:00` 快速回顾，列下周要补的内容\n\n如果只是“看看”，每次 30-60 分钟就够；重点是别打开书漫无目的地翻，先定一个小目标，比如“只看函数错题”或“只刷 5 道题”。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 5779
    },
    {
      "id": "amb-090",
      "group": "ambiguous",
      "user": "安排一下",
      "expected": [],
      "expectNoAction": true,
      "triggered": false,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [],
      "preview": null,
      "previewError": "",
      "aiText": "今天已经有 5 个块，结构挺完整。建议这样安排空档：\n\n- `07:30-08:30`：轻启动，早餐、整理今天材料\n- `08:30-09:00`：预习课程内容\n- `10:00-10:30`：课后整理笔记，接上背单词\n- `11:00-12:00`：低强度复盘或处理杂事\n- `15:00-16:30`：继续写代码或做代码回顾\n- `20:00-20:30`：数学错题整理\n- `22:30-23:00`：收尾，列明天 3 件事\n\n重点：上午保留学习连续性，下午给代码更长的深度时间，晚上复习后别再塞太重的任务。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 10492
    },
    {
      "id": "special-091-user-example",
      "group": "special",
      "user": "我这周日晚上七点半要到教一601考试，然后大概九点要去居酒屋",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "考试",
          "start": "19:30",
          "end": "21:00"
        },
        {
          "type": "add_task_block",
          "titleIncludes": "居酒屋",
          "start": "21:00",
          "end": "21:30"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "教一601考试",
          "matchTitle": "教一601考试",
          "start": "19:30",
          "end": "21:00",
          "category": "other",
          "energy": "high",
          "priority": 5
        },
        {
          "type": "add_task_block",
          "title": "居酒屋",
          "matchTitle": "居酒屋",
          "start": "21:00",
          "end": "21:30",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "教一601考试"
        },
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "居酒屋"
        }
      ],
      "previewError": "",
      "aiText": "已记下：周日晚 `19:30-21:00` 在教一601考试。这个会和现有 `19:00-20:00 复习数学` 冲突，建议把复习数学挪到更早或考试后另找时间。\n\n`21:00` 去居酒屋我先不自动加进日程，因为没有结束时间；如果你想占位，我可以按 30 分钟或你给的时长加上。\n\n有 1 个事项缺少结束时间，我先按 30 分钟生成；这个时间段不确定，请你在日程里自行修改。",
      "model": "gpt-5.5",
      "note": "当前 action schema 没有 date 字段；居酒屋缺结束时间时按 30 分钟暂定，AI 文本应提醒用户自行修改。",
      "elapsedMs": 11928
    },
    {
      "id": "special-092-date-specific",
      "group": "special",
      "user": "这周日19:30-21:00教一601考试",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "考试",
          "start": "19:30",
          "end": "21:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "教一601考试",
          "matchTitle": "教一601考试",
          "start": "19:30",
          "end": "21:00",
          "category": "other",
          "energy": "medium",
          "priority": 4
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "教一601考试"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `教一601考试` 在 `19:30-21:00`。我先按 `other`、中等精力、优先级 4 处理。",
      "model": "gpt-5.5",
      "note": "schema 无 date 字段，只能记录时间块，无法落到周日。",
      "elapsedMs": 6570
    },
    {
      "id": "special-093-start-only",
      "group": "special",
      "user": "九点去居酒屋",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "居酒屋",
          "startOneOf": [
            "09:00",
            "21:00"
          ],
          "endOneOf": [
            "09:30",
            "21:30"
          ]
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "居酒屋",
          "matchTitle": "居酒屋",
          "start": "21:00",
          "end": "21:30",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "居酒屋"
        }
      ],
      "previewError": "",
      "aiText": "已安排“居酒屋”到今晚 `21:00-21:30`。时长不确定，我先按 30 分钟放入，之后可以再拉长。\n\n有 1 个事项缺少结束时间，我先按 30 分钟生成；这个时间段不确定，请你在日程里自行修改。",
      "model": "gpt-5.5",
      "note": "只有开始时间，没有结束时间；按 30 分钟暂定，AI 文本应提醒用户自行修改。",
      "elapsedMs": 7453
    },
    {
      "id": "special-094-location",
      "group": "special",
      "user": "19:30-21:00在教一601考试",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "考试",
          "start": "19:30",
          "end": "21:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "教一601考试",
          "matchTitle": "教一601考试",
          "start": "19:30",
          "end": "21:00",
          "category": "study",
          "energy": "high",
          "priority": 5
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "教一601考试"
        }
      ],
      "previewError": "",
      "aiText": "已准备添加 `考试`：19:30-21:00，地点信息放在标题里更醒目：`教一601考试`。注意它会和现有 `复习数学` 19:00-20:00 重叠，可能需要后续调整。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 29872
    },
    {
      "id": "special-095-typo-time",
      "group": "special",
      "user": "8：三十-9；40 刷题",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "刷题",
          "start": "08:30",
          "end": "09:40"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "刷题",
          "matchTitle": "刷题",
          "start": "08:30",
          "end": "09:40",
          "category": "study",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "刷题"
        }
      ],
      "previewError": "",
      "aiText": "已安排 `刷题` 在 `08:30-09:40`，归为学习任务。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4861
    },
    {
      "id": "special-096-half",
      "group": "special",
      "user": "晚上七点半到九点考试",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "考试",
          "start": "19:30",
          "end": "21:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "考试",
          "matchTitle": "考试",
          "start": "19:30",
          "end": "21:00",
          "category": "other",
          "energy": "high",
          "priority": 5
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "考试"
        }
      ],
      "previewError": "",
      "aiText": "已安排：今晚 `19:30-21:00` 考试。注意它会和现有的 `19:00-20:00 复习数学` 重叠，建议把复习数学挪到考试前后。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 6168
    },
    {
      "id": "special-097-semi",
      "group": "special",
      "user": "九点;40到十点20复盘",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "复盘",
          "startOneOf": [
            "09:40",
            "21:40"
          ],
          "endOneOf": [
            "10:20",
            "22:20"
          ]
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "复盘",
          "matchTitle": "复盘",
          "start": "09:40",
          "end": "10:20",
          "category": "other",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "复盘"
        }
      ],
      "previewError": "",
      "aiText": "已准备添加 `复盘`：09:40-10:20。注意这会和现有 `课程` 09:00-10:00 重叠 20 分钟，可能需要你确认是否要挪开其中一个。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4979
    },
    {
      "id": "special-098-english-start-only",
      "group": "special",
      "user": "Bar at 9 tonight",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "Bar",
          "start": "21:00",
          "end": "21:30"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "Bar",
          "matchTitle": "Bar",
          "start": "21:00",
          "end": "21:30",
          "category": "other",
          "energy": "low",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "Bar"
        }
      ],
      "previewError": "",
      "aiText": "Added `Bar` tonight at `21:00` for 30 minutes. Duration was uncertain, so adjust it if you meant a longer block.\n\n有 1 个事项缺少结束时间，我先按 30 分钟生成；这个时间段不确定，请你在日程里自行修改。",
      "model": "gpt-5.5",
      "note": "Only a start time is provided; default to 30 minutes and tell the user to adjust.",
      "elapsedMs": 5544
    },
    {
      "id": "special-099-english-location",
      "group": "special",
      "user": "Exam in room Jiao 1-601 from 7:30pm to 9pm this Sunday.",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "Exam",
          "start": "19:30",
          "end": "21:00"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "Exam - Jiao 1-601",
          "matchTitle": "Exam - Jiao 1-601",
          "start": "19:30",
          "end": "21:00",
          "category": "other",
          "energy": "medium",
          "priority": 5
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "conflict",
          "reason": "",
          "title": "Exam - Jiao 1-601"
        }
      ],
      "previewError": "",
      "aiText": "Added the exam for **19:30-21:00**. It overlaps with **复习数学 19:00-20:00**, so you may want to move that review block earlier or make it a short warm-up before the exam.",
      "model": "gpt-5.5",
      "note": "schema 无 date 字段，只能记录时间块，无法落到周日。",
      "elapsedMs": 5841
    },
    {
      "id": "special-100-noisy",
      "group": "special",
      "user": "额那个...晚上8：三十吧到9点10，搞一下英语听力",
      "expected": [
        {
          "type": "add_task_block",
          "titleIncludes": "英语听力",
          "start": "20:30",
          "end": "21:10"
        }
      ],
      "expectNoAction": false,
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "英语听力",
          "matchTitle": "英语听力",
          "start": "20:30",
          "end": "21:10",
          "category": "study",
          "energy": "medium",
          "priority": 3
        }
      ],
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "title": "英语听力"
        }
      ],
      "previewError": "",
      "aiText": "好的，已安排今晚 `20:30-21:10` 做英语听力，40 分钟，放在复习数学之后比较顺。",
      "model": "gpt-5.5",
      "note": "",
      "elapsedMs": 4772
    }
  ]
}
```
