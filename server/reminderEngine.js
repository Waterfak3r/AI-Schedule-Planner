const { clampInt, isPlainObject } = require("./utils");
const { parseTimeToMinutes } = require("./time");

function readCategoryMinutes(byCat, keys) {
  for (const key of keys) {
    if (byCat[key] != null) {
      return clampInt(byCat[key], 0, 24 * 60);
    }
  }
  return 0;
}

function pickScenario(stats) {
  const allGreen = Boolean(stats?.allGreen);
  if (allGreen) return "all_green";

  const byCat = stats?.minutesByCategory || {};
  const study = readCategoryMinutes(byCat, ["study", "学习", "瀛︿範"]);
  const code = readCategoryMinutes(byCat, ["code", "代码", "浠ｇ爜"]);
  const workout = readCategoryMinutes(byCat, ["workout", "运动", "杩愬姩"]);

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
  return String(text)
    .replace(/去你妈/gu, "上线你的日程")
    .replace(/废物|垃圾|蠢货/gu, "不在状态")
    .trim();
}

function fmtTimeOrFallback(value) {
  if (!value) return null;
  const minutes = parseTimeToMinutes(value);
  if (minutes == null) return null;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function generateSleepReminder(input) {
  if (!isPlainObject(input)) input = {};

  const tone = normalizeTone(input.tone);
  const scenario = pickScenario(input.stats);
  const bedtime = fmtTimeOrFallback(input.bedtime) || "23:30";
  const wakeTime = fmtTimeOrFallback(input.wakeTime) || "07:30";

  const byCat = input.stats?.minutesByCategory || {};
  const studyMin = readCategoryMinutes(byCat, ["study", "学习", "瀛︿範"]);
  const codeMin = readCategoryMinutes(byCat, ["code", "代码", "浠ｇ爜"]);
  const workoutMin = readCategoryMinutes(byCat, ["workout", "运动", "杩愬姩"]);

  const vars = { bedtime, wakeTime, studyMin, codeMin, workoutMin };
  const text = safeText(renderTemplate({ tone, scenario, vars }));

  return { tone, scenario, text, vars };
}

function renderTemplate({ tone, scenario, vars }) {
  const { bedtime, wakeTime, studyMin, codeMin, workoutMin } = vars;

  const groups = templates();
  const group = groups[scenario] || groups.generic;
  const pick = group[tone] || group.snarky;
  return pick({ bedtime, wakeTime, studyMin, codeMin, workoutMin });
}

function templates() {
  return {
    study_heavy: {
      gentle: ({ bedtime, wakeTime, studyMin }) =>
        `你今天学习了 ${studyMin} 分钟，已经很扎实了。现在睡觉能帮你把记忆再巩固一遍。建议 ${bedtime} 前躺下，我会在 ${wakeTime} 叫你继续。`,
      snarky: ({ bedtime, studyMin }) =>
        `背了 ${studyMin} 分钟还不睡？你的海马体已经在申请下班了。${bedtime} 前关屏，不然明天只剩“我昨晚明明学过”的错觉。`,
      roast: ({ bedtime, studyMin }) =>
        `你今天学了 ${studyMin} 分钟，功德 +1。现在不睡，功德 -3。${bedtime} 前上床，别让努力输给熬夜。`,
    },
    code_heavy: {
      gentle: ({ bedtime, wakeTime, codeMin }) =>
        `今天写了 ${codeMin} 分钟代码，辛苦了。睡一觉会让你明天的思路更清楚。${bedtime} 前收工，${wakeTime} 再回来把它写漂亮。`,
      snarky: ({ bedtime, codeMin }) =>
        `404 Sleep Not Found？你今天已经写了 ${codeMin} 分钟代码，还想继续堆栈溢出吗。${bedtime} 前强制下线，明天再 Debug。`,
      roast: ({ bedtime }) =>
        `再写下去大概率只是在制造新 Bug。${bedtime} 前别再加功能了，去睡，明天的你会感谢现在停手。`,
    },
    workout_heavy: {
      gentle: ({ bedtime, wakeTime, workoutMin }) =>
        `今天运动了 ${workoutMin} 分钟，身体已经给足反馈了。现在睡觉会恢复得更好。${bedtime} 前躺平，${wakeTime} 起床会轻松很多。`,
      snarky: ({ bedtime, workoutMin }) =>
        `你今天练了 ${workoutMin} 分钟，肌肉正在申请“睡眠补贴”。${bedtime} 前不躺下，明天你的腿会先拒绝合作。`,
      roast: ({ bedtime }) =>
        `不睡觉，白练。${bedtime} 前闭眼，不然明天你走路会像刚学会直立。`,
    },
    all_green: {
      gentle: ({ bedtime }) =>
        `今天全绿打卡，做得很好。现在去睡，把这个状态延续到明天。${bedtime} 前上床。`,
      snarky: ({ bedtime }) =>
        `别以为你今天全绿，我就会放你继续熬。真正的连胜是把睡眠也守住。${bedtime} 前躺下。`,
      roast: ({ bedtime }) =>
        `今天任务清得挺干净。现在轮到最后一个 Boss: 睡觉。${bedtime} 前别再刷了。`,
    },
    generic: {
      gentle: ({ bedtime }) =>
        `今天也辛苦了，给大脑一点恢复时间吧。${bedtime} 前去睡觉。`,
      snarky: ({ bedtime }) =>
        `再拖下去只会更困更摆。${bedtime} 前睡，不然明天起床像系统自检失败。`,
      roast: ({ bedtime }) =>
        `你现在不睡，明天的你会来骂今天的你。${bedtime} 前关灯，上床。`,
    },
  };
}

module.exports = { generateSleepReminder };
