namespace AiSchedulePlanner.Core;

public sealed class ReminderService : IReminderService
{
    public string Generate(DaySchedule schedule)
    {
        var blocks = schedule.Blocks
            .Where(block => block.Type != ScheduleBlockType.Buffer)
            .OrderBy(block => block.StartMin)
            .ToList();

        if (blocks.Count == 0)
        {
            return $"{schedule.Date:yyyy-MM-dd} 还没有日程。";
        }

        var lines = new List<string> { $"{schedule.Date:yyyy-MM-dd} 日程提醒" };
        lines.AddRange(blocks.Select(block => $"{block.Start}-{block.End}  {block.Title}"));
        if (schedule.Unscheduled.Count > 0)
        {
            lines.Add($"未排入：{string.Join("、", schedule.Unscheduled.Select(task => task.Title))}");
        }

        return string.Join(Environment.NewLine, lines);
    }
}
