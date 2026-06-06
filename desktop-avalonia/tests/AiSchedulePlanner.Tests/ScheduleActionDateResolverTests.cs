using AiSchedulePlanner.Core;

namespace AiSchedulePlanner.Tests;

public sealed class ScheduleActionDateResolverTests
{
    [Fact]
    public void ResolveSingleExplicitTargetDate_returns_single_non_focus_date()
    {
        var target = ScheduleActionDateResolver.ResolveSingleExplicitTargetDate(
            new DateOnly(2026, 6, 1),
            [
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "考试" },
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "居酒屋" }
            ]);

        Assert.Equal(new DateOnly(2026, 6, 7), target);
    }

    [Fact]
    public void ResolveSingleExplicitTargetDate_ignores_current_focus_date()
    {
        var target = ScheduleActionDateResolver.ResolveSingleExplicitTargetDate(
            new DateOnly(2026, 6, 7),
            [
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "考试" }
            ]);

        Assert.Null(target);
    }

    [Fact]
    public void ResolveSingleExplicitTargetDate_does_not_guess_multiple_dates()
    {
        var target = ScheduleActionDateResolver.ResolveSingleExplicitTargetDate(
            new DateOnly(2026, 6, 1),
            [
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "考试" },
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 8), Title = "聚餐" }
            ]);

        Assert.Null(target);
    }

    [Fact]
    public void ResolveSingleExplicitTargetDate_inherits_later_undated_actions()
    {
        var target = ScheduleActionDateResolver.ResolveSingleExplicitTargetDate(
            new DateOnly(2026, 6, 1),
            [
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "考试" },
                new ScheduleAction { Type = "add_task_block", Title = "居酒屋" }
            ]);

        Assert.Equal(new DateOnly(2026, 6, 7), target);
    }

    [Fact]
    public void ResolveSingleExplicitTargetDate_keeps_earlier_undated_actions_on_focus_date()
    {
        var target = ScheduleActionDateResolver.ResolveSingleExplicitTargetDate(
            new DateOnly(2026, 6, 1),
            [
                new ScheduleAction { Type = "add_task_block", Title = "今天的事" },
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "考试" }
            ]);

        Assert.Null(target);
    }

    [Fact]
    public void GroupByTargetDate_uses_focus_date_for_actions_without_date()
    {
        var groups = ScheduleActionDateResolver.GroupByTargetDate(
            new DateOnly(2026, 6, 1),
            [
                new ScheduleAction { Type = "add_task_block", Title = "今天的事" },
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "周日的事" }
            ]);

        Assert.Equal([new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 7)], groups.Select(group => group.Date).ToArray());
        Assert.Equal("今天的事", groups[0].Actions.Single().Title);
        Assert.Equal("周日的事", groups[1].Actions.Single().Title);
    }

    [Fact]
    public void GroupByTargetDate_inherits_single_explicit_date_for_later_actions()
    {
        var groups = ScheduleActionDateResolver.GroupByTargetDate(
            new DateOnly(2026, 6, 1),
            [
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "考试" },
                new ScheduleAction { Type = "add_task_block", Title = "居酒屋" }
            ]);

        var group = Assert.Single(groups);
        Assert.Equal(new DateOnly(2026, 6, 7), group.Date);
        Assert.Equal(["考试", "居酒屋"], group.Actions.Select(action => action.Title).ToArray());
    }

    [Fact]
    public void ResolveSingleExplicitTargetDate_does_not_inherit_date_for_later_remove()
    {
        var target = ScheduleActionDateResolver.ResolveSingleExplicitTargetDate(
            new DateOnly(2026, 6, 1),
            [
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "考试" },
                new ScheduleAction { Type = "remove_block", MatchTitle = "复习" }
            ]);

        Assert.Null(target);
    }

    [Fact]
    public void GroupByTargetDate_keeps_later_undated_remove_on_focus_date()
    {
        var groups = ScheduleActionDateResolver.GroupByTargetDate(
            new DateOnly(2026, 6, 1),
            [
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "考试" },
                new ScheduleAction { Type = "remove_block", MatchTitle = "复习" }
            ]);

        Assert.Equal([new DateOnly(2026, 6, 7), new DateOnly(2026, 6, 1)], groups.Select(group => group.Date).ToArray());
        Assert.Equal("考试", groups[0].Actions.Single().Title);
        Assert.Equal("复习", groups[1].Actions.Single().MatchTitle);
    }

    [Fact]
    public void GroupByTargetDate_keeps_later_undated_move_on_focus_date()
    {
        var groups = ScheduleActionDateResolver.GroupByTargetDate(
            new DateOnly(2026, 6, 1),
            [
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "考试" },
                new ScheduleAction { Type = "move_block", MatchTitle = "复习", Start = "20:00" }
            ]);

        Assert.Equal([new DateOnly(2026, 6, 7), new DateOnly(2026, 6, 1)], groups.Select(group => group.Date).ToArray());
    }

    [Fact]
    public void GroupByTargetDate_preserves_first_seen_date_group_order()
    {
        var groups = ScheduleActionDateResolver.GroupByTargetDate(
            new DateOnly(2026, 6, 1),
            [
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 8), Title = "下周一" },
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 7), Title = "周日" },
                new ScheduleAction { Type = "add_task_block", Date = new DateOnly(2026, 6, 8), Title = "下周一第二件" }
            ]);

        Assert.Equal([new DateOnly(2026, 6, 8), new DateOnly(2026, 6, 7)], groups.Select(group => group.Date).ToArray());
        Assert.Equal(["下周一", "下周一第二件"], groups[0].Actions.Select(action => action.Title).ToArray());
    }
}
