namespace AiSchedulePlanner.Core;

public sealed class ScheduleBuildRequest
{
    public DateOnly Date { get; set; } = DateOnly.FromDateTime(DateTime.Today);
    public string DayStart { get; set; } = TimeText.FullDayStart;
    public string DayEnd { get; set; } = TimeText.FullDayEnd;
    public string ActiveStart { get; set; } = "07:30";
    public string ActiveEnd { get; set; } = "23:30";
    public List<FixedEventRule> FixedEvents { get; set; } = [];
    public List<TaskRule> Tasks { get; set; } = [];
    public bool IncludeBuffers { get; set; } = true;
}

public interface IScheduleEngine
{
    DaySchedule BuildDay(ScheduleBuildRequest request);
    WeekPlan BuildWeek(ScheduleBuildRequest request);
}

public interface IScheduleActionService
{
    ScheduleActionPreview Preview(DaySchedule schedule, IEnumerable<ScheduleAction> actions);
    ScheduleActionApplyResult Apply(DaySchedule schedule, IEnumerable<ScheduleAction> actions);
}

public interface IPlannerStore
{
    string DataDirectory { get; }
    Task<PlannerState> LoadStateAsync(CancellationToken cancellationToken = default);
    Task SaveStateAsync(PlannerState state, CancellationToken cancellationToken = default);
    Task<AiSettings> LoadAiSettingsAsync(CancellationToken cancellationToken = default);
    Task SaveAiSettingsAsync(AiSettings settings, CancellationToken cancellationToken = default);
}

public interface IAiChatService
{
    Task<AiChatResult> SendAsync(AiChatRequest request, CancellationToken cancellationToken = default);
}

public interface IReminderService
{
    string Generate(DaySchedule schedule);
}
