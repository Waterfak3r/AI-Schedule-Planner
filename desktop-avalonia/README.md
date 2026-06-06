# AI Schedule Planner Avalonia Frontend

This is an independent Avalonia desktop implementation. It does not overwrite or depend on the existing Electron/Web frontend under `public/` and `electron/`.

## Prerequisites

- .NET 8 SDK
- On this machine, the SDK was installed to `C:\Users\Waterfaker\.dotnet`.

## Run

From the repo root:

```powershell
$dotnet = Join-Path $env:USERPROFILE ".dotnet\dotnet.exe"
& $dotnet run --project desktop-avalonia\src\AiSchedulePlanner.App\AiSchedulePlanner.App.csproj
```

## Test

```powershell
$dotnet = Join-Path $env:USERPROFILE ".dotnet\dotnet.exe"
& $dotnet test desktop-avalonia\AiSchedulePlanner.Desktop.sln
```

The old Node/Electron version can still be tested separately:

```powershell
npm test
```

## Internal UI Audit

The desktop app has a hidden audit mode for layout checks without taking a
screen screenshot:

```powershell
$dotnet = Join-Path $env:USERPROFILE ".dotnet\dotnet.exe"
& $dotnet "desktop-avalonia\src\AiSchedulePlanner.App\bin\Debug\net8.0\AiSchedulePlanner.App.dll" --ui-audit "$env:TEMP\ai-schedule-planner-schedule-week-audit.txt" --ui-audit-scenario schedule-week --inspection-width 1180 --inspection-height 780
```

Useful scenarios:

- `schedule-day`
- `schedule-week`
- `schedule-month`
- `schedule-collapsed`

## Local Data

The Avalonia version stores its own local files in:

```text
%APPDATA%\AI Schedule Planner
```

Files:

- `planner-state.v1.json`
- `ai-settings.local.json`

`ai-settings.local.json` may contain the API key and must not be committed.
