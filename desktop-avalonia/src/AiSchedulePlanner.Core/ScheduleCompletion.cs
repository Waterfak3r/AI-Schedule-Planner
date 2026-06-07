namespace AiSchedulePlanner.Core;

public sealed record ScheduleCompletionStats(int Total, int Done)
{
    public int Percent => Total <= 0 ? 0 : (int)Math.Round(Done * 100.0 / Total);
}

public static class ScheduleCompletion
{
    public static bool IsCompletable(ScheduleBlock block)
    {
        return block.Type == ScheduleBlockType.Task;
    }

    public static ScheduleCompletionStats Calculate(DaySchedule schedule, IReadOnlyDictionary<string, bool> completed)
    {
        var blocks = schedule.Blocks.Where(IsCompletable).ToList();
        var done = blocks.Count(block => completed.TryGetValue(block.RuntimeId, out var value) && value);
        return new ScheduleCompletionStats(blocks.Count, done);
    }
}
