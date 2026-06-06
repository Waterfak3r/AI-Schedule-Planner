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
        var actionResult = Assert.Single(result.Results);
        Assert.Contains("时长未明确", actionResult.Message);
        Assert.Contains(actionResult.Warnings, warning => warning.Contains("暂按 30 分钟"));
    }

    [Fact]
    public void Preview_start_only_add_surfaces_inferred_duration_warning()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 7));

        var preview = service.Preview(schedule, [
            new ScheduleAction
            {
                Type = "add_task_block",
                Title = "居酒屋",
                Start = "21:00"
            }
        ]);

        var result = Assert.Single(preview.Results);
        Assert.Equal("applied", result.Status);
        Assert.Contains("时长未明确", result.Message);
        Assert.Contains(result.Warnings, warning => warning.Contains("暂按 30 分钟"));
        Assert.Empty(schedule.Blocks);
    }

    [Fact]
    public void Apply_add_with_explicit_duration_does_not_warn()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 7));

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "add_task_block",
                Title = "居酒屋",
                Start = "21:00",
                DurationMinutes = 45,
                TimeConfidence = "exact"
            }
        ]);

        var block = Assert.Single(result.NextSchedule.Blocks);
        Assert.Equal("21:45", block.End);
        var actionResult = Assert.Single(result.Results);
        Assert.DoesNotContain("时长未明确", actionResult.Message);
        Assert.Empty(actionResult.Warnings);
    }

    [Fact]
    public void Preview_add_with_complete_range_surfaces_model_uncertainty_warnings()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 7));

        var preview = service.Preview(schedule, [
            new ScheduleAction
            {
                Type = "add_task_block",
                Title = "复习",
                Start = "20:00",
                End = "21:00",
                TimeConfidence = "inferred",
                NeedsConfirmation = true,
                Assumptions = ["用户没有明确是否需要一小时"]
            }
        ]);

        var result = Assert.Single(preview.Results);
        Assert.Equal("applied", result.Status);
        Assert.Contains(result.Warnings, warning => warning.Contains("需要确认"));
        Assert.Contains(result.Warnings, warning => warning.Contains("inferred"));
        Assert.Contains(result.Warnings, warning => warning.Contains("用户没有明确是否需要一小时"));
        Assert.Empty(schedule.Blocks);
    }

    [Fact]
    public void Apply_add_accepts_casual_chinese_start_time()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 7));

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "add_task_block",
                Title = "考试",
                Start = "晚上七点半",
                End = "晚上九点;40"
            }
        ]);

        Assert.Equal(1, result.ChangedCount);
        var block = Assert.Single(result.NextSchedule.Blocks);
        Assert.Equal("19:30", block.Start);
        Assert.Equal("21:40", block.End);
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
    public void Apply_move_with_complete_range_surfaces_assumption_warning()
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
                End = "21:00",
                Assumptions = ["根据标题匹配到唯一日程"]
            }
        ]);

        var actionResult = Assert.Single(result.Results);
        Assert.Equal("applied", actionResult.Status);
        Assert.Contains(actionResult.Warnings, warning => warning.Contains("根据标题匹配到唯一日程"));
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
    public void Apply_remove_surfaces_needs_confirmation_warning()
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
                RuntimeId = "bar_1",
                NeedsConfirmation = true
            }
        ]);

        var actionResult = Assert.Single(result.Results);
        Assert.Equal("applied", actionResult.Status);
        Assert.Contains(actionResult.Warnings, warning => warning.Contains("需要确认"));
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
    public void Preview_simulates_actions_in_order()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));

        var preview = service.Preview(schedule, [
            new ScheduleAction
            {
                Type = "add_task_block",
                Title = "写代码",
                Start = "09:00",
                End = "10:00"
            },
            new ScheduleAction
            {
                Type = "add_task_block",
                Title = "复习数学",
                Start = "09:30",
                End = "10:30"
            }
        ]);

        Assert.Equal(["applied", "conflict"], preview.Results.Select(result => result.Status).ToArray());
        Assert.Empty(schedule.Blocks);
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

    [Fact]
    public void Apply_removes_duplicate_title_by_start_time()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "review_1",
            Title = "复习",
            Type = ScheduleBlockType.Task,
            StartMin = 19 * 60,
            EndMin = 20 * 60,
            Editable = true
        });
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "review_2",
            Title = "复习",
            Type = ScheduleBlockType.Task,
            StartMin = 20 * 60,
            EndMin = 21 * 60,
            Editable = true
        });

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "remove_block",
                MatchTitle = "复习",
                Start = "20:00"
            }
        ]);

        Assert.Equal(1, result.ChangedCount);
        var remaining = Assert.Single(result.NextSchedule.Blocks);
        Assert.Equal("review_1", remaining.RuntimeId);
        Assert.Equal("review_2", result.Results.Single().RemovedBlock?.RuntimeId);
    }

    [Fact]
    public void Apply_remove_duplicate_title_without_time_skips_instead_of_deleting_first()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "review_1",
            Title = "复习",
            Type = ScheduleBlockType.Task,
            StartMin = 19 * 60,
            EndMin = 20 * 60,
            Editable = true
        });
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "review_2",
            Title = "复习",
            Type = ScheduleBlockType.Task,
            StartMin = 20 * 60,
            EndMin = 21 * 60,
            Editable = true
        });

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "remove_block",
                MatchTitle = "复习"
            }
        ]);

        Assert.Equal(0, result.ChangedCount);
        Assert.Equal(2, result.NextSchedule.Blocks.Count);
        var actionResult = Assert.Single(result.Results);
        Assert.Equal("skipped", actionResult.Status);
        Assert.Contains("找到多个可能要删除的日程", actionResult.Message);
    }

    [Fact]
    public void Apply_move_duplicate_title_without_time_skips_instead_of_moving_first()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "review_1",
            Title = "复习",
            Type = ScheduleBlockType.Task,
            StartMin = 19 * 60,
            EndMin = 20 * 60,
            Editable = true
        });
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "review_2",
            Title = "复习",
            Type = ScheduleBlockType.Task,
            StartMin = 20 * 60,
            EndMin = 21 * 60,
            Editable = true
        });

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "move_block",
                MatchTitle = "复习",
                Start = "22:00"
            }
        ]);

        Assert.Equal(0, result.ChangedCount);
        Assert.Equal(["19:00", "20:00"], result.NextSchedule.Blocks.OrderBy(block => block.StartMin).Select(block => block.Start).ToArray());
        var actionResult = Assert.Single(result.Results);
        Assert.Equal("skipped", actionResult.Status);
        Assert.Contains("找到多个可能要调整的日程", actionResult.Message);
    }

    [Fact]
    public void Apply_remove_partial_title_matching_multiple_blocks_skips()
    {
        var service = new ScheduleActionService();
        var schedule = EmptySchedule(new DateOnly(2026, 6, 1));
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "exam_1",
            Title = "考试复习",
            Type = ScheduleBlockType.Task,
            StartMin = 18 * 60,
            EndMin = 19 * 60,
            Editable = true
        });
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "exam_2",
            Title = "教一601考试",
            Type = ScheduleBlockType.Task,
            StartMin = 19 * 60 + 30,
            EndMin = 21 * 60,
            Editable = true
        });

        var result = service.Apply(schedule, [
            new ScheduleAction
            {
                Type = "remove_block",
                MatchTitle = "考试"
            }
        ]);

        Assert.Equal(0, result.ChangedCount);
        Assert.Equal(2, result.NextSchedule.Blocks.Count);
        Assert.Contains("找到多个可能要删除的日程", Assert.Single(result.Results).Message);
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
