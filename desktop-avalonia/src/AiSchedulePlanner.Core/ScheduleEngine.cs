namespace AiSchedulePlanner.Core;

public sealed class ScheduleEngine : IScheduleEngine
{
    public DaySchedule BuildDay(ScheduleBuildRequest request)
    {
        var dayStartMin = TimeText.ParseMinutes(request.DayStart) ?? TimeText.FullDayStartMin;
        var dayEndMin = TimeText.ParseMinutes(request.DayEnd) ?? TimeText.FullDayEndMin;
        if (dayEndMin <= dayStartMin) dayEndMin = TimeText.FullDayEndMin;

        var activeStartMin = Math.Max(dayStartMin, TimeText.ParseMinutes(request.ActiveStart) ?? dayStartMin);
        var activeEndMin = Math.Min(dayEndMin, TimeText.ParseMinutes(request.ActiveEnd) ?? dayEndMin);
        if (activeEndMin <= activeStartMin)
        {
            activeStartMin = dayStartMin;
            activeEndMin = dayEndMin;
        }

        var schedule = new DaySchedule
        {
            Date = request.Date,
            DayStart = TimeText.ToTime(dayStartMin),
            DayEnd = TimeText.ToTime(dayEndMin),
            DayStartMin = dayStartMin,
            DayEndMin = dayEndMin
        };

        var fixedBlocks = BuildFixedBlocks(request.FixedEvents, request.Date, dayStartMin, dayEndMin);
        schedule.Blocks.AddRange(fixedBlocks);
        schedule.Issues.AddRange(FindInternalConflicts(fixedBlocks));

        var busy = fixedBlocks
            .Select(block => (
                Start: Math.Max(dayStartMin, block.StartMin - Math.Max(0, block.BufferMin)),
                End: Math.Min(dayEndMin, block.EndMin + Math.Max(0, block.BufferMin))))
            .ToList();

        foreach (var task in request.Tasks
                     .Where(task => ShouldTaskRunOnDate(task, request.Date))
                     .OrderByDescending(task => task.Priority)
                     .ThenBy(task => task.Title, StringComparer.OrdinalIgnoreCase))
        {
            var duration = Math.Clamp(task.DurationMin, 5, 480);
            var placement = FindFirstGap(busy, activeStartMin, activeEndMin, duration);
            if (placement is null)
            {
                schedule.Unscheduled.Add(task.Clone());
                schedule.Issues.Add(new ScheduleIssue
                {
                    Level = ScheduleIssueLevel.Warning,
                    Code = "unscheduled_task",
                    Message = $"{task.Title} 没有找到 {duration} 分钟空档"
                });
                continue;
            }

            var block = new ScheduleBlock
            {
                RuntimeId = $"{request.Date:yyyyMMdd}_{task.Id}",
                SourceId = task.Id,
                Type = ScheduleBlockType.Task,
                Title = task.Title,
                Category = task.Category,
                StartMin = placement.Value.Start,
                EndMin = placement.Value.Start + duration,
                Editable = true
            };
            schedule.Blocks.Add(block);
            busy.Add((block.StartMin, block.EndMin));
            busy.Sort((left, right) => left.Start.CompareTo(right.Start));
        }

        if (request.IncludeBuffers)
        {
            schedule.Blocks.AddRange(BuildBufferBlocks(fixedBlocks, dayStartMin, dayEndMin));
        }

        schedule.Blocks = [.. schedule.Blocks.OrderBy(block => block.StartMin).ThenBy(block => block.EndMin)];
        schedule.Summary = BuildSummary(schedule);
        return schedule;
    }

    public WeekPlan BuildWeek(ScheduleBuildRequest request)
    {
        var start = TimeText.MondayOfWeek(request.Date);
        var assignedTargets = AssignWeeklyTargetTasks(request.Tasks, start);
        var plan = new WeekPlan
        {
            StartDate = start,
            EndDate = start.AddDays(6)
        };

        for (var offset = 0; offset < 7; offset++)
        {
            var date = start.AddDays(offset);
            var tasks = request.Tasks
                .Where(task => task.WeeklyTargetCount <= 0)
                .Concat(assignedTargets.TryGetValue(date, out var assigned) ? assigned : [])
                .Select(task => task.Clone())
                .ToList();

            var schedule = BuildDay(new ScheduleBuildRequest
            {
                Date = date,
                DayStart = request.DayStart,
                DayEnd = request.DayEnd,
                ActiveStart = request.ActiveStart,
                ActiveEnd = request.ActiveEnd,
                FixedEvents = request.FixedEvents,
                Tasks = tasks,
                IncludeBuffers = request.IncludeBuffers
            });

            plan.Days.Add(new WeekDaySchedule
            {
                Date = date,
                Schedule = schedule
            });
        }

        return plan;
    }

    private static List<ScheduleBlock> BuildFixedBlocks(IEnumerable<FixedEventRule> rules, DateOnly date, int dayStartMin, int dayEndMin)
    {
        var blocks = new List<ScheduleBlock>();
        foreach (var rule in rules.Where(rule => ShouldFixedRunOnDate(rule, date)))
        {
            var start = TimeText.ParseMinutes(rule.Start);
            var end = TimeText.ParseMinutes(rule.End);
            if (start is null || end is null || end <= start) continue;

            blocks.Add(new ScheduleBlock
            {
                RuntimeId = $"{date:yyyyMMdd}_{rule.Id}",
                SourceId = rule.Id,
                Type = ScheduleBlockType.Fixed,
                Title = rule.Title,
                Category = "fixed",
                StartMin = Math.Clamp(start.Value, dayStartMin, dayEndMin),
                EndMin = Math.Clamp(end.Value, dayStartMin, dayEndMin),
                BufferMin = Math.Clamp(rule.BufferMin, 0, 180),
                Editable = true
            });
        }

        return [.. blocks.OrderBy(block => block.StartMin).ThenBy(block => block.EndMin)];
    }

    private static bool ShouldFixedRunOnDate(FixedEventRule rule, DateOnly date)
    {
        if (rule.AssignedDates.Count > 0) return rule.AssignedDates.Contains(date);
        if (rule.DaysOfWeek.Count == 0) return true;
        return rule.DaysOfWeek.Contains(TimeText.WeekdayNumber(date));
    }

    private static bool ShouldTaskRunOnDate(TaskRule task, DateOnly date)
    {
        if (task.WeeklyTargetCount > 0) return false;
        if (task.DaysOfWeek.Count == 0) return false;
        return task.DaysOfWeek.Contains(TimeText.WeekdayNumber(date));
    }

    private static List<ScheduleIssue> FindInternalConflicts(IReadOnlyList<ScheduleBlock> fixedBlocks)
    {
        var issues = new List<ScheduleIssue>();
        for (var i = 0; i < fixedBlocks.Count; i++)
        {
            for (var j = i + 1; j < fixedBlocks.Count; j++)
            {
                var left = fixedBlocks[i];
                var right = fixedBlocks[j];
                var leftStart = left.StartMin - left.BufferMin;
                var leftEnd = left.EndMin + left.BufferMin;
                var rightStart = right.StartMin - right.BufferMin;
                var rightEnd = right.EndMin + right.BufferMin;
                if (leftStart < rightEnd && rightStart < leftEnd)
                {
                    issues.Add(new ScheduleIssue
                    {
                        Level = ScheduleIssueLevel.Error,
                        Code = "fixed_conflict",
                        Message = $"{left.Title} 与 {right.Title} 时间冲突"
                    });
                }
            }
        }

        return issues;
    }

    private static (int Start, int End)? FindFirstGap(List<(int Start, int End)> busy, int startMin, int endMin, int duration)
    {
        var cursor = startMin;
        foreach (var interval in busy.OrderBy(item => item.Start))
        {
            if (interval.End <= cursor) continue;
            if (interval.Start - cursor >= duration) return (cursor, cursor + duration);
            cursor = Math.Max(cursor, interval.End);
        }

        return endMin - cursor >= duration ? (cursor, cursor + duration) : null;
    }

    private static IEnumerable<ScheduleBlock> BuildBufferBlocks(IEnumerable<ScheduleBlock> fixedBlocks, int dayStartMin, int dayEndMin)
    {
        foreach (var block in fixedBlocks.Where(block => block.BufferMin > 0))
        {
            var beforeStart = Math.Max(dayStartMin, block.StartMin - block.BufferMin);
            if (beforeStart < block.StartMin)
            {
                yield return new ScheduleBlock
                {
                    RuntimeId = $"{block.RuntimeId}_buffer_before",
                    SourceId = block.SourceId,
                    Type = ScheduleBlockType.Buffer,
                    Title = $"{block.Title} 缓冲",
                    Category = "buffer",
                    StartMin = beforeStart,
                    EndMin = block.StartMin,
                    Editable = false
                };
            }

            var afterEnd = Math.Min(dayEndMin, block.EndMin + block.BufferMin);
            if (block.EndMin < afterEnd)
            {
                yield return new ScheduleBlock
                {
                    RuntimeId = $"{block.RuntimeId}_buffer_after",
                    SourceId = block.SourceId,
                    Type = ScheduleBlockType.Buffer,
                    Title = $"{block.Title} 缓冲",
                    Category = "buffer",
                    StartMin = block.EndMin,
                    EndMin = afterEnd,
                    Editable = false
                };
            }
        }
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

    private static Dictionary<DateOnly, List<TaskRule>> AssignWeeklyTargetTasks(IEnumerable<TaskRule> tasks, DateOnly weekStart)
    {
        var result = new Dictionary<DateOnly, List<TaskRule>>();
        var load = Enumerable.Range(0, 7).ToDictionary(offset => weekStart.AddDays(offset), _ => 0);

        foreach (var task in tasks.Where(task => task.WeeklyTargetCount > 0).OrderByDescending(task => task.Priority))
        {
            var allowedDates = Enumerable.Range(0, 7)
                .Select(offset => weekStart.AddDays(offset))
                .Where(date => task.DaysOfWeek.Count == 0 || task.DaysOfWeek.Contains(TimeText.WeekdayNumber(date)))
                .OrderBy(date => load[date])
                .ThenBy(date => date)
                .Take(Math.Clamp(task.WeeklyTargetCount, 1, 7))
                .ToList();

            foreach (var date in allowedDates)
            {
                if (!result.TryGetValue(date, out var list))
                {
                    list = [];
                    result[date] = list;
                }

                var assignedTask = task.Clone();
                assignedTask.WeeklyTargetCount = 0;
                assignedTask.DaysOfWeek = [TimeText.WeekdayNumber(date)];
                list.Add(assignedTask);
                load[date] += Math.Max(5, task.DurationMin);
            }
        }

        return result;
    }
}
