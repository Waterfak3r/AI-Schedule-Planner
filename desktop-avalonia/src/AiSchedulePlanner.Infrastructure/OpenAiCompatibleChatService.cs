using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AiSchedulePlanner.Core;

namespace AiSchedulePlanner.Infrastructure;

public sealed class OpenAiCompatibleChatService : IAiChatService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient;

    public OpenAiCompatibleChatService(HttpClient? httpClient = null)
    {
        _httpClient = httpClient ?? new HttpClient { Timeout = TimeSpan.FromSeconds(45) };
    }

    public async Task<AiChatResult> SendAsync(AiChatRequest request, CancellationToken cancellationToken = default)
    {
        var settings = request.Settings ?? new AiSettings();
        if (string.IsNullOrWhiteSpace(settings.ApiKey))
        {
            return new AiChatResult
            {
                Text = "请先在 AI 设置里配置 API Key。",
                Actions = []
            };
        }

        var url = BuildUrl(settings);
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        ApplyAuth(httpRequest, settings);

        var payload = new
        {
            model = string.IsNullOrWhiteSpace(settings.Model) ? "gpt-4.1-mini" : settings.Model.Trim(),
            messages = BuildMessages(request),
            temperature = 0.2
        };
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return new AiChatResult
            {
                Text = $"AI 请求失败：{(int)response.StatusCode} {Trim(raw, 180)}",
                Actions = []
            };
        }

        var content = ExtractAssistantContent(raw);
        var model = ExtractModel(raw);
        var parsed = ParseAssistantJson(content);
        parsed.Model = model;
        return parsed;
    }

    private static Uri BuildUrl(AiSettings settings)
    {
        var baseUrl = (settings.BaseUrl ?? "").Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl)) baseUrl = "https://api.openai.com/v1";
        var chatPath = (settings.ChatPath ?? "/chat/completions").Trim();
        if (!chatPath.StartsWith('/')) chatPath = $"/{chatPath}";
        return new Uri($"{baseUrl}{chatPath}");
    }

    private static void ApplyAuth(HttpRequestMessage request, AiSettings settings)
    {
        var header = string.IsNullOrWhiteSpace(settings.ApiKeyHeader) ? "Authorization" : settings.ApiKeyHeader.Trim();
        var prefix = settings.ApiKeyPrefix ?? "";
        var key = settings.ApiKey.Trim().Trim('"', '\'');
        var value = $"{prefix}{key}";

        if (header.Equals("Authorization", StringComparison.OrdinalIgnoreCase))
        {
            if (value.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", value[7..].Trim());
            }
            else
            {
                request.Headers.TryAddWithoutValidation(header, value);
            }
            return;
        }

        request.Headers.TryAddWithoutValidation(header, value);
    }

    private static List<object> BuildMessages(AiChatRequest request)
    {
        var messages = new List<object>
        {
            new
            {
                role = "system",
                content = BuildSystemPrompt(request)
            }
        };

        foreach (var message in request.Messages.TakeLast(18))
        {
            var role = message.Role == "assistant" ? "assistant" : "user";
            if (!string.IsNullOrWhiteSpace(message.Content))
            {
                messages.Add(new { role, content = message.Content.Trim() });
            }
        }

        return messages;
    }

    private static string BuildSystemPrompt(AiChatRequest request)
    {
        var blockLines = (request.CurrentSchedule?.Blocks ?? [])
            .Where(block => block.Type != ScheduleBlockType.Buffer)
            .Take(40)
            .Select(block => $"- {block.RuntimeId}: {block.Title} {block.Start}-{block.End} type={block.Type}");

        var ruleLines = request.PlannerState.Tasks
            .Select(task => $"- task {task.Title}, duration={task.DurationMin}, category={task.Category}")
            .Concat(request.PlannerState.FixedEvents.Select(item => $"- fixed {item.Title}, {item.Start}-{item.End}"));

        return string.Join("\n", new[]
        {
            "You are an AI schedule assistant. Reply to the user naturally, but also extract hidden schedule tool calls.",
            "Output JSON only, no markdown: {\"text\":\"user-facing reply\",\"actions\":[...]}",
            "Supported action types: add_task_block, move_block, remove_block.",
            "Each action may include date (yyyy-MM-dd), title, matchTitle, runtimeId, start, end, durationMinutes, category, timeConfidence, needsConfirmation, assumptions.",
            "If the user mentions a date, weekday, or relative date, resolve it against the focus date and include date on every related action.",
            "Use 24-hour HH:mm. Normalize casual Chinese and English time such as 七点半, 八点20, 8：三十, 九点;40, noon, 3pm.",
            "If start is clear but end/duration is missing, use durationMinutes=30, set timeConfidence=\"inferred_duration\", needsConfirmation=true, add an assumptions item, and say in text that the time span is uncertain and should be adjusted by the user.",
            "If a title already exists in current blocks, use move_block unless the user clearly asks to add another instance.",
            "For move_block/remove_block, include runtimeId when possible; if there are multiple possible matches and the user did not give enough detail, return actions: [] and ask a clarification in text.",
            "If the request is vague and unsafe to apply, return actions: [].",
            $"Focus date: {request.FocusDate:yyyy-MM-dd}",
            $"User style prompt for the text field only, never for JSON shape or actions: {request.Settings.StylePrompt}",
            "Current schedule blocks:",
            string.Join("\n", blockLines),
            "Known rules:",
            string.Join("\n", ruleLines)
        });
    }

    private static string ExtractAssistantContent(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
            {
                var choice = choices[0];
                if (choice.TryGetProperty("message", out var message) &&
                    message.TryGetProperty("content", out var content))
                {
                    return content.GetString() ?? "";
                }
            }
        }
        catch
        {
            return raw;
        }

        return raw;
    }

    private static string ExtractModel(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            return doc.RootElement.TryGetProperty("model", out var model) ? model.GetString() ?? "" : "";
        }
        catch
        {
            return "";
        }
    }

    private static AiChatResult ParseAssistantJson(string content)
    {
        var json = ExtractJsonObject(content);
        if (string.IsNullOrWhiteSpace(json))
        {
            return new AiChatResult { Text = string.IsNullOrWhiteSpace(content) ? "AI 没有返回内容。" : content.Trim() };
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var text = root.TryGetProperty("text", out var textElement) ? textElement.GetString() ?? "" : content.Trim();
            var actions = new List<ScheduleAction>();

            if (root.TryGetProperty("actions", out var actionArray) && actionArray.ValueKind == JsonValueKind.Array)
            {
                actions.AddRange(ReadActions(actionArray));
            }
            else if (root.TryGetProperty("toolCalls", out var toolArray) && toolArray.ValueKind == JsonValueKind.Array)
            {
                actions.AddRange(ReadToolCalls(toolArray));
            }

            return new AiChatResult
            {
                Text = string.IsNullOrWhiteSpace(text) ? "我整理好了可执行的日程建议。" : text.Trim(),
                Actions = actions
            };
        }
        catch
        {
            return new AiChatResult { Text = "AI 返回格式异常，请重新发送或换一种说法。", Actions = [] };
        }
    }

    private static IEnumerable<ScheduleAction> ReadActions(JsonElement actionArray)
    {
        foreach (var item in actionArray.EnumerateArray())
        {
            ScheduleAction? action;
            try
            {
                action = ReadAction(item);
            }
            catch
            {
                continue;
            }

            if (action is not null) yield return action;
        }
    }

    private static IEnumerable<ScheduleAction> ReadToolCalls(JsonElement toolArray)
    {
        foreach (var item in toolArray.EnumerateArray())
        {
            ScheduleAction? action;
            string tool;
            try
            {
                tool = GetString(item, "tool", "name", "type");
                var args = item.TryGetProperty("args", out var argsElement) ? argsElement :
                    item.TryGetProperty("arguments", out var argumentsElement) ? argumentsElement : item;
                action = ReadAction(args);
            }
            catch
            {
                continue;
            }

            if (action is null) continue;
            action.Type = string.IsNullOrWhiteSpace(action.Type) ? tool : action.Type;
            yield return action;
        }
    }

    private static ScheduleAction? ReadAction(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        var action = new ScheduleAction
        {
            Type = GetString(element, "type", "action", "tool"),
            Title = GetString(element, "title"),
            MatchTitle = GetString(element, "matchTitle", "match_title", "targetTitle"),
            RuntimeId = GetString(element, "runtimeId", "runtime_id", "blockId", "block_id"),
            Start = GetString(element, "start", "startTime", "start_time"),
            End = GetString(element, "end", "endTime", "end_time"),
            Category = GetString(element, "category"),
            TimeConfidence = GetString(element, "timeConfidence", "time_confidence"),
            Assumptions = GetStringArray(element, "assumptions", "assumption")
        };

        if (element.TryGetProperty("date", out var dateElement) &&
            DateOnly.TryParse(dateElement.GetString(), out var date))
        {
            action.Date = date;
        }

        if (TryGetInt(element, out var duration, "durationMinutes", "duration_minutes", "durationMin", "duration_min"))
        {
            action.DurationMinutes = duration;
        }

        if (TryGetBool(element, out var needsConfirmation, "needsConfirmation", "needs_confirmation"))
        {
            action.NeedsConfirmation = needsConfirmation;
        }

        return string.IsNullOrWhiteSpace(action.Type) ? null : action;
    }

    private static List<string> GetStringArray(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (!element.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null) continue;
            if (value.ValueKind == JsonValueKind.Array)
            {
                return value.EnumerateArray()
                    .Select(item => item.ToString().Trim())
                    .Where(text => !string.IsNullOrWhiteSpace(text))
                    .ToList();
            }

            var text = value.ToString().Trim();
            return string.IsNullOrWhiteSpace(text) ? [] : [text];
        }

        return [];
    }

    private static string GetString(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (element.TryGetProperty(name, out var value) && value.ValueKind != JsonValueKind.Null)
            {
                return value.ToString().Trim();
            }
        }

        return "";
    }

    private static bool TryGetInt(JsonElement element, out int value, params string[] names)
    {
        foreach (var name in names)
        {
            if (!element.TryGetProperty(name, out var item)) continue;
            if (item.ValueKind == JsonValueKind.Number && item.TryGetInt32(out value)) return true;
            if (int.TryParse(item.ToString(), out value)) return true;
        }

        value = 0;
        return false;
    }

    private static bool TryGetBool(JsonElement element, out bool value, params string[] names)
    {
        foreach (var name in names)
        {
            if (!element.TryGetProperty(name, out var item)) continue;
            if (item.ValueKind == JsonValueKind.True)
            {
                value = true;
                return true;
            }

            if (item.ValueKind == JsonValueKind.False)
            {
                value = false;
                return true;
            }

            if (bool.TryParse(item.ToString(), out value)) return true;
        }

        value = false;
        return false;
    }

    private static string ExtractJsonObject(string content)
    {
        var text = content.Trim();
        var first = text.IndexOf('{');
        if (first < 0) return "";

        var depth = 0;
        var inString = false;
        var escaped = false;
        for (var i = first; i < text.Length; i++)
        {
            var current = text[i];
            if (escaped)
            {
                escaped = false;
                continue;
            }

            if (current == '\\' && inString)
            {
                escaped = true;
                continue;
            }

            if (current == '"')
            {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (current == '{')
            {
                depth += 1;
            }
            else if (current == '}')
            {
                depth -= 1;
                if (depth == 0)
                {
                    return text[first..(i + 1)];
                }
            }
        }

        return LooksLikeProtocolText(text) ? "{malformed" : "";
    }

    private static bool LooksLikeProtocolText(string text)
    {
        return text.TrimStart().StartsWith('{') ||
            text.Contains("\"actions\"", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("\"toolCalls\"", StringComparison.OrdinalIgnoreCase);
    }

    private static string Trim(string value, int max)
    {
        var text = (value ?? "").Trim();
        return text.Length <= max ? text : $"{text[..max]}...";
    }
}
