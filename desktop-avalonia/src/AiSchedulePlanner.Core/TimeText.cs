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

        text = NormalizeFullWidthDigits(text)
            .Replace('：', ':')
            .Replace('；', ':')
            .Replace(';', ':')
            .Replace("点钟", ":", StringComparison.OrdinalIgnoreCase)
            .Replace('点', ':')
            .Replace('时', ':')
            .Replace("分钟", "", StringComparison.OrdinalIgnoreCase)
            .Replace('分', ' ')
            .Replace(" ", "");

        if (text.Equals("noon", StringComparison.OrdinalIgnoreCase)) return 12 * 60;
        if (text.Equals("midnight", StringComparison.OrdinalIgnoreCase)) return 0;

        var isPm = text.EndsWith("pm", StringComparison.OrdinalIgnoreCase);
        var isAm = text.EndsWith("am", StringComparison.OrdinalIgnoreCase);
        if (isPm || isAm) text = text[..^2].Trim();
        var isNoon = ContainsAny(text, "中午", "午间");
        isPm = isPm || ContainsAny(text, "下午", "晚上", "夜里", "晚间", "傍晚");
        isAm = isAm || ContainsAny(text, "上午", "早上", "早晨", "清晨", "凌晨");
        text = RemoveTokens(text, "上午", "早上", "早晨", "清晨", "凌晨", "中午", "午间", "下午", "晚上", "夜里", "晚间", "傍晚");

        var parts = text.Split(':', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length is < 1 or > 2) return null;
        if (!TryParseTimeNumber(parts[0], out var hour)) return null;
        var minute = 0;
        if (parts.Length == 2 && !TryParseMinute(parts[1], out minute)) return null;

        if (isNoon && hour is >= 1 and <= 6) hour += 12;
        if (isPm && hour < 12) hour += 12;
        if (isAm && hour == 12) hour = 0;

        if (hour == 24 && minute == 0) return FullDayEndMin;
        if (hour is < 0 or > 23 || minute is < 0 or > 59) return null;
        return hour * 60 + minute;
    }

    private static string NormalizeFullWidthDigits(string text)
    {
        return new string(text.Select(ch => ch is >= '０' and <= '９' ? (char)('0' + ch - '０') : ch).ToArray());
    }

    private static bool ContainsAny(string text, params string[] tokens)
    {
        return tokens.Any(token => text.Contains(token, StringComparison.OrdinalIgnoreCase));
    }

    private static string RemoveTokens(string text, params string[] tokens)
    {
        foreach (var token in tokens)
        {
            text = text.Replace(token, "", StringComparison.OrdinalIgnoreCase);
        }

        return text;
    }

    private static bool TryParseMinute(string text, out int minute)
    {
        text = text.Trim();
        if (text == "半")
        {
            minute = 30;
            return true;
        }

        if (text is "一刻")
        {
            minute = 15;
            return true;
        }

        if (text is "三刻")
        {
            minute = 45;
            return true;
        }

        return TryParseTimeNumber(text, out minute);
    }

    private static bool TryParseTimeNumber(string text, out int value)
    {
        text = text.Trim();
        if (int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out value)) return true;

        return TryParseChineseNumber(text, out value);
    }

    private static bool TryParseChineseNumber(string text, out int value)
    {
        text = text.Trim();
        if (text.Length == 0)
        {
            value = 0;
            return false;
        }

        if (text.Contains('十'))
        {
            var parts = text.Split('十');
            if (parts.Length != 2)
            {
                value = 0;
                return false;
            }

            var tens = parts[0].Length == 0 ? 1 : ChineseDigit(parts[0]);
            var ones = parts[1].Length == 0 ? 0 : ChineseDigit(parts[1]);
            if (tens is null || ones is null)
            {
                value = 0;
                return false;
            }

            value = tens.Value * 10 + ones.Value;
            return true;
        }

        var result = 0;
        foreach (var ch in text)
        {
            var digit = ChineseDigit(ch.ToString());
            if (digit is null)
            {
                value = 0;
                return false;
            }

            result = result * 10 + digit.Value;
        }

        value = result;
        return true;
    }

    private static int? ChineseDigit(string text)
    {
        return text switch
        {
            "零" or "〇" or "○" => 0,
            "一" => 1,
            "二" or "两" => 2,
            "三" => 3,
            "四" => 4,
            "五" => 5,
            "六" => 6,
            "七" => 7,
            "八" => 8,
            "九" => 9,
            _ => null
        };
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
