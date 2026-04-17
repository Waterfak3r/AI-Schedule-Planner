const { clampInt, isPlainObject } = require("./utils");
const { parseTimeToMinutes } = require("./time");

function pickScenario(stats) {
  const allGreen = Boolean(stats?.allGreen);
  if (allGreen) return "all_green";

  const byCat = stats?.minutesByCategory || {};
  const study = clampInt(byCat.study ?? byCat["学习"] ?? 0, 0, 24 * 60);
  const code = clampInt(byCat.code ?? byCat["代码"] ?? 0, 0, 24 * 60);
  const workout = clampInt(byCat.workout ?? byCat["运动"] ?? 0, 0, 24 * 60);

  if (study >= 120) return "study_heavy";
  if (code >= 120) return "code_heavy";
  if (workout >= 60) return "workout_heavy";
  return "generic";
}

function normalizeTone(tone) {
  const t = String(tone || "snarky");
  if (t === "gentle" || t === "snarky" || t === "roast") return t;
  return "snarky";
}

function safeText(text) {
  // Tiny “safety belt”: keep the vibe, but remove obvious escalation phrases.
  return String(text)
    .replace(/去你家/gu, "上线你的日程")
    .replace(/废物|垃圾|蠢/gu, "不在状态")
    .trim();
}

function fmtTimeOrFallback(t) {
  if (!t) return null;
  const m = parseTimeToMinutes(t);
  if (m == null) return null;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function generateSleepReminder(input) {
  if (!isPlainObject(input)) input = {};

  const tone = normalizeTone(input.tone);
  const scenario = pickScenario(input.stats);
  const bedtime = fmtTimeOrFallback(input.bedtime) || "23:30";
  const wakeTime = fmtTimeOrFallback(input.wakeTime) || "07:30";

  const byCat = input.stats?.minutesByCategory || {};
  const studyMin = clampInt(byCat.study ?? byCat["学习"] ?? 0, 0, 24 * 60);
  const codeMin = clampInt(byCat.code ?? byCat["代码"] ?? 0, 0, 24 * 60);
  const workoutMin = clampInt(byCat.workout ?? byCat["运动"] ?? 0, 0, 24 * 60);

  const vars = { bedtime, wakeTime, studyMin, codeMin, workoutMin };

  const text = safeText(renderTemplate({ tone, scenario, vars }));
  return { tone, scenario, text, vars };
}

function renderTemplate({ tone, scenario, vars }) {
  const { bedtime, wakeTime, studyMin, codeMin, workoutMin } = vars;

  const T = templates();
  const group = T[scenario] || T.generic;
  const pick = group[tone] || group.snarky;
  return pick({ bedtime, wakeTime, studyMin, codeMin, workoutMin });
}

function templates() {
  return {
    study_heavy: {
      gentle: ({ bedtime, wakeTime, studyMin }) =>
        `你今天学习了 ${studyMin} 分钟，真的很顶。现在睡觉能帮你把记忆巩固起来。建议 ${bedtime} 前躺下，我会在 ${wakeTime} 叫你。`,
      snarky: ({ bedtime, studyMin }) =>
        `背了 ${studyMin} 分钟还不睡？你的海马体已经在打卡下班了。${bedtime} 前关机，不然明天它就把记忆“回收站清空”。`,
      roast: ({ bedtime, studyMin }) =>
        `你今天学习 ${studyMin} 分钟，功德+1。现在不睡就功德-3。${bedtime} 前上床，别让努力输给熬夜。`,
    },
    code_heavy: {
      gentle: ({ bedtime, wakeTime, codeMin }) =>
        `今天写了 ${codeMin} 分钟代码，辛苦了。睡一觉能让你明天思路更清晰。${bedtime} 前收工，${wakeTime} 再继续把它写漂亮。`,
      snarky: ({ bedtime, codeMin }) =>
        `404 Sleep Not Found？你今天写了 ${codeMin} 分钟代码，还想继续堆栈溢出吗？${bedtime} 前强制关机，明天再 Debug。`,
      roast: ({ bedtime }) => `再写也只是制造更多 Bug。${bedtime} 前别再加新功能了：去睡觉，明天你会感谢我。`,
    },
    workout_heavy: {
      gentle: ({ bedtime, wakeTime, workoutMin }) =>
        `今天运动了 ${workoutMin} 分钟，身体已经很给面子了。现在睡觉能更好恢复。${bedtime} 前躺平，${wakeTime} 起床你会更轻松。`,
      snarky: ({ bedtime, workoutMin }) =>
        `你今天练了 ${workoutMin} 分钟，肌肉正在申请“睡眠补贴”。${bedtime} 前不躺下，明天你的腿会跟你断交。`,
      roast: ({ bedtime }) => `不睡觉=白练。${bedtime} 前闭眼，不然明天你走路像刚学会直立行走。`,
    },
    all_green: {
      gentle: ({ bedtime }) => `今天全绿打卡，做得很棒。现在去睡觉，把胜利延续到明天：${bedtime} 前上床。`,
      snarky: ({ bedtime }) =>
        `别以为你全绿我就没法“管”。睡眠连胜才是隐藏成就。${bedtime} 前躺下，别让我把你明天的任务自动加倍。`,
      roast: ({ bedtime }) => `今天任务全清了？很好。现在轮到最难 Boss：睡觉。${bedtime} 前别再刷屏了，去打这场副本。`,
    },
    generic: {
      gentle: ({ bedtime }) => `今天也辛苦了。给大脑一个休息的机会：${bedtime} 前去睡觉。`,
      snarky: ({ bedtime }) => `再拖下去只会更困更摆烂。${bedtime} 前睡，不然明天起床像开机自检失败。`,
      roast: ({ bedtime }) => `你现在不睡，明天的你会来骂今天的你。${bedtime} 前关灯，上床。`,
    },
  };
}

module.exports = { generateSleepReminder };

