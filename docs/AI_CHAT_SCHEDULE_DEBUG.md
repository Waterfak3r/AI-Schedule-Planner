# AI 对话修改日程调试记录

生成时间：2026-06-06T01:58:33.886Z
模型：gpt-5.5
API 预检：通过

| ID | 用户话术 | 触发修改 | 语义一致 | 动作 | Preview | 问题 |
|---|---|---:|---:|---|---|---|
| zh-add-direct | 把阅读安排到16:00-16:30 | 是 | 是 | add_task_block title=阅读 match=阅读 16:00-16:30 | add_task_block:applied |  |
| zh-add-colloquial | 今晚8点到8点半背单词 | 是 | 是 | move_block match=背单词 20:00-20:30 | move_block:applied |  |
| zh-move-direct | 把写代码挪到15:30-16:30 | 是 | 是 | move_block match=写代码 15:30-16:30 | move_block:applied |  |
| zh-remove-short | 复习数学删了 | 是 | 是 | remove_block match=复习数学 | remove_block:applied |  |
| zh-omitted-verb | 写代码 15:30-16:00 | 是 | 是 | move_block match=写代码 15:30-16:00 | move_block:applied |  |
| zh-natural-time | 数学改到八点半到九点 | 是 | 是 | move_block match=复习数学 20:30-21:00 | move_block:applied |  |
| zh-typo-title | 帮我把写代吗挪到15:30到16:30 | 是 | 是 | move_block match=写代码 15:30-16:30 | move_block:applied |  |
| en-move-direct | Move Gym to 17:00-17:45. | 是 | 是 | move_block match=Gym 17:00-17:45 | move_block:applied |  |
| en-add-natural | Add project planning from 11:15 to noon. | 是 | 是 | add_task_block title=project planning match=project planning 11:15-12:00 | add_task_block:applied |  |
| en-remove-mixed-title | Delete 背单词 from my schedule. | 是 | 是 | remove_block match=背单词 | remove_block:applied |  |
| en-typo-delete | delte Gym | 是 | 是 | remove_block match=Gym | remove_block:applied |  |
| zh-delay | 把背单词推迟到11:30-12:00 | 是 | 是 | move_block match=背单词 11:30-12:00 | move_block:applied |  |

## 本地动作应用链路校验

这部分不调用 AI，只把期望动作直接送入 `previewScheduleActions` / `applyScheduleActions`，用于确认日程修改服务本身是否能正确执行。

| ID | 通过 | 动作 | Preview | Apply | 问题 |
|---|---:|---|---|---|---|
| zh-add-direct | 是 | add_task_block title=阅读 16:00-16:30 | add_task_block:applied | add_task_block:applied |  |
| zh-add-colloquial | 是 | move_block match=背单词 20:00-20:30 | move_block:applied | move_block:applied |  |
| zh-move-direct | 是 | move_block match=写代码 15:30-16:30 | move_block:applied | move_block:applied |  |
| zh-remove-short | 是 | remove_block match=复习数学 | remove_block:applied | remove_block:applied |  |
| zh-omitted-verb | 是 | move_block match=写代码 15:30-16:00 | move_block:applied | move_block:applied |  |
| zh-natural-time | 是 | move_block match=复习数学 20:30-21:00 | move_block:applied | move_block:applied |  |
| zh-typo-title | 是 | move_block match=写代码 15:30-16:30 | move_block:applied | move_block:applied |  |
| en-move-direct | 是 | move_block match=Gym 17:00-17:45 | move_block:applied | move_block:applied |  |
| en-add-natural | 是 | add_task_block title=project planning 11:15-12:00 | add_task_block:applied | add_task_block:applied |  |
| en-remove-mixed-title | 是 | remove_block match=背单词 | remove_block:applied | remove_block:applied |  |
| en-typo-delete | 是 | remove_block match=Gym | remove_block:applied | remove_block:applied |  |
| zh-delay | 是 | move_block match=背单词 11:30-12:00 | move_block:applied | move_block:applied |  |

## 原始结果

```json
{
  "apiPreflight": {
    "ok": true,
    "model": "gpt-5.5",
    "error": ""
  },
  "aiDialogResults": [
    {
      "id": "zh-add-direct",
      "language": "zh",
      "style": "direct",
      "user": "把阅读安排到16:00-16:30",
      "expected": {
        "type": "add_task_block",
        "titleIncludes": "阅读",
        "start": "16:00",
        "end": "16:30"
      },
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "add_task_block",
          "title": "阅读",
          "matchTitle": "阅读",
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
          "changed": false,
          "title": "阅读"
        }
      ],
      "previewError": "",
      "aiText": "已安排：16:00-16:30 阅读。这个时间段挺适合放一个中等强度的专注块，下午代码之后也能换换脑子。",
      "model": "gpt-5.5",
      "elapsedMs": 3177
    },
    {
      "id": "zh-add-colloquial",
      "language": "zh",
      "style": "colloquial",
      "user": "今晚8点到8点半背单词",
      "expected": {
        "type": "move_block",
        "matchTitleIncludes": "背单词",
        "start": "20:00",
        "end": "20:30"
      },
      "triggered": true,
      "semanticMatch": true,
      "mismatches": [],
      "actions": [
        {
          "type": "move_block",
          "title": "",
          "matchTitle": "背单词",
          "start": "20:00",
          "end": "20:30",
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
          "changed": false,
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "已把「背单词」调整到今晚 20:00-20:30。",
      "model": "gpt-5.5",
      "elapsedMs": 4112
    },
    {
      "id": "zh-move-direct",
      "language": "zh",
      "style": "direct",
      "user": "把写代码挪到15:30-16:30",
      "expected": {
        "type": "move_block",
        "matchTitleIncludes": "写代码",
        "start": "15:30",
        "end": "16:30"
      },
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
          "changed": false,
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已把「写代码」调整到 15:30-16:30。",
      "model": "gpt-5.5",
      "elapsedMs": 3519
    },
    {
      "id": "zh-remove-short",
      "language": "zh",
      "style": "short",
      "user": "复习数学删了",
      "expected": {
        "type": "remove_block",
        "matchTitleIncludes": "复习数学"
      },
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
          "changed": false,
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "已删除 `复习数学`。",
      "model": "gpt-5.5",
      "elapsedMs": 4663
    },
    {
      "id": "zh-omitted-verb",
      "language": "zh",
      "style": "omitted",
      "user": "写代码 15:30-16:00",
      "expected": {
        "type": "move_block",
        "matchTitleIncludes": "写代码",
        "start": "15:30",
        "end": "16:00"
      },
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
          "changed": false,
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已把“写代码”移动到 15:30-16:00。",
      "model": "gpt-5.5",
      "elapsedMs": 3388
    },
    {
      "id": "zh-natural-time",
      "language": "zh",
      "style": "natural time",
      "user": "数学改到八点半到九点",
      "expected": {
        "type": "move_block",
        "matchTitleIncludes": "复习数学",
        "start": "20:30",
        "end": "21:00"
      },
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
          "changed": false,
          "title": "复习数学"
        }
      ],
      "previewError": "",
      "aiText": "已把 `复习数学` 调整到 20:30-21:00。这样晚饭后有一点缓冲，30 分钟适合做错题回顾或一组重点题。",
      "model": "gpt-5.5",
      "elapsedMs": 5274
    },
    {
      "id": "zh-typo-title",
      "language": "zh",
      "style": "typo",
      "user": "帮我把写代吗挪到15:30到16:30",
      "expected": {
        "type": "move_block",
        "matchTitleIncludes": "写代码",
        "start": "15:30",
        "end": "16:30"
      },
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
          "changed": false,
          "title": "写代码"
        }
      ],
      "previewError": "",
      "aiText": "已安排：把「写代码」从 14:00-15:00 挪到 15:30-16:30。",
      "model": "gpt-5.5",
      "elapsedMs": 4963
    },
    {
      "id": "en-move-direct",
      "language": "en",
      "style": "direct",
      "user": "Move Gym to 17:00-17:45.",
      "expected": {
        "type": "move_block",
        "matchTitleIncludes": "Gym",
        "start": "17:00",
        "end": "17:45"
      },
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
          "changed": false,
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "Gym moved to `17:00-17:45`.",
      "model": "gpt-5.5",
      "elapsedMs": 3342
    },
    {
      "id": "en-add-natural",
      "language": "en",
      "style": "natural",
      "user": "Add project planning from 11:15 to noon.",
      "expected": {
        "type": "add_task_block",
        "titleIncludes": "project planning",
        "start": "11:15",
        "end": "12:00"
      },
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
          "changed": false,
          "title": "project planning"
        }
      ],
      "previewError": "",
      "aiText": "Added `project planning` from 11:15 to 12:00. That fits cleanly after `背单词` and before the afternoon code block.",
      "model": "gpt-5.5",
      "elapsedMs": 4815
    },
    {
      "id": "en-remove-mixed-title",
      "language": "en",
      "style": "mixed title",
      "user": "Delete 背单词 from my schedule.",
      "expected": {
        "type": "remove_block",
        "matchTitleIncludes": "背单词"
      },
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
          "changed": false,
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "Removed `背单词` from your schedule.",
      "model": "gpt-5.5",
      "elapsedMs": 3556
    },
    {
      "id": "en-typo-delete",
      "language": "en",
      "style": "typo",
      "user": "delte Gym",
      "expected": {
        "type": "remove_block",
        "matchTitleIncludes": "Gym"
      },
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
          "changed": false,
          "title": "Gym"
        }
      ],
      "previewError": "",
      "aiText": "Removed `Gym` from your schedule.",
      "model": "gpt-5.5",
      "elapsedMs": 3983
    },
    {
      "id": "zh-delay",
      "language": "zh",
      "style": "common command",
      "user": "把背单词推迟到11:30-12:00",
      "expected": {
        "type": "move_block",
        "matchTitleIncludes": "背单词",
        "start": "11:30",
        "end": "12:00"
      },
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
          "changed": false,
          "title": "背单词"
        }
      ],
      "previewError": "",
      "aiText": "已把 `背单词` 推迟到 `11:30-12:00`。",
      "model": "gpt-5.5",
      "elapsedMs": 3413
    }
  ],
  "localActionChecks": [
    {
      "id": "zh-add-direct",
      "ok": true,
      "action": {
        "type": "add_task_block",
        "title": "阅读",
        "start": "16:00",
        "end": "16:30",
        "category": "study",
        "energy": "medium",
        "priority": 3
      },
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "阅读"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "add_task_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "阅读"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "10:30-11:00 背单词",
          "14:00-15:00 写代码",
          "16:00-16:30 阅读",
          "18:00-18:45 Gym",
          "19:00-20:00 复习数学"
        ]
      },
      "error": ""
    },
    {
      "id": "zh-add-colloquial",
      "ok": true,
      "action": {
        "type": "move_block",
        "matchTitle": "背单词",
        "start": "20:00",
        "end": "20:30"
      },
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "背单词"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "move_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "背单词"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "14:00-15:00 写代码",
          "18:00-18:45 Gym",
          "19:00-20:00 复习数学",
          "20:00-20:30 背单词"
        ]
      },
      "error": ""
    },
    {
      "id": "zh-move-direct",
      "ok": true,
      "action": {
        "type": "move_block",
        "matchTitle": "写代码",
        "start": "15:30",
        "end": "16:30"
      },
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "写代码"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "move_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "写代码"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "10:30-11:00 背单词",
          "15:30-16:30 写代码",
          "18:00-18:45 Gym",
          "19:00-20:00 复习数学"
        ]
      },
      "error": ""
    },
    {
      "id": "zh-remove-short",
      "ok": true,
      "action": {
        "type": "remove_block",
        "matchTitle": "复习数学"
      },
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "复习数学"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "remove_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "复习数学"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "10:30-11:00 背单词",
          "14:00-15:00 写代码",
          "18:00-18:45 Gym"
        ]
      },
      "error": ""
    },
    {
      "id": "zh-omitted-verb",
      "ok": true,
      "action": {
        "type": "move_block",
        "matchTitle": "写代码",
        "start": "15:30",
        "end": "16:00"
      },
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "写代码"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "move_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "写代码"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "10:30-11:00 背单词",
          "15:30-16:00 写代码",
          "18:00-18:45 Gym",
          "19:00-20:00 复习数学"
        ]
      },
      "error": ""
    },
    {
      "id": "zh-natural-time",
      "ok": true,
      "action": {
        "type": "move_block",
        "matchTitle": "复习数学",
        "start": "20:30",
        "end": "21:00"
      },
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "复习数学"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "move_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "复习数学"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "10:30-11:00 背单词",
          "14:00-15:00 写代码",
          "18:00-18:45 Gym",
          "20:30-21:00 复习数学"
        ]
      },
      "error": ""
    },
    {
      "id": "zh-typo-title",
      "ok": true,
      "action": {
        "type": "move_block",
        "matchTitle": "写代码",
        "start": "15:30",
        "end": "16:30"
      },
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "写代码"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "move_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "写代码"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "10:30-11:00 背单词",
          "15:30-16:30 写代码",
          "18:00-18:45 Gym",
          "19:00-20:00 复习数学"
        ]
      },
      "error": ""
    },
    {
      "id": "en-move-direct",
      "ok": true,
      "action": {
        "type": "move_block",
        "matchTitle": "Gym",
        "start": "17:00",
        "end": "17:45"
      },
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "Gym"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "move_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "Gym"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "10:30-11:00 背单词",
          "14:00-15:00 写代码",
          "17:00-17:45 Gym",
          "19:00-20:00 复习数学"
        ]
      },
      "error": ""
    },
    {
      "id": "en-add-natural",
      "ok": true,
      "action": {
        "type": "add_task_block",
        "title": "project planning",
        "start": "11:15",
        "end": "12:00",
        "category": "study",
        "energy": "medium",
        "priority": 3
      },
      "preview": [
        {
          "action": "add_task_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "project planning"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "add_task_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "project planning"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "10:30-11:00 背单词",
          "11:15-12:00 project planning",
          "14:00-15:00 写代码",
          "18:00-18:45 Gym",
          "19:00-20:00 复习数学"
        ]
      },
      "error": ""
    },
    {
      "id": "en-remove-mixed-title",
      "ok": true,
      "action": {
        "type": "remove_block",
        "matchTitle": "背单词"
      },
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "背单词"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "remove_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "背单词"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "14:00-15:00 写代码",
          "18:00-18:45 Gym",
          "19:00-20:00 复习数学"
        ]
      },
      "error": ""
    },
    {
      "id": "en-typo-delete",
      "ok": true,
      "action": {
        "type": "remove_block",
        "matchTitle": "Gym"
      },
      "preview": [
        {
          "action": "remove_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "Gym"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "remove_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "Gym"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "10:30-11:00 背单词",
          "14:00-15:00 写代码",
          "19:00-20:00 复习数学"
        ]
      },
      "error": ""
    },
    {
      "id": "zh-delay",
      "ok": true,
      "action": {
        "type": "move_block",
        "matchTitle": "背单词",
        "start": "11:30",
        "end": "12:00"
      },
      "preview": [
        {
          "action": "move_block",
          "status": "applied",
          "reason": "",
          "changed": false,
          "title": "背单词"
        }
      ],
      "apply": {
        "mode": "apply",
        "summary": {
          "total": 1,
          "changed": 1,
          "byStatus": {
            "applied": 1,
            "skipped": 0,
            "ambiguous": 0,
            "conflict": 0,
            "invalid": 0
          },
          "inputScheduleValid": true,
          "inputScheduleStatus": null,
          "inputScheduleIssueCount": 0,
          "inputScheduleWarningCount": 0
        },
        "results": [
          {
            "action": "move_block",
            "status": "applied",
            "reason": "",
            "changed": false,
            "title": "背单词"
          }
        ],
        "nextBlocks": [
          "09:00-10:00 课程",
          "11:30-12:00 背单词",
          "14:00-15:00 写代码",
          "18:00-18:45 Gym",
          "19:00-20:00 复习数学"
        ]
      },
      "error": ""
    }
  ]
}
```
