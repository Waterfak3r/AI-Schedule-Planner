namespace AiSchedulePlanner.Core;

public enum ScheduleBlockType
{
    Task,
    Fixed,
    Buffer
}

public enum ScheduleIssueLevel
{
    Info,
    Warning,
    Error
}

public static class Ids
{
    public static string New(string prefix)
    {
        return $"{prefix}_{Guid.NewGuid():N}"[..Math.Min(prefix.Length + 9, prefix.Length + 33)];
    }
}

public sealed class PlannerPreferences
{
    public string WakeTime { get; set; } = "07:30";
    public string Bedtime { get; set; } = "23:30";
    public string Tone { get; set; } = "direct";
    public string StartupPage { get; set; } = "Chat";
    public string ScheduleView { get; set; } = "Week";
    public bool SidebarCollapsed { get; set; }
    public bool SchedulePanelCollapsed { get; set; }
}

public sealed class FixedEventRule
{
    public string Id { get; set; } = Ids.New("fixed");
    public string Title { get; set; } = "";
    public string Start { get; set; } = "09:00";
    public string End { get; set; } = "10:00";
    public int BufferMin { get; set; }
    public List<int> DaysOfWeek { get; set; } = [];
    public List<DateOnly> AssignedDates { get; set; } = [];
}

public sealed class TaskRule
{
    public string Id { get; set; } = Ids.New("task");
    public string Title { get; set; } = "";
    public string Category { get; set; } = "other";
    public int DurationMin { get; set; } = 30;
    public string Energy { get; set; } = "medium";
    public int Priority { get; set; } = 3;
    public bool SplitAllowed { get; set; }
    public List<int> DaysOfWeek { get; set; } = [];
    public int WeeklyTargetCount { get; set; }
}

public sealed class ScheduleBlock
{
    public string RuntimeId { get; set; } = Ids.New("block");
    public string? SourceId { get; set; }
    public ScheduleBlockType Type { get; set; } = ScheduleBlockType.Task;
    public string Title { get; set; } = "";
    public string Category { get; set; } = "other";
    public int StartMin { get; set; }
    public int EndMin { get; set; }
    public int BufferMin { get; set; }
    public bool Editable { get; set; } = true;

    public string Start => TimeText.ToTime(StartMin);
    public string End => TimeText.ToTime(EndMin);
    public int DurationMin => Math.Max(0, EndMin - StartMin);

    public ScheduleBlock Clone()
    {
        return new ScheduleBlock
        {
            RuntimeId = RuntimeId,
            SourceId = SourceId,
            Type = Type,
            Title = Title,
            Category = Category,
            StartMin = StartMin,
            EndMin = EndMin,
            BufferMin = BufferMin,
            Editable = Editable
        };
    }
}

public sealed class ScheduleIssue
{
    public ScheduleIssueLevel Level { get; set; } = ScheduleIssueLevel.Info;
    public string Code { get; set; } = "";
    public string Message { get; set; } = "";
}

public sealed class ScheduleSummary
{
    public int TaskCount { get; set; }
    public int FixedEventCount { get; set; }
    public int TaskMinutes { get; set; }
    public int FixedMinutes { get; set; }
    public int UnscheduledCount { get; set; }
    public int IssueCount { get; set; }
}

public sealed class DaySchedule
{
    public DateOnly Date { get; set; } = DateOnly.FromDateTime(DateTime.Today);
    public string DayStart { get; set; } = TimeText.FullDayStart;
    public string DayEnd { get; set; } = TimeText.FullDayEnd;
    public int DayStartMin { get; set; } = TimeText.FullDayStartMin;
    public int DayEndMin { get; set; } = TimeText.FullDayEndMin;
    public List<ScheduleBlock> Blocks { get; set; } = [];
    public List<TaskRule> Unscheduled { get; set; } = [];
    public List<ScheduleIssue> Issues { get; set; } = [];
    public ScheduleSummary Summary { get; set; } = new();

    public DaySchedule Clone()
    {
        return new DaySchedule
        {
            Date = Date,
            DayStart = DayStart,
            DayEnd = DayEnd,
            DayStartMin = DayStartMin,
            DayEndMin = DayEndMin,
            Blocks = Blocks.Select(block => block.Clone()).ToList(),
            Unscheduled = Unscheduled.Select(task => task.Clone()).ToList(),
            Issues = Issues.Select(issue => new ScheduleIssue
            {
                Level = issue.Level,
                Code = issue.Code,
                Message = issue.Message
            }).ToList(),
            Summary = new ScheduleSummary
            {
                TaskCount = Summary.TaskCount,
                FixedEventCount = Summary.FixedEventCount,
                TaskMinutes = Summary.TaskMinutes,
                FixedMinutes = Summary.FixedMinutes,
                UnscheduledCount = Summary.UnscheduledCount,
                IssueCount = Summary.IssueCount
            }
        };
    }
}

public sealed class WeekDaySchedule
{
    public DateOnly Date { get; set; }
    public DaySchedule Schedule { get; set; } = new();
    public bool Ok => !Schedule.Issues.Any(issue => issue.Level == ScheduleIssueLevel.Error);
}

public sealed class WeekPlan
{
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public List<WeekDaySchedule> Days { get; set; } = [];
}

public sealed class PlannerState
{
    public PlannerPreferences Preferences { get; set; } = new();
    public List<FixedEventRule> FixedEvents { get; set; } = [];
    public List<TaskRule> Tasks { get; set; } = [];
    public Dictionary<string, bool> Completed { get; set; } = [];
    public int RuleVersion { get; set; }
    public Dictionary<string, DaySchedule> DayOverrides { get; set; } = [];
    public Dictionary<string, int> DayOverrideRuleVersions { get; set; } = [];
    public List<CommunityPost> CommunityPosts { get; set; } = [];
}

public sealed class CommunityPost
{
    public string Id { get; set; } = Ids.New("post");
    public string Text { get; set; } = "";
    public int Likes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
}

public static class ModelCloning
{
    public static PlannerState Clone(this PlannerState state)
    {
        return new PlannerState
        {
            Preferences = state.Preferences.Clone(),
            FixedEvents = state.FixedEvents.Select(item => item.Clone()).ToList(),
            Tasks = state.Tasks.Select(task => task.Clone()).ToList(),
            Completed = new Dictionary<string, bool>(state.Completed),
            RuleVersion = state.RuleVersion,
            DayOverrides = state.DayOverrides.ToDictionary(item => item.Key, item => item.Value.Clone()),
            DayOverrideRuleVersions = new Dictionary<string, int>(state.DayOverrideRuleVersions),
            CommunityPosts = state.CommunityPosts.Select(item => item.Clone()).ToList()
        };
    }

    public static PlannerPreferences Clone(this PlannerPreferences preferences)
    {
        return new PlannerPreferences
        {
            WakeTime = preferences.WakeTime,
            Bedtime = preferences.Bedtime,
            Tone = preferences.Tone,
            StartupPage = preferences.StartupPage,
            ScheduleView = preferences.ScheduleView,
            SidebarCollapsed = preferences.SidebarCollapsed,
            SchedulePanelCollapsed = preferences.SchedulePanelCollapsed
        };
    }

    public static FixedEventRule Clone(this FixedEventRule fixedEvent)
    {
        return new FixedEventRule
        {
            Id = fixedEvent.Id,
            Title = fixedEvent.Title,
            Start = fixedEvent.Start,
            End = fixedEvent.End,
            BufferMin = fixedEvent.BufferMin,
            DaysOfWeek = [.. fixedEvent.DaysOfWeek],
            AssignedDates = [.. fixedEvent.AssignedDates]
        };
    }

    public static TaskRule Clone(this TaskRule task)
    {
        return new TaskRule
        {
            Id = task.Id,
            Title = task.Title,
            Category = task.Category,
            DurationMin = task.DurationMin,
            Energy = task.Energy,
            Priority = task.Priority,
            SplitAllowed = task.SplitAllowed,
            DaysOfWeek = [.. task.DaysOfWeek],
            WeeklyTargetCount = task.WeeklyTargetCount
        };
    }

    public static CommunityPost Clone(this CommunityPost post)
    {
        return new CommunityPost
        {
            Id = post.Id,
            Text = post.Text,
            Likes = post.Likes,
            CreatedAt = post.CreatedAt
        };
    }
}
