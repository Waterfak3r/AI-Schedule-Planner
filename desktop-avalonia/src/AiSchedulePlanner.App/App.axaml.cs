using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

namespace AiSchedulePlanner.App;

public partial class App : Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var mainWindow = new MainWindow();
            desktop.MainWindow = mainWindow;
            if (TryReadScreenshotOptions(desktop.Args, out var screenshotPath, out var width, out var height, out var scenario))
            {
                ConfigureHiddenAutomationWindow(mainWindow);
                mainWindow.Opened += async (_, _) =>
                {
                    var exitCode = 0;
                    try
                    {
                        await mainWindow.SaveRenderedScreenshotAsync(screenshotPath, width, height, scenario);
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine(ex);
                        exitCode = 1;
                    }
                    finally
                    {
                        ShutdownAutomation(desktop, exitCode);
                    }
                };
            }
            else if (TryReadUiAuditOptions(desktop.Args, out var auditPath, out width, out height, out scenario))
            {
                ConfigureHiddenAutomationWindow(mainWindow);
                mainWindow.Opened += async (_, _) =>
                {
                    var exitCode = 0;
                    try
                    {
                        await mainWindow.SaveUiAuditAsync(auditPath, width, height, scenario);
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine(ex);
                        exitCode = 1;
                    }
                    finally
                    {
                        ShutdownAutomation(desktop, exitCode);
                    }
                };
            }
        }

        base.OnFrameworkInitializationCompleted();
    }

    private static void ShutdownAutomation(IClassicDesktopStyleApplicationLifetime desktop, int exitCode)
    {
        desktop.Shutdown(exitCode);
        Environment.Exit(exitCode);
    }

    private static void ConfigureHiddenAutomationWindow(MainWindow mainWindow)
    {
        mainWindow.WindowStartupLocation = WindowStartupLocation.Manual;
        mainWindow.Position = new PixelPoint(-32000, -32000);
        mainWindow.ShowInTaskbar = false;
    }

    private static bool TryReadScreenshotOptions(string[]? args, out string path, out int width, out int height, out string scenario)
    {
        return TryReadInspectionOptions(args, "screenshot", out path, out width, out height, out scenario);
    }

    private static bool TryReadUiAuditOptions(string[]? args, out string path, out int width, out int height, out string scenario)
    {
        return TryReadInspectionOptions(args, "ui-audit", out path, out width, out height, out scenario);
    }

    private static bool TryReadInspectionOptions(string[]? args, string pathOption, out string path, out int width, out int height, out string scenario)
    {
        path = "";
        width = 1180;
        height = 780;
        scenario = "";
        if (args is null || args.Length == 0) return false;

        var pathFlag = $"--{pathOption}";
        var pathPrefix = $"{pathFlag}=";
        var widthFlag = $"--{pathOption}-width";
        var heightFlag = $"--{pathOption}-height";
        var scenarioFlag = $"--{pathOption}-scenario";
        var scenarioPrefix = $"{scenarioFlag}=";
        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            if (arg.Equals(pathFlag, StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                path = args[++i];
                continue;
            }

            if (arg.StartsWith(pathPrefix, StringComparison.OrdinalIgnoreCase))
            {
                path = arg[pathPrefix.Length..];
                continue;
            }

            if ((arg.Equals(widthFlag, StringComparison.OrdinalIgnoreCase) || arg.Equals("--inspection-width", StringComparison.OrdinalIgnoreCase)) &&
                i + 1 < args.Length &&
                int.TryParse(args[++i], out var parsedWidth))
            {
                width = Math.Clamp(parsedWidth, 640, 3840);
                continue;
            }

            if ((arg.Equals(heightFlag, StringComparison.OrdinalIgnoreCase) || arg.Equals("--inspection-height", StringComparison.OrdinalIgnoreCase)) &&
                i + 1 < args.Length &&
                int.TryParse(args[++i], out var parsedHeight))
            {
                height = Math.Clamp(parsedHeight, 480, 2400);
                continue;
            }

            if ((arg.Equals(scenarioFlag, StringComparison.OrdinalIgnoreCase) || arg.Equals("--inspection-scenario", StringComparison.OrdinalIgnoreCase)) &&
                i + 1 < args.Length)
            {
                scenario = args[++i];
                continue;
            }

            if (arg.StartsWith(scenarioPrefix, StringComparison.OrdinalIgnoreCase))
            {
                scenario = arg[scenarioPrefix.Length..];
                continue;
            }

            if (arg.StartsWith("--inspection-scenario=", StringComparison.OrdinalIgnoreCase))
            {
                scenario = arg["--inspection-scenario=".Length..];
            }
        }

        return !string.IsNullOrWhiteSpace(path);
    }
}
