using AiSchedulePlanner.Core;

namespace AiSchedulePlanner.Tests;

public sealed class TimeTextTests
{
    [Theory]
    [InlineData("八点20", 8, 20)]
    [InlineData("8：三十", 8, 30)]
    [InlineData("九点;40", 9, 40)]
    [InlineData("七点半", 7, 30)]
    [InlineData("晚上七点半", 19, 30)]
    [InlineData("下午3点一刻", 15, 15)]
    [InlineData("早上八点零五", 8, 5)]
    [InlineData("凌晨12点", 0, 0)]
    [InlineData("中午1点", 13, 0)]
    [InlineData("２３：４５", 23, 45)]
    public void ParseMinutes_accepts_casual_chinese_and_mixed_time_formats(string input, int hour, int minute)
    {
        Assert.Equal(hour * 60 + minute, TimeText.ParseMinutes(input));
    }

    [Theory]
    [InlineData("25:00")]
    [InlineData("九点六十")]
    [InlineData("明天晚上")]
    public void ParseMinutes_rejects_invalid_time_formats(string input)
    {
        Assert.Null(TimeText.ParseMinutes(input));
    }
}
