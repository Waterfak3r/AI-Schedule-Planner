namespace AiSchedulePlanner.Core;

public sealed class AiSettings
{
    public string BaseUrl { get; set; } = "https://api.openai.com/v1";
    public string Model { get; set; } = "gpt-4.1-mini";
    public string ChatPath { get; set; } = "/chat/completions";
    public string ApiKey { get; set; } = "";
    public string ApiKeyHeader { get; set; } = "Authorization";
    public string ApiKeyPrefix { get; set; } = "Bearer ";
    public string StylePrompt { get; set; } = "直接、清晰、简短。";
}

public sealed class AiChatMessage
{
    public string Role { get; set; } = "user";
    public string Content { get; set; } = "";
}

public sealed class AiChatRequest
{
    public AiSettings Settings { get; set; } = new();
    public PlannerState PlannerState { get; set; } = new();
    public DateOnly FocusDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);
    public DaySchedule? CurrentSchedule { get; set; }
    public List<AiChatMessage> Messages { get; set; } = [];
}

public sealed class AiChatResult
{
    public string Text { get; set; } = "";
    public string Model { get; set; } = "";
    public List<ScheduleAction> Actions { get; set; } = [];
}

public sealed class ScheduleAction
{
    public string Type { get; set; } = "";
    public DateOnly? Date { get; set; }
    public string Title { get; set; } = "";
    public string MatchTitle { get; set; } = "";
    public string RuntimeId { get; set; } = "";
    public string Start { get; set; } = "";
    public string End { get; set; } = "";
    public int? DurationMinutes { get; set; }
    public string Category { get; set; } = "other";
}

public sealed class ScheduleActionResult
{
    public int Index { get; set; }
    public string Status { get; set; } = "skipped";
    public string Message { get; set; } = "";
    public ScheduleBlock? CreatedBlock { get; set; }
    public ScheduleBlock? UpdatedBlock { get; set; }
    public ScheduleBlock? RemovedBlock { get; set; }
    public List<ScheduleBlock> ConflictingBlocks { get; set; } = [];
}

public sealed class ScheduleActionPreview
{
    public List<ScheduleActionResult> Results { get; set; } = [];
    public int ApplicableCount => Results.Count(item => item.Status == "applied");
}

public sealed class ScheduleActionApplyResult
{
    public DaySchedule NextSchedule { get; set; } = new();
    public List<ScheduleActionResult> Results { get; set; } = [];
    public int ChangedCount => Results.Count(item => item.Status == "applied");
}
