using System.Net;
using System.Text;
using System.Text.Json;
using AiSchedulePlanner.Core;
using AiSchedulePlanner.Infrastructure;

namespace AiSchedulePlanner.Tests;

public sealed class OpenAiCompatibleChatServiceTests
{
    [Fact]
    public async Task SendAsync_plain_chat_reply_returns_no_actions_and_does_not_modify_schedule()
    {
        var service = ServiceReturning("可以，我们先聊一下你的复习思路。");

        var result = await service.SendAsync(Request());
        var schedule = ScheduleWithBlock(new DateOnly(2026, 6, 7));
        var apply = new ScheduleActionService().Apply(schedule, result.Actions);

        Assert.Equal("可以，我们先聊一下你的复习思路。", result.Text);
        Assert.Empty(result.Actions);
        Assert.Equal(0, apply.ChangedCount);
        Assert.Equal("复习数学", Assert.Single(apply.NextSchedule.Blocks).Title);
    }

    [Fact]
    public async Task SendAsync_malformed_protocol_json_returns_safe_message()
    {
        var service = ServiceReturning("""{"text":"安排好了","actions":[{"type":"add_task_block"}""");

        var result = await service.SendAsync(Request());

        Assert.Empty(result.Actions);
        Assert.Contains("格式异常", result.Text);
        Assert.DoesNotContain("actions", result.Text);
        Assert.DoesNotContain("add_task_block", result.Text);
    }

    [Fact]
    public async Task SendAsync_multiple_json_objects_uses_first_balanced_object()
    {
        var service = ServiceReturning("""{"text":"第一条","actions":[]} {"text":"第二条","actions":[{"type":"add_task_block","title":"考试","start":"19:30"}]}""");

        var result = await service.SendAsync(Request());

        Assert.Equal("第一条", result.Text);
        Assert.Empty(result.Actions);
    }

    [Fact]
    public async Task SendAsync_one_bad_action_does_not_drop_valid_action()
    {
        var service = ServiceReturning("""{"text":"已整理","actions":["bad",{"type":"add_task_block","title":"考试","start":"19:30"}]}""");

        var result = await service.SendAsync(Request());

        var action = Assert.Single(result.Actions);
        Assert.Equal("add_task_block", action.Type);
        Assert.Equal("考试", action.Title);
        Assert.Equal("19:30", action.Start);
    }

    [Fact]
    public async Task SendAsync_reads_uncertain_time_fields()
    {
        var service = ServiceReturning("""{"text":"暂按30分钟","actions":[{"type":"add_task_block","title":"居酒屋","start":"21:00","durationMinutes":30,"timeConfidence":"inferred_duration","needsConfirmation":true,"assumptions":["时长未明确"]}]}""");

        var result = await service.SendAsync(Request());

        var action = Assert.Single(result.Actions);
        Assert.Equal("inferred_duration", action.TimeConfidence);
        Assert.True(action.NeedsConfirmation);
        Assert.Equal(["时长未明确"], action.Assumptions);
    }

    [Fact]
    public async Task SendAsync_non_schedule_tool_call_returns_no_actions()
    {
        var service = ServiceReturning("""{"text":"我可以继续和你聊这个话题。","toolCalls":[{"tool":"chat.reply","args":{"text":"闲聊"}}]}""");

        var result = await service.SendAsync(Request());

        Assert.Equal("我可以继续和你聊这个话题。", result.Text);
        Assert.Empty(result.Actions);
    }

    [Fact]
    public async Task SendAsync_schedule_tool_call_uses_wrapper_tool_name()
    {
        var service = ServiceReturning("""{"text":"已提取。","toolCalls":[{"tool":"add_task_block","args":{"title":"考试","start":"19:30","durationMinutes":90}}]}""");

        var result = await service.SendAsync(Request());

        var action = Assert.Single(result.Actions);
        Assert.Equal("add_task_block", action.Type);
        Assert.Equal("考试", action.Title);
        Assert.Equal("19:30", action.Start);
        Assert.Equal(90, action.DurationMinutes);
    }

    [Fact]
    public async Task SendAsync_schedule_tool_call_reads_string_arguments()
    {
        var service = ServiceReturning("""{"text":"已提取。","toolCalls":[{"type":"function","function":{"name":"schedule.add_block","arguments":"{\"title\":\"考试\",\"start\":\"19:30\",\"durationMinutes\":90}"}}]}""");

        var result = await service.SendAsync(Request());

        var action = Assert.Single(result.Actions);
        Assert.Equal("schedule.add_block", action.Type);
        Assert.Equal("考试", action.Title);
        Assert.Equal("19:30", action.Start);
        Assert.Equal(90, action.DurationMinutes);
    }

    [Fact]
    public async Task SendAsync_parsed_uncertainty_fields_surface_preview_warnings()
    {
        var service = ServiceReturning("""{"text":"暂按30分钟","actions":[{"type":"add_task_block","title":"居酒屋","start":"21:00","durationMinutes":30,"timeConfidence":"inferred_duration","needsConfirmation":true,"assumptions":["时长未明确"]}]}""");

        var result = await service.SendAsync(Request());
        var preview = new ScheduleActionService().Preview(EmptySchedule(new DateOnly(2026, 6, 7)), result.Actions);

        var actionResult = Assert.Single(preview.Results);
        Assert.Equal("applied", actionResult.Status);
        Assert.Contains(actionResult.Warnings, warning => warning.Contains("需要确认"));
        Assert.Contains(actionResult.Warnings, warning => warning.Contains("推断结果"));
        Assert.Contains(actionResult.Warnings, warning => warning.Contains("时长未明确"));
    }

    private static OpenAiCompatibleChatService ServiceReturning(string assistantContent)
    {
        return new OpenAiCompatibleChatService(new HttpClient(new StubHandler(ChatResponse(assistantContent))));
    }

    private static AiChatRequest Request()
    {
        return new AiChatRequest
        {
            Settings = new AiSettings
            {
                ApiKey = "unit-test-key",
                BaseUrl = "https://unit.test/v1",
                ChatPath = "/chat/completions"
            }
        };
    }

    private static string ChatResponse(string assistantContent)
    {
        return JsonSerializer.Serialize(new
        {
            model = "unit-test-model",
            choices = new[]
            {
                new
                {
                    message = new
                    {
                        content = assistantContent
                    }
                }
            }
        });
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

    private static DaySchedule ScheduleWithBlock(DateOnly date)
    {
        var schedule = EmptySchedule(date);
        schedule.Blocks.Add(new ScheduleBlock
        {
            RuntimeId = "math_1",
            Title = "复习数学",
            Type = ScheduleBlockType.Task,
            StartMin = 19 * 60,
            EndMin = 20 * 60,
            Editable = true
        });
        return schedule;
    }

    private sealed class StubHandler(string content, HttpStatusCode statusCode = HttpStatusCode.OK) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(content, Encoding.UTF8, "application/json")
            };
            return Task.FromResult(response);
        }
    }
}
