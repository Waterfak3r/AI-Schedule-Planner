namespace AiSchedulePlanner.Core;

public static class ScheduleActionDateResolver
{
    public static DateOnly? ResolveSingleExplicitTargetDate(DateOnly focusDate, IEnumerable<ScheduleAction> actions)
    {
        var actionList = actions.ToList();
        if (actionList.Count == 0) return null;

        var explicitDates = actionList
            .Where(action => action.Date is not null)
            .Select(action => action.Date!.Value)
            .Distinct()
            .ToList();

        if (explicitDates.Count != 1) return null;

        var targetDate = explicitDates[0];
        if (targetDate == focusDate) return null;

        return actionList.All(action => action.Date == targetDate) ? targetDate : null;
    }

    public static List<ScheduleActionDateGroup> GroupByTargetDate(DateOnly focusDate, IEnumerable<ScheduleAction> actions)
    {
        return actions
            .Select((action, index) => new { Action = action, Index = index, Date = action.Date ?? focusDate })
            .GroupBy(item => item.Date)
            .OrderBy(group => group.Min(item => item.Index))
            .Select(group => new ScheduleActionDateGroup(
                group.Key,
                group.OrderBy(item => item.Index).Select(item => item.Action).ToList()))
            .ToList();
    }
}

public sealed record ScheduleActionDateGroup(DateOnly Date, List<ScheduleAction> Actions);
