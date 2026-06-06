using System.Net;
using System.Text;
using System.Text.Json;
using AiSchedulePlanner.Core;
using AiSchedulePlanner.Infrastructure;

namespace AiSchedulePlanner.Tests;

public sealed class OpenAiCompatibleChatServiceTests
{
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
