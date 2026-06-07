using AiSchedulePlanner.Core;
using AiSchedulePlanner.Infrastructure;

namespace AiSchedulePlanner.Tests;

public sealed class JsonPlannerStoreTests
{
    [Fact]
    public async Task Store_roundtrips_state_and_ai_settings_in_data_directory()
    {
        var dir = Path.Combine(Path.GetTempPath(), $"asp-avalonia-test-{Guid.NewGuid():N}");
        var store = new JsonPlannerStore(dir);
        try
        {
            var state = PlannerDefaults.Create();
            state.Preferences.WakeTime = "08:15";
            state.Preferences.Bedtime = "23:00";
            state.Preferences.StartupPage = "Schedule";
            state.Preferences.ScheduleView = "Month";
            state.Preferences.SidebarCollapsed = true;
            state.Preferences.SchedulePanelCollapsed = true;
            state.Tasks.Add(new TaskRule { Id = "task_extra", Title = "额外任务", DurationMin = 25, DaysOfWeek = [1] });
            state.Completed["manual_bar"] = true;
            state.DayOverrides["2026-06-07"] = new DaySchedule
            {
                Date = new DateOnly(2026, 6, 7),
                Blocks =
                [
                    new ScheduleBlock
                    {
                        RuntimeId = "manual_bar",
                        Title = "居酒屋",
                        Type = ScheduleBlockType.Task,
                        StartMin = 21 * 60,
                        EndMin = 21 * 60 + 30
                    }
                ]
            };
            await store.SaveStateAsync(state);

            await store.SaveAiSettingsAsync(new AiSettings
            {
                BaseUrl = "https://example.test/v1",
                Model = "test-model",
                ApiKey = "test-key"
            });

            var loadedState = await store.LoadStateAsync();
            var loadedSettings = await store.LoadAiSettingsAsync();

            Assert.Equal("08:15", loadedState.Preferences.WakeTime);
            Assert.Equal("23:00", loadedState.Preferences.Bedtime);
            Assert.Equal("Schedule", loadedState.Preferences.StartupPage);
            Assert.Equal("Month", loadedState.Preferences.ScheduleView);
            Assert.True(loadedState.Preferences.SidebarCollapsed);
            Assert.True(loadedState.Preferences.SchedulePanelCollapsed);
            Assert.Contains(loadedState.Tasks, task => task.Id == "task_extra");
            Assert.True(loadedState.Completed["manual_bar"]);
            Assert.True(loadedState.DayOverrides.ContainsKey("2026-06-07"));
            Assert.Equal("居酒屋", loadedState.DayOverrides["2026-06-07"].Blocks.Single().Title);
            Assert.Equal("https://example.test/v1", loadedSettings.BaseUrl);
            Assert.Equal("test-key", loadedSettings.ApiKey);
            Assert.True(File.Exists(Path.Combine(dir, "planner-state.v1.json")));
            Assert.True(File.Exists(Path.Combine(dir, "ai-settings.local.json")));
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public async Task LoadState_normalizes_legacy_or_incomplete_state()
    {
        var dir = Path.Combine(Path.GetTempPath(), $"asp-avalonia-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(dir);
        try
        {
            await File.WriteAllTextAsync(Path.Combine(dir, "planner-state.v1.json"), """
                {
                  "preferences": null,
                  "fixedEvents": [
                    {
                      "id": "",
                      "title": "课程",
                      "start": "09:00",
                      "end": "10:00",
                      "daysOfWeek": null,
                      "assignedDates": null
                    }
                  ],
                  "tasks": [
                    {
                      "id": "",
                      "title": "复习",
                      "durationMin": 0,
                      "priority": 0,
                      "daysOfWeek": null
                    }
                  ],
                  "completed": null,
                  "dayOverrides": null,
                  "communityPosts": null
                }
                """);

            var store = new JsonPlannerStore(dir);
            var state = await store.LoadStateAsync();

            Assert.NotNull(state.Preferences);
            Assert.Equal("Week", state.Preferences.ScheduleView);
            Assert.False(state.Preferences.SidebarCollapsed);
            Assert.False(state.Preferences.SchedulePanelCollapsed);
            Assert.NotNull(state.Completed);
            Assert.NotNull(state.DayOverrides);
            Assert.NotNull(state.CommunityPosts);
            var fixedEvent = Assert.Single(state.FixedEvents);
            Assert.StartsWith("fixed_", fixedEvent.Id);
            Assert.Empty(fixedEvent.DaysOfWeek);
            Assert.Empty(fixedEvent.AssignedDates);
            var task = Assert.Single(state.Tasks);
            Assert.StartsWith("task_", task.Id);
            Assert.Equal(30, task.DurationMin);
            Assert.Equal(3, task.Priority);
            Assert.Empty(task.DaysOfWeek);
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public async Task Store_handles_parallel_saves_without_temp_file_collisions()
    {
        var dir = Path.Combine(Path.GetTempPath(), $"asp-avalonia-test-{Guid.NewGuid():N}");
        var store = new JsonPlannerStore(dir);
        try
        {
            var states = Enumerable.Range(0, 12)
                .Select(index =>
                {
                    var state = PlannerDefaults.Create();
                    state.Preferences.WakeTime = $"08:{index:00}";
                    state.Completed[$"task_{index}"] = true;
                    state.Tasks.Add(new TaskRule
                    {
                        Id = $"task_{index}",
                        Title = $"任务 {index}",
                        DurationMin = 20 + index,
                        DaysOfWeek = [1, 3, 5]
                    });
                    return state;
                })
                .ToList();

            var settings = Enumerable.Range(0, 12)
                .Select(index => new AiSettings
                {
                    BaseUrl = $"https://example{index}.test/v1",
                    Model = $"model-{index}",
                    ApiKey = $"key-{index}"
                })
                .ToList();

            await Task.WhenAll(states.Select(state => store.SaveStateAsync(state))
                .Concat(settings.Select(setting => store.SaveAiSettingsAsync(setting))));

            var loadedState = await store.LoadStateAsync();
            var loadedSettings = await store.LoadAiSettingsAsync();

            Assert.Contains(loadedState.Preferences.WakeTime, states.Select(state => state.Preferences.WakeTime));
            Assert.Contains(loadedSettings.Model, settings.Select(setting => setting.Model));
            Assert.Empty(Directory.GetFiles(dir, "*.tmp"));
            Assert.True(File.Exists(Path.Combine(dir, "planner-state.v1.json")));
            Assert.True(File.Exists(Path.Combine(dir, "ai-settings.local.json")));
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
        }
    }
}
