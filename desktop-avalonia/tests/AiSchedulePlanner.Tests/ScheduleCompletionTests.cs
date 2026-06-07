using AiSchedulePlanner.Core;

namespace AiSchedulePlanner.Tests;

public sealed class ScheduleCompletionTests
{
    [Fact]
    public void IsCompletableReturnsTrueOnlyForTasks()
    {
        Assert.True(ScheduleCompletion.IsCompletable(new ScheduleBlock { Type = ScheduleBlockType.Task }));
        Assert.False(ScheduleCompletion.IsCompletable(new ScheduleBlock { Type = ScheduleBlockType.Fixed }));
        Assert.False(ScheduleCompletion.IsCompletable(new ScheduleBlock { Type = ScheduleBlockType.Buffer }));
    }

    [Fact]
    public void CalculateIgnoresFixedEventsAndBuffers()
    {
        var schedule = new DaySchedule
        {
            Blocks =
            [
                Block("task-1", ScheduleBlockType.Task),
                Block("task-2", ScheduleBlockType.Task),
                Block("fixed-1", ScheduleBlockType.Fixed),
                Block("buffer-1", ScheduleBlockType.Buffer)
            ]
        };
        var completed = new Dictionary<string, bool>
        {
            ["task-1"] = true,
            ["task-2"] = false,
            ["fixed-1"] = true,
            ["buffer-1"] = true
        };

        var stats = ScheduleCompletion.Calculate(schedule, completed);

        Assert.Equal(2, stats.Total);
        Assert.Equal(1, stats.Done);
        Assert.Equal(50, stats.Percent);
    }

    [Fact]
    public void CalculateRoundsPercentToNearestWholeNumber()
    {
        var schedule = new DaySchedule
        {
            Blocks =
            [
                Block("task-1", ScheduleBlockType.Task),
                Block("task-2", ScheduleBlockType.Task),
                Block("task-3", ScheduleBlockType.Task)
            ]
        };
        var completed = new Dictionary<string, bool>
        {
            ["task-1"] = true
        };

        var stats = ScheduleCompletion.Calculate(schedule, completed);

        Assert.Equal(3, stats.Total);
        Assert.Equal(1, stats.Done);
        Assert.Equal(33, stats.Percent);
    }

    private static ScheduleBlock Block(string runtimeId, ScheduleBlockType type)
    {
        return new ScheduleBlock
        {
            RuntimeId = runtimeId,
            Type = type,
            Title = runtimeId,
            StartMin = 8 * 60,
            EndMin = 8 * 60 + 30
        };
    }
}
