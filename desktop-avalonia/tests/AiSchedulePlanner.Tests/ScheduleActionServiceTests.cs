using AiSchedulePlanner.Core;

namespace AiSchedulePlanner.Tests;

public sealed class ScheduleActionServiceTests
{
    [Fact]
    public void Apply_adds_start_only_action_as_thirty_minutes()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 7));

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "add_task_block",
                Date = new DateOnly(2026, 6, 7),
                Title = "居酒屋",
                Start = "21:00"
            }
        ]);

        Assert.Equal(1, result.ChangedCount);
        var block = Assert.Single(result.NextSchedule.Blocks);
        Assert.Equal("居酒屋", block.Title);
        Assert.Equal("21:00", block.Start);
        Assert.Equal("21:30", block.End);
    }

    [Fact]
    public void Apply_moves_existing_block_by_title()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "math_1",
            Title = "复习数学",
            Type = ScheduleBlockType.Task,
            StartMin = 19 * 60,
            EndMin = 20 * 60,
            Editable = true
        });

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "move_block",
                MatchTitle = "复习数学",
                Start = "20:30",
                End = "21:00"
            }
        ]);

        Assert.Equal(1, result.ChangedCount);
        var block = Assert.Single(result.NextSchedule.Blocks);
        Assert.Equal("20:30", block.Start);
        Assert.Equal("21:00", block.End);
    }

    [Fact]
    public void Apply_moves_start_only_action_and_preserves_existing_duration()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "exam_1",
            Title = "教一601考试",
            Type = ScheduleBlockType.Task,
            StartMin = 19 * 60 + 30,
            EndMin = 21 * 60,
            Editable = true
        });

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "move_block",
                MatchTitle = "考试",
                Start = "20:00"
            }
        ]);

        Assert.Equal(1, result.ChangedCount);
        var block = Assert.Single(result.NextSchedule.Blocks);
        Assert.Equal("20:00", block.Start);
        Assert.Equal("21:30", block.End);
    }

    [Fact]
    public void Apply_removes_editable_block_by_partial_title()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "bar_1",
            Title = "居酒屋",
            Type = ScheduleBlockType.Task,
            StartMin = 21 * 60,
            EndMin = 21 * 60 + 30,
            Editable = true
        });

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "remove_block",
                MatchTitle = "酒屋"
            }
        ]);

        Assert.Equal(1, result.ChangedCount);
        Assert.Empty(result.NextSchedule.Blocks);
        Assert.Equal("居酒屋", result.Results.Single().RemovedBlock?.Title);
    }

    [Fact]
    public void Preview_marks_conflicting_add_without_mutating_schedule()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "course",
            Title = "课程",
            Type = ScheduleBlockType.Fixed,
            StartMin = 10 * 60,
            EndMin = 11 * 60,
            Editable = true
        });

        var preview = service.Preview(schedule, [
            new ScheduleAction
            {
                Type = "add_task_block",
                Title = "写代码",
                Start = "10:30",
                End = "11:30"
            }
        ]);

        var result = Assert.Single(preview.Results);
        Assert.Equal("conflict", result.Status);
        Assert.Single(schedule.Blocks);
    }

    [Fact]
    public void Preview_treats_fixed_event_buffer_as_conflict()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "course",
            Title = "课程",
            Type = ScheduleBlockType.Fixed,
            StartMin = 10 * 60,
            EndMin = 11 * 60,
            BufferMin = 15,
            Editable = true
        });

        var preview = service.Preview(schedule, [
            new ScheduleAction
            {
                Type = "add_task_block",
                Title = "背单词",
                Start = "09:50",
                End = "10:00"
            }
        ]);

        var result = Assert.Single(preview.Results);
        Assert.Equal("conflict", result.Status);
        Assert.Equal("课程", result.ConflictingBlocks.Single().Title);
    }

    [Fact]
    public void Apply_skips_actions_for_other_dates()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "add_task_block",
                Date = new DateOnly(2026, 6, 7),
                Title = "考试",
                Start = "19:30",
                End = "21:00"
            }
        ]);

        Assert.Equal(0, result.ChangedCount);
        Assert.Empty(result.NextSchedule.Blocks);
    }

    private static DaySchedule EmptySchedule(DateOnly date)
    {
        return new DaySchedule
        {
            Date = date,
            DayStart = "00:00",
            DayEnd = "24:00",
            DayStartMin = 0,
            DayEndMin = 24 * 60
        };
    }
}
