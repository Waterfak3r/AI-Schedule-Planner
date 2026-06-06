namespace AiSchedulePlanner.Core;

public static class ScheduleActionDateResolver
{
    public static DateOnly? ResolveSingleExplicitTargetDate(DateOnly focusDate, IEnumerable<ScheduleAction> actions)
    {
        var actionList = actions.ToList();
        if (actionList.Count == 0) return null;

        var (targetDate, firstExplicitIndex) = ResolveUniqueExplicitDate(actionList);

        if (targetDate is null || targetDate.Value == focusDate) return null;

        return actionList.Select((action, index) => new { action, index }).All(item =>
            item.action.Date == targetDate ||
            (item.action.Date is null && item.index > firstExplicitIndex && CanInheritPreviousDate(item.action)))
            ? targetDate.Value
            : null;
    }

    public static List<ScheduleActionDateGroup> GroupByTargetDate(DateOnly focusDate, IEnumerable<ScheduleAction> actions)
    {
        var actionList = actions.ToList();
        var (inheritedDate, firstExplicitIndex) = ResolveUniqueExplicitDate(actionList);

        return actionList
            .Select((action, index) => new
            {
                Action = action,
                Index = index,
                Date = action.Date ?? (inheritedDate is not null && index > firstExplicitIndex && CanInheritPreviousDate(action) ? inheritedDate.Value : focusDate)
            })
            .GroupBy(item => item.Date)
            .OrderBy(group => group.Min(item => item.Index))
            .Select(group => new ScheduleActionDateGroup(
                group.Key,
                group.OrderBy(item => item.Index).Select(item => item.Action).ToList()))
            .ToList();
    }

    private static (DateOnly? Date, int FirstIndex) ResolveUniqueExplicitDate(IReadOnlyList<ScheduleAction> actions)
    {
        var explicitDates = actions
            .Where(action => action.Date is not null)
            .Select(action => action.Date!.Value)
            .Distinct()
            .ToList();

        if (explicitDates.Count != 1) return (null, -1);

        var targetDate = explicitDates[0];
        var firstIndex = actions
            .Select((action, index) => new { action, index })
            .First(item => item.action.Date == targetDate)
            .index;
        return (targetDate, firstIndex);
    }

    private static bool CanInheritPreviousDate(ScheduleAction action)
    {
        return NormalizeActionType(action.Type) is "add_task_block" or "schedule.add_block";
    }

    private static string NormalizeActionType(string value)
    {
        return (value ?? string.Empty).Trim().ToLowerInvariant().Replace('-', '_');
    }
}

public sealed record ScheduleActionDateGroup(DateOnly Date, List<ScheduleAction> Actions);
