using AiSchedulePlanner.Core;

namespace AiSchedulePlanner.Tests;

public sealed class ScheduleEngineTests
{
    [Fact]
    public void BuildDay_places_tasks_around_fixed_events_and_buffers()
    {
        var engine = new ScheduleEngine();
        var monday = new DateOnly(2026, 6, 1);

        var schedule = engine.BuildDay(new ScheduleBuildRequest
        {
            Date = monday,
            ActiveStart = "08:00",
            ActiveEnd = "12:00",
            FixedEvents =
            [
                new FixedEventRule
                {
                    Id = "course",
                    Title = "课程",
                    Start = "09:00",
                    End = "10:00",
                    BufferMin = 15,
                    DaysOfWeek = [1]
                }
            ],
            Tasks =
            [
                new TaskRule
                {
                    Id = "code",
                    Title = "写代码",
                    DurationMin = 30,
                    Priority = 5,
                    DaysOfWeek = [1]
                }
            ]
        });

        var task = Assert.Single(schedule.Blocks.Where(block => block.Type == ScheduleBlockType.Task));
        Assert.Equal("08:00", task.Start);
        Assert.Equal("08:30", task.End);
        Assert.Contains(schedule.Blocks, block => block.Type == ScheduleBlockType.Buffer);
        Assert.Empty(schedule.Unscheduled);
    }

    [Fact]
    public void BuildWeek_assigns_weekly_target_tasks_to_multiple_days()
    {
        var engine = new ScheduleEngine();

        var week = engine.BuildWeek(new ScheduleBuildRequest
        {
            Date = new DateOnly(2026, 6, 3),
            ActiveStart = "08:00",
            ActiveEnd = "20:00",
            Tasks =
            [
                new TaskRule
                {
                    Id = "code",
                    Title = "写代码",
                    Category = "code",
                    DurationMin = 60,
                    WeeklyTargetCount = 3,
                    Priority = 5
                }
            ]
        });

        Assert.Equal(new DateOnly(2026, 6, 1), week.StartDate);
        Assert.Equal(3, week.Days.Count(day => day.Schedule.Blocks.Any(block => block.Title == "写代码")));
    }

    [Fact]
    public void BuildDay_reports_fixed_conflicts()
    {
        var engine = new ScheduleEngine();

        var schedule = engine.BuildDay(new ScheduleBuildRequest
        {
            Date = new DateOnly(2026, 6, 1),
            FixedEvents =
            [
                new FixedEventRule { Id = "a", Title = "A", Start = "09:00", End = "10:00", DaysOfWeek = [1] },
                new FixedEventRule { Id = "b", Title = "B", Start = "09:30", End = "10:30", DaysOfWeek = [1] }
            ]
        });

        Assert.Contains(schedule.Issues, issue => issue.Level == ScheduleIssueLevel.Error && issue.Code == "fixed_conflict");
    }
}
