namespace AiSchedulePlanner.Core;

public sealed class ScheduleActionService : IScheduleActionService
{
    public ScheduleActionPreview Preview(DaySchedule schedule, IEnumerable<ScheduleAction> actions)
    {
        var clone = schedule.Clone();
        var apply = ApplyInternal(clone, actions, mutate: false);
        return new ScheduleActionPreview { Results = apply.Results };
    }

    public ScheduleActionApplyResult Apply(DaySchedule schedule, IEnumerable<ScheduleAction> actions)
    {
        var clone = schedule.Clone();
        return ApplyInternal(clone, actions, mutate: true);
    }

    private static ScheduleActionApplyResult ApplyInternal(DaySchedule schedule, IEnumerable<ScheduleAction> actions, bool mutate)
    {
        var working = schedule.Clone();
        var results = new List<ScheduleActionResult>();

        var index = 0;
        foreach (var action in actions)
        {
            var result = ApplyOne(working, action, index, mutate);
            results.Add(result);
            index += 1;
        }

        working.Blocks = [.. working.Blocks.OrderBy(block => block.StartMin).ThenBy(block => block.EndMin)];
        working.Summary = BuildSummary(working);
        return new ScheduleActionApplyResult
        {
            NextSchedule = mutate ? working : schedule.Clone(),
            Results = results
        };
    }

    private static ScheduleActionResult ApplyOne(DaySchedule schedule, ScheduleAction action, int index, bool mutate)
    {
        if (action.Date is not null && action.Date.Value != schedule.Date)
        {
            return Skipped(index, $"这条改动属于 {action.Date:yyyy-MM-dd}，当前打开的是 {schedule.Date:yyyy-MM-dd}");
        }

        return NormalizeActionType(action.Type) switch
        {
            "add_task_block" or "schedule.add_block" => AddBlock(schedule, action, index, mutate),
            "move_block" or "schedule.move_block" => MoveBlock(schedule, action, index, mutate),
            "remove_block" or "schedule.remove_block" => RemoveBlock(schedule, action, index, mutate),
            _ => Skipped(index, $"不支持的操作类型：{action.Type}")
        };
    }

    private static ScheduleActionResult AddBlock(DaySchedule schedule, ScheduleAction action, int index, bool mutate)
    {
        var title = string.IsNullOrWhiteSpace(action.Title) ? action.MatchTitle : action.Title;
        if (string.IsNullOrWhiteSpace(title)) return Invalid(index, "缺少日程标题");

        var range = ResolveRange(action, fallbackDuration: 30);
        if (range is null) return Invalid(index, "缺少有效开始时间");

        var block = new ScheduleBlock
        {
            RuntimeId = Ids.New("manual"),
            Type = ScheduleBlockType.Task,
            Title = title.Trim(),
            Category = string.IsNullOrWhiteSpace(action.Category) ? "other" : action.Category.Trim(),
            StartMin = range.Value.Start,
            EndMin = range.Value.End,
            Editable = true
        };

        var conflicts = FindConflicts(schedule, block);
        if (conflicts.Count > 0)
        {
            return new ScheduleActionResult
            {
                Index = index,
                Status = "conflict",
                Message = $"{block.Title} 与现有日程冲突",
                ConflictingBlocks = conflicts
            };
        }

        if (mutate) schedule.Blocks.Add(block);
        return new ScheduleActionResult
        {
            Index = index,
            Status = "applied",
            Message = $"新增 {block.Start}-{block.End} {block.Title}",
            CreatedBlock = block
        };
    }

    private static ScheduleActionResult MoveBlock(DaySchedule schedule, ScheduleAction action, int index, bool mutate)
    {
        var block = FindTargetBlock(schedule, action);
        if (block is null) return Skipped(index, $"没有找到可调整的日程：{action.MatchTitle}");

        var duration = Math.Max(5, block.EndMin - block.StartMin);
        var range = ResolveRange(action, fallbackDuration: duration);
        if (range is null) return Invalid(index, "缺少有效开始时间");

        var candidate = block.Clone();
        candidate.StartMin = range.Value.Start;
        candidate.EndMin = range.Value.End;
        var conflicts = FindConflicts(schedule, candidate, block.RuntimeId);
        if (conflicts.Count > 0)
        {
            return new ScheduleActionResult
            {
                Index = index,
                Status = "conflict",
                Message = $"{block.Title} 调整后会冲突",
                ConflictingBlocks = conflicts
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
            UpdatedBlock = mutate ? block.Clone() : candidate
        };
    }

    private static ScheduleActionResult RemoveBlock(DaySchedule schedule, ScheduleAction action, int index, bool mutate)
    {
        var block = FindTargetBlock(schedule, action);
        if (block is null) return Skipped(index, $"没有找到可删除的日程：{action.MatchTitle}");

        if (mutate) schedule.Blocks.Remove(block);
        return new ScheduleActionResult
        {
            Index = index,
            Status = "applied",
            Message = $"删除 {block.Title}",
            RemovedBlock = block.Clone()
        };
    }

    private static string NormalizeActionType(string value)
    {
        return (value ?? string.Empty).Trim().ToLowerInvariant().Replace('-', '_');
    }

    private static (int Start, int End)? ResolveRange(ScheduleAction action, int fallbackDuration)
    {
        var start = TimeText.ParseMinutes(action.Start);
        if (start is null) return null;
        var end = TimeText.ParseMinutes(action.End);
        var duration = Math.Clamp(action.DurationMinutes ?? fallbackDuration, 5, 480);
        var resolvedEnd = end ?? start.Value + duration;
        if (resolvedEnd <= start) resolvedEnd = start.Value + duration;
        if (start < TimeText.FullDayStartMin || resolvedEnd > TimeText.FullDayEndMin) return null;
        return (start.Value, resolvedEnd);
    }

    private static ScheduleBlock? FindTargetBlock(DaySchedule schedule, ScheduleAction action)
    {
        var editable = schedule.Blocks.Where(block => block.Editable && block.Type != ScheduleBlockType.Buffer).ToList();
        if (!string.IsNullOrWhiteSpace(action.RuntimeId))
        {
            var byId = editable.FirstOrDefault(block => string.Equals(block.RuntimeId, action.RuntimeId, StringComparison.OrdinalIgnoreCase));
            if (byId is not null) return byId;
        }

        var title = !string.IsNullOrWhiteSpace(action.MatchTitle) ? action.MatchTitle : action.Title;
        if (string.IsNullOrWhiteSpace(title)) return null;

        return editable.FirstOrDefault(block => string.Equals(block.Title, title, StringComparison.OrdinalIgnoreCase))
               ?? editable.FirstOrDefault(block => block.Title.Contains(title, StringComparison.OrdinalIgnoreCase))
               ?? editable.FirstOrDefault(block => title.Contains(block.Title, StringComparison.OrdinalIgnoreCase));
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

    private static ScheduleActionResult Skipped(int index, string message) => new()
    {
        Index = index,
        Status = "skipped",
        Message = message
    };

    private static ScheduleActionResult Invalid(int index, string message) => new()
    {
        Index = index,
        Status = "invalid",
        Message = message
    };
}
