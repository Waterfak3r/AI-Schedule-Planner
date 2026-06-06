namespace AiSchedulePlanner.Core;

public sealed class ScheduleActionService : IScheduleActionService
{
    public ScheduleActionPreview Preview(DaySchedule schedule, IEnumerable<ScheduleAction> actions)
    {
        var clone = schedule.Clone();
        var apply = ApplyInternal(clone, actions, returnWorkingSchedule: false);
        return new ScheduleActionPreview { Results = apply.Results };
    }

    public ScheduleActionApplyResult Apply(DaySchedule schedule, IEnumerable<ScheduleAction> actions)
    {
        var clone = schedule.Clone();
        return ApplyInternal(clone, actions, returnWorkingSchedule: true);
    }

    private static ScheduleActionApplyResult ApplyInternal(DaySchedule schedule, IEnumerable<ScheduleAction> actions, bool returnWorkingSchedule)
    {
        var working = schedule.Clone();
        var results = new List<ScheduleActionResult>();

        var index = 0;
        foreach (var action in actions)
        {
            var result = ApplyOne(working, action, index, mutate: true);
            results.Add(result);
            index += 1;
        }

        working.Blocks = [.. working.Blocks.OrderBy(block => block.StartMin).ThenBy(block => block.EndMin)];
        working.Summary = BuildSummary(working);
        return new ScheduleActionApplyResult
        {
            NextSchedule = returnWorkingSchedule ? working : schedule.Clone(),
            Results = results
        };
    }

    private static ScheduleActionResult ApplyOne(DaySchedule schedule, ScheduleAction action, int index, bool mutate)
    {
        var actionWarnings = BuildActionWarnings(action);
        if (action.Date is not null && action.Date.Value != schedule.Date)
        {
            return Skipped(index, $"这条改动属于 {action.Date:yyyy-MM-dd}，当前打开的是 {schedule.Date:yyyy-MM-dd}", actionWarnings);
        }

        return NormalizeActionType(action.Type) switch
        {
            "add_task_block" or "schedule.add_block" => AddBlock(schedule, action, index, mutate),
            "move_block" or "schedule.move_block" => MoveBlock(schedule, action, index, mutate),
            "remove_block" or "schedule.remove_block" => RemoveBlock(schedule, action, index, mutate),
            _ => Skipped(index, $"不支持的操作类型：{action.Type}", actionWarnings)
        };
    }

    private static ScheduleActionResult AddBlock(DaySchedule schedule, ScheduleAction action, int index, bool mutate)
    {
        var title = string.IsNullOrWhiteSpace(action.Title) ? action.MatchTitle : action.Title;
        if (string.IsNullOrWhiteSpace(title)) return Invalid(index, "缺少日程标题", BuildActionWarnings(action));

        var range = ResolveRange(action, fallbackDuration: 30, fallbackDurationIsInferred: true);
        if (range is null) return Invalid(index, "缺少有效开始时间", BuildActionWarnings(action));

        var block = new ScheduleBlock
        {
            RuntimeId = Ids.New("manual"),
            Type = ScheduleBlockType.Task,
            Title = title.Trim(),
            Category = string.IsNullOrWhiteSpace(action.Category) ? "other" : action.Category.Trim(),
            StartMin = range.Start,
            EndMin = range.End,
            Editable = true
        };
        var warnings = BuildActionWarnings(action, BuildRangeWarnings(range));

        var conflicts = FindConflicts(schedule, block);
        if (conflicts.Count > 0)
        {
            return new ScheduleActionResult
            {
                Index = index,
                Status = "conflict",
                Message = $"{block.Title} 与现有日程冲突",
                ConflictingBlocks = conflicts,
                Warnings = warnings
            };
        }

        if (mutate) schedule.Blocks.Add(block);
        var suffix = warnings.Count == 0 ? "" : $"；{string.Join("；", warnings)}";
        return new ScheduleActionResult
        {
            Index = index,
            Status = "applied",
            Message = $"新增 {block.Start}-{block.End} {block.Title}{suffix}",
            CreatedBlock = block,
            Warnings = warnings
        };
    }

    private static ScheduleActionResult MoveBlock(DaySchedule schedule, ScheduleAction action, int index, bool mutate)
    {
        var warnings = BuildActionWarnings(action);
        var target = ResolveTargetBlock(schedule, action);
        if (target.Ambiguous) return Skipped(index, BuildAmbiguousTargetMessage("调整", target.Candidates), warnings);
        var block = target.Block;
        if (block is null) return Skipped(index, $"没有找到可调整的日程：{TargetLabel(action)}", warnings);

        var duration = Math.Max(5, block.EndMin - block.StartMin);
        var range = ResolveRange(action, fallbackDuration: duration, fallbackDurationIsInferred: false);
        if (range is null) return Invalid(index, "缺少有效开始时间", warnings);

        var candidate = block.Clone();
        candidate.StartMin = range.Start;
        candidate.EndMin = range.End;
        var conflicts = FindConflicts(schedule, candidate, block.RuntimeId);
        if (conflicts.Count > 0)
        {
            return new ScheduleActionResult
            {
                Index = index,
                Status = "conflict",
                Message = $"{block.Title} 调整后会冲突",
                ConflictingBlocks = conflicts,
                Warnings = warnings
            };
        }

        if (mutate)
        {
            block.StartMin = candidate.StartMin;
            block.EndMin = candidate.EndMin;
        }

        return new ScheduleActionResult
        {
            Index = index,
            Status = "applied",
            Message = $"调整 {block.Title} 到 {candidate.Start}-{candidate.End}",
            UpdatedBlock = mutate ? block.Clone() : candidate,
            Warnings = warnings
        };
    }

    private static ScheduleActionResult RemoveBlock(DaySchedule schedule, ScheduleAction action, int index, bool mutate)
    {
        var warnings = BuildActionWarnings(action);
        var target = ResolveTargetBlock(schedule, action);
        if (target.Ambiguous) return Skipped(index, BuildAmbiguousTargetMessage("删除", target.Candidates), warnings);
        var block = target.Block;
        if (block is null) return Skipped(index, $"没有找到可删除的日程：{TargetLabel(action)}", warnings);

        if (mutate) schedule.Blocks.Remove(block);
        return new ScheduleActionResult
        {
            Index = index,
            Status = "applied",
            Message = $"删除 {block.Title}",
            RemovedBlock = block.Clone(),
            Warnings = warnings
        };
    }

    private static string NormalizeActionType(string value)
    {
        return (value ?? string.Empty).Trim().ToLowerInvariant().Replace('-', '_');
    }

    private static ResolvedRange? ResolveRange(ScheduleAction action, int fallbackDuration, bool fallbackDurationIsInferred)
    {
        var start = TimeText.ParseMinutes(action.Start);
        if (start is null) return null;
        var end = TimeText.ParseMinutes(action.End);
        var duration = Math.Clamp(action.DurationMinutes ?? fallbackDuration, 5, 480);
        var resolvedEnd = end ?? start.Value + duration;
        if (resolvedEnd <= start) resolvedEnd = start.Value + duration;
        if (start < TimeText.FullDayStartMin || resolvedEnd > TimeText.FullDayEndMin) return null;
        var inferredByModel = end is null &&
            (NormalizeTimeConfidence(action.TimeConfidence) is "inferred_duration" ||
             action.NeedsConfirmation == true ||
             action.Assumptions.Any(text => text.Contains("时长", StringComparison.OrdinalIgnoreCase) ||
                                            text.Contains("duration", StringComparison.OrdinalIgnoreCase)));
        var inferredByFallback = fallbackDurationIsInferred &&
            end is null &&
            (action.DurationMinutes is null || action.DurationMinutes.Value == fallbackDuration);
        return new ResolvedRange(start.Value, resolvedEnd, inferredByModel || inferredByFallback);
    }

    private static List<string> BuildRangeWarnings(ResolvedRange range)
    {
        return range.DurationInferred
            ? [$"时长未明确，暂按 {range.End - range.Start} 分钟处理，请按实际情况修改。"]
            : [];
    }

    private static List<string> BuildActionWarnings(ScheduleAction action, IEnumerable<string>? rangeWarnings = null)
    {
        var warnings = new List<string>();
        if (rangeWarnings is not null) warnings.AddRange(rangeWarnings);

        if (action.NeedsConfirmation == true)
        {
            warnings.Add("AI 标记此改动需要确认，请核对后再保存。");
        }

        var timeConfidence = NormalizeTimeConfidence(action.TimeConfidence);
        if (!string.IsNullOrWhiteSpace(timeConfidence) && timeConfidence != "exact")
        {
            warnings.Add(timeConfidence == "inferred_duration"
                ? "AI 标记时间或时长为推断结果，请核对。"
                : $"AI 标记时间置信度为 {action.TimeConfidence.Trim()}，请核对。");
        }

        warnings.AddRange((action.Assumptions ?? [])
            .Select(assumption => (assumption ?? "").Trim())
            .Where(assumption => !string.IsNullOrWhiteSpace(assumption))
            .Select(assumption => $"AI 假设：{assumption}"));

        return warnings.Distinct().ToList();
    }

    private static string NormalizeTimeConfidence(string value)
    {
        return (value ?? string.Empty).Trim().ToLowerInvariant().Replace('-', '_');
    }

    private static TargetResolution ResolveTargetBlock(DaySchedule schedule, ScheduleAction action)
    {
        var editable = schedule.Blocks.Where(block => block.Editable && block.Type != ScheduleBlockType.Buffer).ToList();
        if (!string.IsNullOrWhiteSpace(action.RuntimeId))
        {
            var byId = editable.FirstOrDefault(block => string.Equals(block.RuntimeId, action.RuntimeId, StringComparison.OrdinalIgnoreCase));
            return byId is null ? TargetResolution.NotFound : TargetResolution.Resolved(byId);
        }

        var title = !string.IsNullOrWhiteSpace(action.MatchTitle) ? action.MatchTitle : action.Title;
        if (string.IsNullOrWhiteSpace(title)) return TargetResolution.NotFound;

        var exact = editable
            .Where(block => string.Equals(block.Title, title, StringComparison.OrdinalIgnoreCase))
            .DistinctBy(block => block.RuntimeId)
            .ToList();
        var candidates = exact.Count > 0
            ? exact
            : editable
                .Where(block => block.Title.Contains(title, StringComparison.OrdinalIgnoreCase))
                .Concat(editable.Where(block => title.Contains(block.Title, StringComparison.OrdinalIgnoreCase)))
                .DistinctBy(block => block.RuntimeId)
                .ToList();

        if (IsRemoveAction(action) && HasTimeHint(action))
        {
            var timed = MatchByExistingTime(candidates, action);
            return timed is null ? TargetResolution.NotFound : TargetResolution.Resolved(timed);
        }

        return candidates.Count switch
        {
            0 => TargetResolution.NotFound,
            1 => TargetResolution.Resolved(candidates[0]),
            _ => TargetResolution.AmbiguousTarget(candidates)
        };
    }

    private static string TargetLabel(ScheduleAction action)
    {
        var title = !string.IsNullOrWhiteSpace(action.MatchTitle) ? action.MatchTitle : action.Title;
        return string.IsNullOrWhiteSpace(title) ? "未指定标题" : title.Trim();
    }

    private static bool IsRemoveAction(ScheduleAction action)
    {
        return NormalizeActionType(action.Type) is "remove_block" or "schedule.remove_block";
    }

    private static string BuildAmbiguousTargetMessage(string verb, IReadOnlyList<ScheduleBlock> candidates)
    {
        var options = string.Join("、", candidates
            .OrderBy(block => block.StartMin)
            .ThenBy(block => block.EndMin)
            .Take(4)
            .Select(block => $"{block.Start}-{block.End} {block.Title}"));
        var suffix = candidates.Count > 4 ? $" 等 {candidates.Count} 个" : "";
        return $"找到多个可能要{verb}的日程，请补充具体时间或先选中后操作：{options}{suffix}";
    }

    private static bool HasTimeHint(ScheduleAction action)
    {
        return TimeText.ParseMinutes(action.Start) is not null || TimeText.ParseMinutes(action.End) is not null;
    }

    private static ScheduleBlock? MatchByExistingTime(IReadOnlyList<ScheduleBlock> candidates, ScheduleAction action)
    {
        if (candidates.Count == 0) return null;

        var start = TimeText.ParseMinutes(action.Start);
        var end = TimeText.ParseMinutes(action.End);
        if (start is null && end is null) return null;

        return candidates.FirstOrDefault(block =>
            (start is null || block.StartMin == start.Value) &&
            (end is null || block.EndMin == end.Value));
    }

    private sealed record ResolvedRange(int Start, int End, bool DurationInferred);

    private sealed record TargetResolution(ScheduleBlock? Block, bool Ambiguous, List<ScheduleBlock> Candidates)
    {
        public static TargetResolution NotFound { get; } = new(null, false, []);

        public static TargetResolution Resolved(ScheduleBlock block)
        {
            return new TargetResolution(block, false, [block]);
        }

        public static TargetResolution AmbiguousTarget(List<ScheduleBlock> candidates)
        {
            return new TargetResolution(null, true, candidates);
        }
    }

    private static List<ScheduleBlock> FindConflicts(DaySchedule schedule, ScheduleBlock candidate, string? ignoredRuntimeId = null)
    {
        var conflicts = new List<ScheduleBlock>();
        foreach (var block in schedule.Blocks.Where(block => block.Type != ScheduleBlockType.Buffer))
        {
            if (!string.IsNullOrWhiteSpace(ignoredRuntimeId) &&
                string.Equals(block.RuntimeId, ignoredRuntimeId, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var start = block.Type == ScheduleBlockType.Fixed ? block.StartMin - block.BufferMin : block.StartMin;
            var end = block.Type == ScheduleBlockType.Fixed ? block.EndMin + block.BufferMin : block.EndMin;
            if (candidate.StartMin < end && start < candidate.EndMin)
            {
                conflicts.Add(block.Clone());
            }
        }

        return conflicts;
    }

    private static ScheduleSummary BuildSummary(DaySchedule schedule)
    {
        var visibleBlocks = schedule.Blocks.Where(block => block.Type != ScheduleBlockType.Buffer).ToList();
        return new ScheduleSummary
        {
            TaskCount = visibleBlocks.Count(block => block.Type == ScheduleBlockType.Task),
            FixedEventCount = visibleBlocks.Count(block => block.Type == ScheduleBlockType.Fixed),
            TaskMinutes = visibleBlocks.Where(block => block.Type == ScheduleBlockType.Task).Sum(block => block.DurationMin),
            FixedMinutes = visibleBlocks.Where(block => block.Type == ScheduleBlockType.Fixed).Sum(block => block.DurationMin),
            UnscheduledCount = schedule.Unscheduled.Count,
            IssueCount = schedule.Issues.Count
        };
    }

    private static ScheduleActionResult Skipped(int index, string message, List<string>? warnings = null) => new()
    {
        Index = index,
        Status = "skipped",
        Message = message,
        Warnings = warnings ?? []
    };

    private static ScheduleActionResult Invalid(int index, string message, List<string>? warnings = null) => new()
    {
        Index = index,
        Status = "invalid",
        Message = message,
        Warnings = warnings ?? []
    };
}
