using System.Globalization;

namespace AiSchedulePlanner.Core;

public static class TimeText
{
    public const int FullDayStartMin = 0;
    public const int FullDayEndMin = 24 * 60;
    public const string FullDayStart = "00:00";
    public const string FullDayEnd = "24:00";

    public static int? ParseMinutes(string? value)
    {
        var text = (value ?? string.Empty).Trim();
        if (text.Length == 0) return null;

        text = text
            .Replace('：', ':')
            .Replace('；', ':')
            .Replace(';', ':');

        if (text.Equals("noon", StringComparison.OrdinalIgnoreCase)) return 12 * 60;
        if (text.Equals("midnight", StringComparison.OrdinalIgnoreCase)) return 0;

        var isPm = text.EndsWith("pm", StringComparison.OrdinalIgnoreCase);
        var isAm = text.EndsWith("am", StringComparison.OrdinalIgnoreCase);
        if (isPm || isAm) text = text[..^2].Trim();

        var parts = text.Split(':', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length is < 1 or > 2) return null;
        if (!int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var hour)) return null;
        var minute = 0;
        if (parts.Length == 2 && !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out minute)) return null;

        if (isPm && hour < 12) hour += 12;
        if (isAm && hour == 12) hour = 0;

        if (hour == 24 && minute == 0) return FullDayEndMin;
        if (hour is < 0 or > 23 || minute is < 0 or > 59) return null;
        return hour * 60 + minute;
    }

    public static string ToTime(int minutes)
    {
        minutes = Math.Clamp(minutes, FullDayStartMin, FullDayEndMin);
        if (minutes == FullDayEndMin) return FullDayEnd;
        return $"{minutes / 60:00}:{minutes % 60:00}";
    }

    public static DateOnly MondayOfWeek(DateOnly date)
    {
        var diff = date.DayOfWeek == DayOfWeek.Sunday ? 6 : (int)date.DayOfWeek - 1;
        return date.AddDays(-diff);
    }

    public static int WeekdayNumber(DateOnly date)
    {
        return date.DayOfWeek == DayOfWeek.Sunday ? 0 : (int)date.DayOfWeek;
    }
}
