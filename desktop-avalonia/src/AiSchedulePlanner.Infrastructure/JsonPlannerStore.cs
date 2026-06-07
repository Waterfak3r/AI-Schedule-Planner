using System.Text.Json;
using AiSchedulePlanner.Core;

namespace AiSchedulePlanner.Infrastructure;

public sealed class JsonPlannerStore : IPlannerStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly string _statePath;
    private readonly string _aiSettingsPath;
    private readonly SemaphoreSlim _stateSaveLock = new(1, 1);
    private readonly SemaphoreSlim _aiSettingsSaveLock = new(1, 1);

    public JsonPlannerStore(string? dataDirectory = null)
    {
        DataDirectory = dataDirectory ?? GetDefaultDataDirectory();
        _statePath = Path.Combine(DataDirectory, "planner-state.v1.json");
        _aiSettingsPath = Path.Combine(DataDirectory, "ai-settings.local.json");
    }

    public string DataDirectory { get; }

    public async Task<PlannerState> LoadStateAsync(CancellationToken cancellationToken = default)
    {
        EnsureDataDirectory(cancellationToken);
        if (!File.Exists(_statePath))
        {
            var state = PlannerDefaults.Create();
            await SaveStateAsync(state, cancellationToken);
            return state;
        }

        await using var stream = File.OpenRead(_statePath);
        var loaded = await JsonSerializer.DeserializeAsync<PlannerState>(stream, JsonOptions, cancellationToken);
        return Normalize(loaded ?? PlannerDefaults.Create());
    }

    public async Task SaveStateAsync(PlannerState state, CancellationToken cancellationToken = default)
    {
        var snapshot = Normalize(state.Clone());
        await _stateSaveLock.WaitAsync(cancellationToken);
        try
        {
            EnsureDataDirectory(cancellationToken);
            await SaveJsonAtomicallyAsync(_statePath, snapshot, cancellationToken);
        }
        finally
        {
            _stateSaveLock.Release();
        }
    }

    public async Task<AiSettings> LoadAiSettingsAsync(CancellationToken cancellationToken = default)
    {
        EnsureDataDirectory(cancellationToken);
        if (!File.Exists(_aiSettingsPath))
        {
            var settings = new AiSettings();
            await SaveAiSettingsAsync(settings, cancellationToken);
            return settings;
        }

        await using var stream = File.OpenRead(_aiSettingsPath);
        return await JsonSerializer.DeserializeAsync<AiSettings>(stream, JsonOptions, cancellationToken) ?? new AiSettings();
    }

    public async Task SaveAiSettingsAsync(AiSettings settings, CancellationToken cancellationToken = default)
    {
        var snapshot = CloneAiSettings(settings);
        await _aiSettingsSaveLock.WaitAsync(cancellationToken);
        try
        {
            EnsureDataDirectory(cancellationToken);
            await SaveJsonAtomicallyAsync(_aiSettingsPath, snapshot, cancellationToken);
        }
        finally
        {
            _aiSettingsSaveLock.Release();
        }
    }

    private static async Task SaveJsonAtomicallyAsync<T>(string path, T value, CancellationToken cancellationToken)
    {
        var tempPath = $"{path}.{Guid.NewGuid():N}.tmp";
        try
        {
            await using (var stream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                await JsonSerializer.SerializeAsync(stream, value, JsonOptions, cancellationToken);
            }

            File.Move(tempPath, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }
        }
    }

    private static AiSettings CloneAiSettings(AiSettings settings)
    {
        return new AiSettings
        {
            BaseUrl = settings.BaseUrl,
            Model = settings.Model,
            ChatPath = settings.ChatPath,
            ApiKey = settings.ApiKey,
            ApiKeyHeader = settings.ApiKeyHeader,
            ApiKeyPrefix = settings.ApiKeyPrefix,
            StylePrompt = settings.StylePrompt
        };
    }

    public static string GetDefaultDataDirectory()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        if (string.IsNullOrWhiteSpace(appData))
        {
            appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        }

        return Path.Combine(appData, "AI Schedule Planner");
    }

    private static PlannerState Normalize(PlannerState state)
    {
        state.Preferences ??= new PlannerPreferences();
        state.FixedEvents ??= [];
        state.Tasks ??= [];
        state.Completed ??= [];
        state.DayOverrides ??= [];
        state.DayOverrideRuleVersions ??= [];
        state.CommunityPosts ??= [];
        state.RuleVersion = Math.Max(0, state.RuleVersion);

        foreach (var fixedEvent in state.FixedEvents)
        {
            if (string.IsNullOrWhiteSpace(fixedEvent.Id)) fixedEvent.Id = Ids.New("fixed");
            fixedEvent.DaysOfWeek ??= [];
            fixedEvent.AssignedDates ??= [];
        }

        foreach (var task in state.Tasks)
        {
            if (string.IsNullOrWhiteSpace(task.Id)) task.Id = Ids.New("task");
            task.DaysOfWeek ??= [];
            task.DurationMin = Math.Clamp(task.DurationMin <= 0 ? 30 : task.DurationMin, 5, 480);
            task.Priority = Math.Clamp(task.Priority <= 0 ? 3 : task.Priority, 1, 5);
        }

        foreach (var key in state.DayOverrideRuleVersions.Keys.Except(state.DayOverrides.Keys).ToList())
        {
            state.DayOverrideRuleVersions.Remove(key);
        }

        return state;
    }

    private void EnsureDataDirectory(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Directory.CreateDirectory(DataDirectory);
    }
}
