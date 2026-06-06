using AiSchedulePlanner.Core;
using AiSchedulePlanner.Infrastructure;
using System.Text;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using Avalonia.VisualTree;
using static AiSchedulePlanner.App.Ui;

namespace AiSchedulePlanner.App;

internal enum ScheduleViewMode
{
    Month,
    Week,
    Day
}

internal sealed record CategoryOption(string Value, string Label)
{
    public override string ToString() => Label;
}

internal sealed record PageOption(string Value, string Label)
{
    public override string ToString() => Label;
}

internal sealed record WeekdayPicker(Control Panel, IReadOnlyList<CheckBox> Boxes);

public sealed class MainWindow : Window
{
    private const double DayPixelsPerMinute = 0.72;
    private const double DayTopOffset = 30;
    private const double DayLabelWidth = 62;
    private const double DayEventWidthDefault = 720;
    private const double WeekPixelsPerMinute = 0.48;
    private const double WeekTopOffset = 56;
    private const double WeekTimeLabelWidth = 58;
    private const double WeekDayWidthDefault = 134;
    private const double SelectionDragThreshold = 6;
    private const double SidebarExpandedWidth = 248;
    private const double SidebarCollapsedWidth = 76;

    private readonly IPlannerStore _store;
    private readonly IScheduleEngine _scheduleEngine = new ScheduleEngine();
    private readonly IScheduleActionService _scheduleActionService = new ScheduleActionService();
    private readonly IAiChatService _aiChatService = new OpenAiCompatibleChatService();
    private readonly IReminderService _reminderService = new ReminderService();
    private readonly SemaphoreSlim _autosaveLock = new(1, 1);

    private readonly ContentControl _content = new();
    private readonly StackPanel _navPanel = new() { Spacing = 6 };
    private readonly TextBlock _statusText = new() { Foreground = Brush("#64748b"), FontSize = 12 };
    private readonly TextBlock _topbarTitle = Text("正在加载", 18, "#111827", FontWeight.SemiBold);
    private readonly TextBlock _topbarStatusText = new()
    {
        Text = "正在加载本地数据",
        FontSize = 11,
        FontWeight = FontWeight.SemiBold,
        Foreground = Brush("#475569"),
        TextWrapping = TextWrapping.NoWrap,
        TextTrimming = TextTrimming.CharacterEllipsis
    };
    private readonly Dictionary<string, Button> _navButtons = [];
    private readonly Dictionary<string, string> _navFullLabels = [];
    private readonly List<AiChatMessage> _chatMessages = [];
    private readonly List<ScheduleAction> _pendingActions = [];
    private readonly HashSet<string> _selectedRuntimeIds = [];
    private bool _chatBusy;
    private int _autosaveVersion;
    private int _monthFocusVersion;
    private int _agendaSelectVersion;
    private int _scheduleViewportVersion;
    private string _rulesFilter = "";
    private Button? _undoButton;
    private Grid? _shellRoot;
    private Border? _sidebarHost;
    private TextBlock? _brandTitle;
    private TextBlock? _brandSubtitle;
    private Border? _brandAccent;
    private TextBlock? _dataDirectoryText;
    private Button? _sidebarToggleButton;
    private TextBlock? _sidebarToggleIcon;
    private Border? _topbarStatusPill;
    private bool _sidebarCollapsed;
    private double _dayEventWidth = DayEventWidthDefault;
    private double _weekDayWidth = WeekDayWidthDefault;

    private PlannerState _state = PlannerDefaults.Create();
    private AiSettings _aiSettings = new();
    private DateOnly _focusDate = DateOnly.FromDateTime(DateTime.Today);
    private DaySchedule _daySchedule = new();
    private WeekPlan _weekPlan = new();
    private string _activePage = "Chat";
    private ScheduleViewMode _scheduleView = ScheduleViewMode.Week;

    private Canvas? _dayCanvas;
    private Border? _selectionBox;
    private bool _isBoxSelecting;
    private bool _selectionMoved;
    private Point _selectionStart;
    private ScheduleBlock? _dragBlock;
    private Point _dragStart;
    private int _dragOriginalStart;
    private int _dragOriginalEnd;
    private ScheduleBlock? _resizeBlock;
    private DateOnly _resizeDate;
    private Point _resizeStart;
    private int _resizeOriginalStart;
    private int _resizeOriginalEnd;
    private ScheduleBlock? _weekDragBlock;
    private DateOnly _weekDragDate;
    private Point _weekDragStart;
    private int _weekDragOriginalStart;
    private int _weekDragOriginalEnd;
    private int _weekDragOriginalDayIndex;
    private Border? _weekCreatePreview;
    private bool _isWeekCreating;
    private bool _weekCreateMoved;
    private int _weekCreateDayIndex;
    private int _weekCreateAnchorMin;
    private int _weekCreateStartMin;
    private int _weekCreateEndMin;
    private ScheduleBlock? _monthDragBlock;
    private DateOnly _monthDragSourceDate;
    private Point _monthDragStart;
    private bool _monthDragMoved;
    private Border? _monthDropTargetCell;
    private IBrush? _monthDropTargetBackground;
    private IBrush? _monthDropTargetBorderBrush;
    private Thickness _monthDropTargetBorderThickness;
    private Dictionary<DateOnly, DaySchedule> _undoSchedules = [];
    private Dictionary<string, bool>? _undoCompletedSnapshot;
    private string _undoDescription = "";
    private Task? _loadTask;

    public MainWindow()
        : this(new JsonPlannerStore())
    {
    }

    public MainWindow(IPlannerStore store)
    {
        _store = store;
        Title = "AI 日程助手";
        Width = 1180;
        Height = 780;
        MinWidth = 940;
        MinHeight = 680;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Background = Brush("#eef2f7");
        Content = BuildShell();
        Loaded += (_, _) => _loadTask ??= LoadAsync();
        SizeChanged += (_, _) => QueueScheduleViewportRefresh();
        KeyDown += HandleWindowKeyDown;
    }

    private Control BuildShell()
    {
        _shellRoot = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions($"{SidebarExpandedWidth},*")
        };

        var sidebar = new Border
        {
            Background = Brush("#182036"),
            Padding = new Thickness(18),
            Child = new DockPanel()
        };
        _sidebarHost = sidebar;

        var sideDock = (DockPanel)sidebar.Child!;
        var brand = new StackPanel { Spacing = 7 };
        var brandHead = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto"), ColumnSpacing = 4 };
        _brandTitle = Text("AI 日程", 21, "#ffffff", FontWeight.SemiBold);
        _brandTitle.VerticalAlignment = VerticalAlignment.Center;
        _sidebarToggleButton = BuildSidebarToggleButton();
        Grid.SetColumn(_brandTitle, 0);
        Grid.SetColumn(_sidebarToggleButton, 1);
        brandHead.Children.Add(_brandTitle);
        brandHead.Children.Add(_sidebarToggleButton);
        _brandSubtitle = Text("AI 日程桌面端", 12, "#a7b0c3");
        _brandAccent = new Border
        {
            Width = 46,
            Height = 3,
            Background = Brush("#38bdf8"),
            CornerRadius = new CornerRadius(2),
            HorizontalAlignment = HorizontalAlignment.Left
        };
        brand.Children.Add(brandHead);
        brand.Children.Add(_brandSubtitle);
        brand.Children.Add(_brandAccent);
        DockPanel.SetDock(brand, Dock.Top);
        sideDock.Children.Add(brand);

        var footer = new StackPanel { Spacing = 6 };
        footer.Children.Add(_statusText);
        _dataDirectoryText = Text("本地数据已启用", 10, "#6b7280");
        ToolTip.SetTip(_dataDirectoryText, _store.DataDirectory);
        footer.Children.Add(_dataDirectoryText);
        DockPanel.SetDock(footer, Dock.Bottom);
        sideDock.Children.Add(footer);

        _navPanel.Margin = new Thickness(0, 30, 0, 0);
        foreach (var item in new[]
                 {
                     ("Overview", "总览"),
                     ("Chat", "对话"),
                     ("Schedule", "日程"),
                     ("Rules", "规则"),
                     ("Ai", "AI 设置"),
                     ("Community", "社区"),
                     ("Advanced", "高级")
                 })
        {
            var button = NavButton(item.Item2, item.Item1);
            _navFullLabels[item.Item1] = item.Item2;
            _navButtons[item.Item1] = button;
            _navPanel.Children.Add(button);
        }
        sideDock.Children.Add(_navPanel);

        var workspace = new Grid
        {
            RowDefinitions = new RowDefinitions("Auto,*"),
            Margin = new Thickness(0)
        };
        var topbar = new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#e5e7eb"),
            BorderThickness = new Thickness(0, 0, 0, 1),
            Padding = new Thickness(22, 14),
            Child = BuildTopbar()
        };
        Grid.SetRow(topbar, 0);
        workspace.Children.Add(topbar);

        var contentHost = new Border
        {
            Padding = new Thickness(24),
            Child = _content
        };
        Grid.SetRow(contentHost, 1);
        workspace.Children.Add(contentHost);

        Grid.SetColumn(sidebar, 0);
        Grid.SetColumn(workspace, 1);
        _shellRoot.Children.Add(sidebar);
        _shellRoot.Children.Add(workspace);
        ApplySidebarLayout();
        return _shellRoot;
    }

    private Button BuildSidebarToggleButton()
    {
        _sidebarToggleIcon = CenteredIconText("<", 14, "#ffffff");
        var button = new Button
        {
            Content = _sidebarToggleIcon,
            Width = 30,
            Height = 30,
            MinHeight = 30,
            Padding = new Thickness(0),
            Background = Brush("#26314c"),
            Foreground = Brush("#ffffff"),
            BorderBrush = Brush("#33415f"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            HorizontalAlignment = HorizontalAlignment.Right,
            HorizontalContentAlignment = HorizontalAlignment.Center,
            VerticalContentAlignment = VerticalAlignment.Center
        };
        ToolTip.SetTip(button, "收起侧边栏 Ctrl+B");
        button.Click += (_, _) => ToggleSidebarCollapsed();
        return button;
    }

    private void ToggleSidebarCollapsed()
    {
        _sidebarCollapsed = !_sidebarCollapsed;
        _state.Preferences.SidebarCollapsed = _sidebarCollapsed;
        ApplySidebarLayout();
        UpdateNavigationVisualState();
        if (_activePage == "Schedule")
        {
            RenderActivePage();
        }
        QueueStateAutosave(_sidebarCollapsed ? "侧边栏已收起，并已保存偏好" : "侧边栏已展开，并已保存偏好");
    }

    private void QueueScheduleViewportRefresh()
    {
        if (_activePage != "Schedule") return;

        var version = ++_scheduleViewportVersion;
        Dispatcher.UIThread.Post(() =>
        {
            if (version != _scheduleViewportVersion || _activePage != "Schedule") return;
            RenderActivePage();
        }, DispatcherPriority.Background);
    }

    private double ResolveScheduleCalendarViewportWidth()
    {
        var windowWidth = ClientSize.Width > 1
            ? ClientSize.Width
            : Bounds.Width > 1
                ? Bounds.Width
                : Width;
        var sidebarWidth = _sidebarCollapsed ? SidebarCollapsedWidth : SidebarExpandedWidth;
        var contentPadding = 48d;
        var schedulePanelWidth = _state.Preferences.SchedulePanelCollapsed ? 0d : 256d;
        return Math.Max(260, windowWidth - sidebarWidth - contentPadding - schedulePanelWidth - 4);
    }

    private double ResolveDayEventWidth()
    {
        return Math.Max(190, ResolveScheduleCalendarViewportWidth() - DayLabelWidth - 34);
    }

    private double ResolveWeekDayWidth(int dayCount)
    {
        var usableWidth = ResolveScheduleCalendarViewportWidth() - WeekTimeLabelWidth;
        return Math.Max(34, usableWidth / Math.Max(1, dayCount));
    }

    private void ApplySidebarLayout()
    {
        if (_shellRoot is not null)
        {
            _shellRoot.ColumnDefinitions[0].Width = new GridLength(_sidebarCollapsed ? SidebarCollapsedWidth : SidebarExpandedWidth);
        }

        if (_sidebarHost is not null)
        {
            _sidebarHost.Padding = _sidebarCollapsed ? new Thickness(12, 16) : new Thickness(18);
        }

        if (_brandTitle is not null)
        {
            _brandTitle.Text = _sidebarCollapsed ? "AI" : "AI 日程";
            _brandTitle.FontSize = _sidebarCollapsed ? 16 : 21;
            _brandTitle.TextAlignment = _sidebarCollapsed ? TextAlignment.Center : TextAlignment.Left;
        }

        if (_brandSubtitle is not null)
        {
            _brandSubtitle.IsVisible = !_sidebarCollapsed;
        }

        if (_brandAccent is not null)
        {
            _brandAccent.IsVisible = !_sidebarCollapsed;
        }

        if (_dataDirectoryText is not null)
        {
            _dataDirectoryText.IsVisible = !_sidebarCollapsed;
        }

        _statusText.IsVisible = !_sidebarCollapsed;
        _navPanel.Margin = _sidebarCollapsed ? new Thickness(0, 24, 0, 0) : new Thickness(0, 30, 0, 0);

        if (_sidebarToggleButton is not null)
        {
            if (_sidebarToggleIcon is not null)
            {
                _sidebarToggleIcon.Text = _sidebarCollapsed ? ">" : "<";
                _sidebarToggleIcon.Foreground = Brush(_sidebarCollapsed ? "#dbeafe" : "#ffffff");
            }
            _sidebarToggleButton.Width = _sidebarCollapsed ? 24 : 30;
            _sidebarToggleButton.Height = _sidebarCollapsed ? 24 : 30;
            _sidebarToggleButton.MinHeight = _sidebarCollapsed ? 24 : 30;
            _sidebarToggleButton.Background = Brush(_sidebarCollapsed ? "#00ffffff" : "#26314c");
            _sidebarToggleButton.BorderBrush = Brush(_sidebarCollapsed ? "#475569" : "#33415f");
            _sidebarToggleButton.Foreground = Brush(_sidebarCollapsed ? "#dbeafe" : "#ffffff");
            _sidebarToggleButton.CornerRadius = new CornerRadius(_sidebarCollapsed ? 12 : 7);
            ToolTip.SetTip(_sidebarToggleButton, _sidebarCollapsed ? "展开侧边栏 Ctrl+B" : "收起侧边栏 Ctrl+B");
        }
    }

    private Control BuildTopbar()
    {
        var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        var left = new StackPanel { Spacing = 5 };
        _topbarStatusPill = new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(8, 4),
            HorizontalAlignment = HorizontalAlignment.Left,
            MaxWidth = 620,
            Child = _topbarStatusText
        };
        left.Children.Add(_topbarTitle);
        left.Children.Add(_topbarStatusPill);

        var right = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        var saveButton = Button("保存", async (_, _) => await SaveStateAsync(), secondary: true);
        _undoButton = Button("撤销", (_, _) => UndoLastScheduleChange(), secondary: true);
        _undoButton.IsEnabled = false;
        right.Children.Add(_undoButton);
        right.Children.Add(saveButton);
        Grid.SetColumn(left, 0);
        Grid.SetColumn(right, 1);
        grid.Children.Add(left);
        grid.Children.Add(right);
        return grid;
    }

    private async Task LoadAsync()
    {
        try
        {
            _state = await _store.LoadStateAsync();
            _aiSettings = await _store.LoadAiSettingsAsync();
            _activePage = string.IsNullOrWhiteSpace(_state.Preferences.StartupPage) ? "Chat" : _state.Preferences.StartupPage;
            _scheduleView = ParseScheduleViewMode(_state.Preferences.ScheduleView);
            _sidebarCollapsed = _state.Preferences.SidebarCollapsed;
            ApplySidebarLayout();
            ResetChatMessages();
            RebuildSchedules();
            SetStatus("已加载本地数据");
            RenderActivePage();
        }
        catch (Exception ex)
        {
            SetStatus($"加载失败：{ex.Message}", error: true);
            _content.Content = CenterText(ex.Message);
        }
    }

    public async Task SaveRenderedScreenshotAsync(string path, int width = 1180, int height = 780, string scenario = "")
    {
        await PrepareInternalReviewAsync(width, height, scenario);
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        using var bitmap = new RenderTargetBitmap(new PixelSize(width, height), new Vector(96, 96));
        bitmap.Render(this);
        bitmap.Save(path);
    }

    public async Task SaveUiAuditAsync(string path, int width = 1180, int height = 780, string scenario = "")
    {
        await PrepareInternalReviewAsync(width, height, scenario);
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        await File.WriteAllTextAsync(path, BuildUiAuditReport(width, height, scenario), Encoding.UTF8);
    }

    private async Task PrepareInternalReviewAsync(int width, int height, string scenario)
    {
        await EnsureLoadedAsync();
        ApplyInternalReviewScenario(scenario);

        Width = width;
        Height = height;
        await Dispatcher.UIThread.InvokeAsync(() =>
        {
            Measure(new Size(width, height));
            Arrange(new Rect(0, 0, width, height));
            UpdateLayout();
        }, DispatcherPriority.Render);

        await Task.Delay(100);
    }

    private void ApplyInternalReviewScenario(string scenario)
    {
        if (string.IsNullOrWhiteSpace(scenario)) return;

        switch (scenario.Trim().ToLowerInvariant())
        {
            case "schedule":
            case "schedule-day":
                ApplyScheduleReviewScenario(ScheduleViewMode.Day, panelCollapsed: false, sidebarCollapsed: false, selectBlock: false, markComplete: false);
                break;
            case "schedule-selected":
                ApplyScheduleReviewScenario(ScheduleViewMode.Day, panelCollapsed: false, sidebarCollapsed: false, selectBlock: true, markComplete: false);
                break;
            case "schedule-completed":
                ApplyScheduleReviewScenario(ScheduleViewMode.Day, panelCollapsed: false, sidebarCollapsed: false, selectBlock: true, markComplete: true);
                break;
            case "schedule-week":
                ApplyScheduleReviewScenario(ScheduleViewMode.Week, panelCollapsed: false, sidebarCollapsed: false, selectBlock: false, markComplete: false);
                break;
            case "schedule-month":
                ApplyScheduleReviewScenario(ScheduleViewMode.Month, panelCollapsed: false, sidebarCollapsed: false, selectBlock: false, markComplete: false);
                break;
            case "schedule-collapsed":
                ApplyScheduleReviewScenario(ScheduleViewMode.Week, panelCollapsed: true, sidebarCollapsed: true, selectBlock: false, markComplete: false);
                break;
        }
    }

    private void ApplyScheduleReviewScenario(ScheduleViewMode viewMode, bool panelCollapsed, bool sidebarCollapsed, bool selectBlock, bool markComplete)
    {
        _activePage = "Schedule";
        _scheduleView = viewMode;
        _state.Preferences.SchedulePanelCollapsed = panelCollapsed;
        _sidebarCollapsed = sidebarCollapsed;
        _state.Preferences.SidebarCollapsed = sidebarCollapsed;
        ApplySidebarLayout();
        UpdateNavigationVisualState();
        RebuildSchedules();

        ScheduleBlock? reviewBlock = null;
        if (selectBlock || markComplete)
        {
            reviewBlock = _daySchedule.Blocks
                .Where(IsVisibleBlock)
                .OrderBy(block => block.StartMin)
                .FirstOrDefault();
            if (reviewBlock is null)
            {
                reviewBlock = new ScheduleBlock
                {
                    RuntimeId = Ids.New("review"),
                    Type = ScheduleBlockType.Task,
                    Title = "写代码",
                    Category = "code",
                    StartMin = 7 * 60 + 30,
                    EndMin = 9 * 60,
                    Editable = true
                };
                _daySchedule.Blocks.Add(reviewBlock);
            }
        }

        if (markComplete && reviewBlock is not null)
        {
            _state.Completed[reviewBlock.RuntimeId] = true;
        }

        if (selectBlock && reviewBlock is not null)
        {
            _selectedRuntimeIds.Clear();
            _selectedRuntimeIds.Add(reviewBlock.RuntimeId);
        }
        else
        {
            _selectedRuntimeIds.Clear();
        }

        RenderActivePage();
    }

    private string BuildUiAuditReport(int width, int height, string scenario)
    {
        var visibleControls = this.GetVisualDescendants().OfType<Control>().Where(control => control.IsVisible).ToList();
        var buttonLabels = visibleControls
            .OfType<Button>()
            .Select(button => ControlText(button.Content))
            .Where(text => !string.IsNullOrWhiteSpace(text))
            .Select(text => text.ReplaceLineEndings(" ").Trim())
            .Distinct()
            .Take(90)
            .ToList();
        var visibleTexts = visibleControls
            .OfType<TextBlock>()
            .Select(text => text.Text ?? "")
            .Where(text => !string.IsNullOrWhiteSpace(text))
            .Select(text => text.ReplaceLineEndings(" ").Trim())
            .Distinct()
            .ToList();
        var legacyScheduleTexts = visibleTexts
            .Concat(buttonLabels)
            .Where(text => text.Contains("Schedule", StringComparison.OrdinalIgnoreCase))
            .Distinct()
            .ToList();
        var iconAlignmentRows = BuildIconButtonAlignmentRows(visibleControls.OfType<Button>());
        var scrollViewers = visibleControls.OfType<ScrollViewer>().ToList();
        var zeroSized = visibleControls.Count(control => control.Bounds.Width <= 0 || control.Bounds.Height <= 0);
        var report = new StringBuilder();

        report.AppendLine("AI 日程助手 internal UI audit");
        report.AppendLine($"scenario: {(string.IsNullOrWhiteSpace(scenario) ? "default" : scenario)}");
        report.AppendLine($"window: {width}x{height}");
        report.AppendLine($"active_page: {_activePage}");
        report.AppendLine($"schedule_view: {_scheduleView}");
        report.AppendLine($"sidebar: {(_sidebarCollapsed ? "collapsed" : "expanded")}");
        report.AppendLine($"schedule_panel: {(_state.Preferences.SchedulePanelCollapsed ? "collapsed" : "expanded")}");
        report.AppendLine($"schedule_calendar_viewport_width: {ResolveScheduleCalendarViewportWidth():0.##}");
        report.AppendLine($"visible_controls: {visibleControls.Count}");
        report.AppendLine($"zero_sized_visible_controls: {zeroSized}");
        if (zeroSized > 0)
        {
            var zeroSizedTypes = visibleControls
                .Where(control => control.Bounds.Width <= 0 || control.Bounds.Height <= 0)
                .Select(control => control.GetType().Name)
                .GroupBy(name => name)
                .Select(group => $"{group.Key}={group.Count()}")
                .OrderBy(text => text)
                .ToList();
            report.AppendLine($"zero_sized_types: {string.Join(", ", zeroSizedTypes)}");
        }
        report.AppendLine($"buttons: {string.Join(" | ", buttonLabels)}");
        report.AppendLine($"has_calendar_toggle: {buttonLabels.Contains("收起日历") || buttonLabels.Contains("展开日历")}");
        report.AppendLine($"has_legacy_schedule_text: {legacyScheduleTexts.Count > 0}");
        report.AppendLine($"legacy_schedule_texts: {string.Join(" | ", legacyScheduleTexts)}");
        report.AppendLine("icon_button_alignment:");
        foreach (var row in iconAlignmentRows)
        {
            report.AppendLine($"- {row}");
        }
        report.AppendLine("scroll_viewers:");
        foreach (var viewer in scrollViewers)
        {
            report.AppendLine($"- h={viewer.HorizontalScrollBarVisibility}, v={viewer.VerticalScrollBarVisibility}, viewport={viewer.Viewport.Width:0.##}x{viewer.Viewport.Height:0.##}, extent={viewer.Extent.Width:0.##}x{viewer.Extent.Height:0.##}");
        }

        return report.ToString();
    }

    private static string ControlText(object? content)
    {
        return content switch
        {
            null => "",
            string text => text,
            TextBlock textBlock => textBlock.Text ?? "",
            ContentControl contentControl => ControlText(contentControl.Content),
            Decorator decorator => ControlText(decorator.Child),
            Panel panel => string.Join("", panel.Children.Select(ControlText)),
            _ => content.ToString() ?? ""
        };
    }

    private static IReadOnlyList<string> BuildIconButtonAlignmentRows(IEnumerable<Button> buttons)
    {
        var rows = new List<string>();
        foreach (var button in buttons)
        {
            var text = ControlText(button.Content).Trim();
            if (text is not ("<" or ">" or "←" or "→" or "✓")) continue;

            var textBlock = button.GetVisualDescendants()
                .OfType<TextBlock>()
                .FirstOrDefault(block => (block.Text ?? "").Trim() == text);
            var origin = textBlock?.TranslatePoint(new Point(0, 0), button);
            if (textBlock is null || origin is null) continue;

            var offsetX = origin.Value.X + textBlock.Bounds.Width / 2 - button.Bounds.Width / 2;
            var offsetY = origin.Value.Y + textBlock.Bounds.Height / 2 - button.Bounds.Height / 2;
            rows.Add($"{text}: button={button.Bounds.Width:0.##}x{button.Bounds.Height:0.##}, content={textBlock.Bounds.Width:0.##}x{textBlock.Bounds.Height:0.##}, offset={offsetX:0.##},{offsetY:0.##}");
        }

        return rows;
    }

    private Task EnsureLoadedAsync()
    {
        return _loadTask ??= LoadAsync();
    }

    private void RebuildSchedules()
    {
        var request = BuildScheduleRequest(_focusDate, _state.Tasks);
        _daySchedule = BuildScheduleForDate(_focusDate);
        _weekPlan = ApplyWeekOverrides(_scheduleEngine.BuildWeek(request));
    }

    private DaySchedule BuildScheduleForDate(DateOnly date)
    {
        return ApplyDayOverride(_scheduleEngine.BuildDay(BuildScheduleRequest(date, _state.Tasks)));
    }

    private ScheduleBuildRequest BuildScheduleRequest(DateOnly date, List<TaskRule> tasks)
    {
        return new ScheduleBuildRequest
        {
            Date = date,
            ActiveStart = _state.Preferences.WakeTime,
            ActiveEnd = _state.Preferences.Bedtime,
            FixedEvents = _state.FixedEvents,
            Tasks = tasks,
            IncludeBuffers = true
        };
    }

    private async Task SaveStateAsync()
    {
        await _store.SaveStateAsync(_state);
        await _store.SaveAiSettingsAsync(_aiSettings);
        SetStatus("已保存");
    }

    private DaySchedule ApplyDayOverride(DaySchedule schedule)
    {
        return _state.DayOverrides.TryGetValue(DateKey(schedule.Date), out var overrideSchedule)
            ? overrideSchedule.Clone()
            : schedule;
    }

    private WeekPlan ApplyWeekOverrides(WeekPlan plan)
    {
        foreach (var day in plan.Days)
        {
            day.Schedule = ApplyDayOverride(day.Schedule);
        }

        return plan;
    }

    private void SaveCurrentDayOverride(string reason)
    {
        _state.DayOverrides[DateKey(_daySchedule.Date)] = _daySchedule.Clone();
        SyncDayIntoWeekPlan(_daySchedule);
        var issues = ComputeManualScheduleIssues(_daySchedule);
        var suffix = issues.Count > 0 ? $"；发现 {issues.Count} 个时间问题" : "";
        var hasError = issues.Any(issue => issue.Level == ScheduleIssueLevel.Error);
        SetStatus($"{reason}，正在自动保存{suffix}", error: hasError);
        QueueStateAutosave($"{reason}，已自动保存为当天手动调整{suffix}", hasError);
    }

    private void QueueStateAutosave(string successMessage, bool errorStatus = false)
    {
        var version = Interlocked.Increment(ref _autosaveVersion);
        _ = SaveStateSilentlyAsync(version, successMessage, errorStatus);
    }

    private async Task SaveStateSilentlyAsync(int version, string successMessage, bool errorStatus)
    {
        try
        {
            await _autosaveLock.WaitAsync();
            try
            {
                await _store.SaveStateAsync(_state);
            }
            finally
            {
                _autosaveLock.Release();
            }

            await Dispatcher.UIThread.InvokeAsync(() =>
            {
                if (version == _autosaveVersion)
                {
                    SetStatus(successMessage, errorStatus);
                }
            });
        }
        catch (Exception ex)
        {
            await Dispatcher.UIThread.InvokeAsync(() => SetStatus($"自动保存失败：{ex.Message}", error: true));
        }
    }

    private void SyncDayIntoWeekPlan(DaySchedule schedule)
    {
        var day = _weekPlan.Days.FirstOrDefault(item => item.Date == schedule.Date);
        if (day is not null)
        {
            day.Schedule = schedule.Clone();
        }
    }

    private void ClearCurrentDayOverride()
    {
        if (_state.DayOverrides.Remove(DateKey(_focusDate)))
        {
            CaptureUndo("恢复当天");
            RebuildSchedules();
            SetStatus("已恢复当天自动生成日程，正在自动保存");
            QueueStateAutosave("已恢复当天自动生成日程，并已自动保存");
            RenderActivePage();
        }
    }

    private static string DateKey(DateOnly date) => date.ToString("yyyy-MM-dd");

    private void CaptureUndo(string description)
    {
        CaptureUndo(description, [_daySchedule.Date]);
    }

    private void CaptureUndo(string description, IEnumerable<DateOnly> dates)
    {
        _undoSchedules = dates
            .Distinct()
            .ToDictionary(date => date, date => BuildScheduleForDate(date).Clone());
        _undoCompletedSnapshot = new Dictionary<string, bool>(_state.Completed);
        _undoDescription = description;
    }

    private void ClearUndo()
    {
        _undoSchedules = [];
        _undoCompletedSnapshot = null;
        _undoDescription = "";
    }

    private void UndoLastScheduleChange()
    {
        if (_undoSchedules.Count == 0) return;

        var restoredDates = _undoSchedules.Keys.OrderBy(date => date).ToList();
        foreach (var (date, schedule) in _undoSchedules)
        {
            _state.DayOverrides[DateKey(date)] = schedule.Clone();
        }

        if (_undoCompletedSnapshot is not null)
        {
            _state.Completed = new Dictionary<string, bool>(_undoCompletedSnapshot);
        }

        _focusDate = restoredDates[0];
        var label = string.IsNullOrWhiteSpace(_undoDescription) ? "上一步操作" : _undoDescription;
        var dateCount = restoredDates.Count;
        ClearUndo();
        RebuildSchedules();
        var suffix = dateCount > 1 ? $"，已恢复 {dateCount} 天" : "";
        SetStatus($"已撤销：{label}{suffix}，正在自动保存");
        QueueStateAutosave($"已撤销：{label}{suffix}，并已自动保存");
        RenderActivePage();
    }

    private void HandleWindowKeyDown(object? sender, KeyEventArgs args)
    {
        if (IsEditingInput(args.Source)) return;

        var ctrl = args.KeyModifiers.HasFlag(KeyModifiers.Control);
        if (ctrl && args.Key == Key.B)
        {
            ToggleSidebarCollapsed();
            args.Handled = true;
            return;
        }

        if (_activePage != "Schedule") return;

        var hasSelection = _selectedRuntimeIds.Count > 0;

        if (args.Key == Key.Escape && hasSelection)
        {
            _selectedRuntimeIds.Clear();
            RenderActivePage();
            args.Handled = true;
            return;
        }

        if (args.Key == Key.Delete && hasSelection)
        {
            _ = DeleteSelectedAsync();
            args.Handled = true;
            return;
        }

        if (!ctrl) return;

        switch (args.Key)
        {
            case Key.N:
                _ = CreateScheduleBlockInDayViewAsync(ResolveDefaultNewBlockStartMin());
                args.Handled = true;
                break;
            case Key.T:
                GoToToday();
                args.Handled = true;
                break;
            case Key.D1:
            case Key.NumPad1:
                SwitchScheduleView(ScheduleViewMode.Month);
                args.Handled = true;
                break;
            case Key.D2:
            case Key.NumPad2:
                SwitchScheduleView(ScheduleViewMode.Week);
                args.Handled = true;
                break;
            case Key.D3:
            case Key.NumPad3:
                SwitchScheduleView(ScheduleViewMode.Day);
                args.Handled = true;
                break;
            case Key.Left:
                ShiftSchedulePeriod(-1);
                args.Handled = true;
                break;
            case Key.Right:
                ShiftSchedulePeriod(1);
                args.Handled = true;
                break;
            case Key.Up when hasSelection:
                MoveSelected(-15);
                args.Handled = true;
                break;
            case Key.Down when hasSelection:
                MoveSelected(15);
                args.Handled = true;
                break;
        }
    }

    private static bool IsEditingInput(object? source)
    {
        return source is TextBox
            or ComboBox
            or MenuItem
            or Slider
            or NumericUpDown
            or DatePicker
            or TimePicker;
    }

    private void RenderActivePage()
    {
        if (_undoButton is not null)
        {
            _undoButton.IsEnabled = _undoSchedules.Count > 0;
            _undoButton.Content = _undoSchedules.Count == 0 ? "撤销" : $"撤销：{_undoDescription}";
        }

        UpdateNavigationVisualState();

        _topbarTitle.Text = _activePage switch
        {
            "Overview" => "总览",
            "Chat" => "对话",
            "Schedule" => "日程",
            "Rules" => "规则",
            "Ai" => "AI 设置",
            "Community" => "社区",
            "Advanced" => "高级",
            _ => "AI 日程助手"
        };

        _content.Content = _activePage switch
        {
            "Overview" => RenderOverview(),
            "Chat" => RenderChat(),
            "Schedule" => RenderSchedule(),
            "Rules" => RenderRules(),
            "Ai" => RenderAiSettings(),
            "Community" => RenderCommunity(),
            "Advanced" => RenderAdvanced(),
            _ => RenderChat()
        };
    }

    private void UpdateNavigationVisualState()
    {
        foreach (var (page, button) in _navButtons)
        {
            var active = page == _activePage;
            var fullLabel = _navFullLabels.GetValueOrDefault(page, button.Content?.ToString() ?? page);

            var collapsedLabelUnits = BuildCollapsedNavLabelUnits(fullLabel);
            button.Content = _sidebarCollapsed ? BuildCollapsedNavLabel(collapsedLabelUnits, active) : fullLabel;
            button.Background = Brush(active ? "#26314c" : "#00ffffff");
            button.Foreground = Brush(active ? "#ffffff" : "#cbd5e1");
            button.BorderBrush = Brush(active ? "#38bdf8" : "#00ffffff");
            button.BorderThickness = new Thickness(active ? 3 : 0, 0, 0, 0);
            button.Margin = _sidebarCollapsed
                ? new Thickness(0, 0, 0, 8)
                : new Thickness(active ? 10 : 0, 0, active ? 0 : 10, 4);
            button.Padding = _sidebarCollapsed ? new Thickness(0, 7) : new Thickness(active ? 14 : 12, 8, 12, 8);
            button.MinHeight = _sidebarCollapsed ? CollapsedNavButtonHeight(collapsedLabelUnits.Count) : 0;
            button.Width = _sidebarCollapsed ? 48 : double.NaN;
            button.HorizontalAlignment = _sidebarCollapsed ? HorizontalAlignment.Center : HorizontalAlignment.Stretch;
            button.HorizontalContentAlignment = _sidebarCollapsed ? HorizontalAlignment.Center : HorizontalAlignment.Left;
            button.VerticalContentAlignment = VerticalAlignment.Center;
            ToolTip.SetTip(button, fullLabel);
        }
    }

    private static Control BuildCollapsedNavLabel(IReadOnlyList<string> units, bool active)
    {
        var stack = new StackPanel
        {
            Spacing = 1,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };

        foreach (var unit in units)
        {
            stack.Children.Add(new TextBlock
            {
                Text = unit,
                FontSize = unit.Length > 1 ? 11 : 12,
                LineHeight = 13.5,
                FontWeight = FontWeight.SemiBold,
                Foreground = Brush(active ? "#ffffff" : "#cbd5e1"),
                TextAlignment = TextAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                TextWrapping = TextWrapping.NoWrap
            });
        }

        return stack;
    }

    private static IReadOnlyList<string> BuildCollapsedNavLabelUnits(string label)
    {
        var units = new List<string>();
        var asciiRun = new StringBuilder();

        foreach (var ch in label)
        {
            if (char.IsWhiteSpace(ch)) continue;

            if (ch <= 127 && char.IsLetterOrDigit(ch))
            {
                asciiRun.Append(ch);
                continue;
            }

            if (asciiRun.Length > 0)
            {
                units.Add(asciiRun.ToString());
                asciiRun.Clear();
            }

            units.Add(ch.ToString());
        }

        if (asciiRun.Length > 0)
        {
            units.Add(asciiRun.ToString());
        }

        return units.Count > 0 ? units : [label];
    }

    private static double CollapsedNavButtonHeight(int unitCount) => Math.Max(52, unitCount * 13.5 + 16);

    private Control RenderOverview()
    {
        var completion = GetCompletionStats(_daySchedule);
        var visibleBlocks = _daySchedule.Blocks.Where(IsVisibleBlock).OrderBy(block => block.StartMin).ToList();

        var page = PageStack();
        page.Children.Add(Header("今天", $"{_focusDate:yyyy-MM-dd} 周{WeekdayText(_focusDate)}"));

        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,320"),
            ColumnSpacing = 16
        };

        var main = new StackPanel { Spacing = 14 };
        main.Children.Add(RenderOverviewHero(visibleBlocks));
        main.Children.Add(RenderOverviewTimeline(visibleBlocks));
        Grid.SetColumn(main, 0);
        grid.Children.Add(main);

        var side = new StackPanel { Spacing = 12 };
        side.Children.Add(ProgressCard(completion));
        side.Children.Add(RenderOverviewDayHealth(visibleBlocks));
        side.Children.Add(RenderOverviewStats(completion));
        side.Children.Add(RenderOverviewActions());
        Grid.SetColumn(side, 1);
        grid.Children.Add(side);

        page.Children.Add(grid);
        return Scroll(page);
    }

    private Control RenderOverviewHero(IReadOnlyList<ScheduleBlock> visibleBlocks)
    {
        var now = CurrentMinute();
        var current = IsFocusDateToday()
            ? visibleBlocks.FirstOrDefault(block => block.StartMin <= now && now < block.EndMin)
            : null;
        var next = visibleBlocks.FirstOrDefault(block => block.StartMin >= (IsFocusDateToday() ? now : 0))
            ?? visibleBlocks.FirstOrDefault();
        var target = current ?? next;

        var root = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        var text = new StackPanel { Spacing = 8 };
        text.Children.Add(Text(current is not null ? "正在进行" : next is not null ? "下一段" : "今天", 12, current is not null ? "#b91c1c" : "#1d4ed8", FontWeight.SemiBold));
        text.Children.Add(Text(target is null ? "今天没有排入日程" : target.Title, 28, "#111827", FontWeight.SemiBold));
        text.Children.Add(Text(target is null ? "可以从日程页新建，或直接去对话页让 AI 帮你安排。" : $"{target.Start}-{target.End}", 14, "#475569", FontWeight.SemiBold));
        Grid.SetColumn(text, 0);
        root.Children.Add(text);

        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            VerticalAlignment = VerticalAlignment.Center,
            Spacing = 8
        };
        actions.Children.Add(Button("打开日程", (_, _) =>
        {
            _activePage = "Schedule";
            _state.Preferences.StartupPage = "Schedule";
            RenderActivePage();
        }, secondary: true));
        actions.Children.Add(Button("问 AI", (_, _) =>
        {
            _activePage = "Chat";
            _state.Preferences.StartupPage = "Chat";
            RenderActivePage();
        }));
        Grid.SetColumn(actions, 1);
        root.Children.Add(actions);

        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#dadce0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(18),
            Child = root
        };
    }

    private Control RenderOverviewTimeline(IReadOnlyList<ScheduleBlock> visibleBlocks)
    {
        var root = new StackPanel { Spacing = 8 };
        root.Children.Add(Text("今天时间线", 15, "#111827", FontWeight.SemiBold));
        if (visibleBlocks.Count == 0)
        {
            root.Children.Add(Text("暂无日程。", 13, "#64748b"));
        }
        else
        {
            foreach (var block in visibleBlocks.Take(10))
            {
                root.Children.Add(RenderOverviewTimelineRow(block));
            }
            if (visibleBlocks.Count > 10)
            {
                root.Children.Add(Text($"还有 {visibleBlocks.Count - 10} 个日程，打开日程页查看全部。", 12, "#64748b", FontWeight.SemiBold));
            }
        }

        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#dadce0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(14),
            Child = root
        };
    }

    private Control RenderOverviewTimelineRow(ScheduleBlock block)
    {
        var done = IsBlockCompleted(block);
        var current = IsCurrentBlock(block);
        var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("78,Auto,*,Auto"), ColumnSpacing = 10 };
        var time = Text($"{block.Start}\n{block.End}", 12, done ? "#94a3b8" : current ? "#b91c1c" : "#475569", FontWeight.SemiBold);
        var marker = new Border
        {
            Width = 10,
            Height = 10,
            CornerRadius = new CornerRadius(5),
            Background = Brush(done ? "#94a3b8" : current ? "#ef4444" : MonthEventAccent(block)),
            VerticalAlignment = VerticalAlignment.Center
        };
        var title = Text($"{block.Title}{(done ? "（已完成）" : current ? "（进行中）" : "")}", 13, done ? "#64748b" : "#111827", FontWeight.SemiBold);
        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Spacing = 6
        };
        var complete = Button(done ? "取消" : "完成", async (_, _) => await ToggleBlockCompleteAsync(block), secondary: true);
        var edit = Button("改", async (_, _) => await EditScheduleBlockAsync(block), secondary: true);
        ToolTip.SetTip(complete, done ? "取消完成" : "标记完成");
        ToolTip.SetTip(edit, "编辑日程");
        complete.Padding = new Thickness(8, 4);
        edit.Padding = new Thickness(8, 4);
        complete.MinHeight = 28;
        edit.MinHeight = 28;
        actions.Children.Add(complete);
        actions.Children.Add(edit);
        Grid.SetColumn(time, 0);
        Grid.SetColumn(marker, 1);
        Grid.SetColumn(title, 2);
        Grid.SetColumn(actions, 3);
        grid.Children.Add(time);
        grid.Children.Add(marker);
        grid.Children.Add(title);
        grid.Children.Add(actions);
        return new Border
        {
            Background = Brush(current ? "#fef2f2" : done ? "#f8fafc" : "#ffffff"),
            BorderBrush = Brush(current ? "#fecaca" : "#e5e7eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10),
            Child = grid
        };
    }

    private Control RenderOverviewDayHealth(IReadOnlyList<ScheduleBlock> visibleBlocks)
    {
        var root = new StackPanel { Spacing = 9 };
        root.Children.Add(Text("日况", 15, "#111827", FontWeight.SemiBold));
        var issues = GetScheduleIssuesForDisplay();
        var activeStart = TimeText.ParseMinutes(_state.Preferences.WakeTime) ?? 8 * 60;
        var activeEnd = TimeText.ParseMinutes(_state.Preferences.Bedtime) ?? 23 * 60;
        var free = LargestFreeWindow(visibleBlocks, activeStart, activeEnd);
        var hasKey = !string.IsNullOrWhiteSpace(_aiSettings.ApiKey);
        root.Children.Add(OverviewHealthRow("时间问题", issues.Count == 0 ? "无" : $"{issues.Count} 个", issues.Count == 0 ? "#166534" : "#991b1b"));
        root.Children.Add(OverviewHealthRow("最长空档", free.Duration <= 0 ? "无" : $"{TimeText.ToTime(free.Start)}-{TimeText.ToTime(free.End)}", free.Duration >= 60 ? "#166534" : "#475569"));
        root.Children.Add(OverviewHealthRow("AI", hasKey ? "已配置" : "未配置", hasKey ? "#166534" : "#991b1b"));
        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#e5e7eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(14),
            Child = root
        };
    }

    private static Control OverviewHealthRow(string label, string value, string color)
    {
        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,Auto"),
            ColumnSpacing = 8
        };
        var labelText = Text(label, 12, "#64748b", FontWeight.SemiBold);
        var valueText = Text(value, 12, color, FontWeight.SemiBold);
        valueText.TextAlignment = TextAlignment.Right;
        Grid.SetColumn(labelText, 0);
        Grid.SetColumn(valueText, 1);
        grid.Children.Add(labelText);
        grid.Children.Add(valueText);
        return new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(9),
            Child = grid
        };
    }

    private static (int Start, int End, int Duration) LargestFreeWindow(IReadOnlyList<ScheduleBlock> visibleBlocks, int activeStart, int activeEnd)
    {
        activeStart = Math.Clamp(activeStart, TimeText.FullDayStartMin, TimeText.FullDayEndMin);
        activeEnd = Math.Clamp(activeEnd, activeStart, TimeText.FullDayEndMin);
        var cursor = activeStart;
        var bestStart = activeStart;
        var bestEnd = activeStart;
        foreach (var block in visibleBlocks.OrderBy(block => block.StartMin))
        {
            var start = Math.Clamp(block.StartMin, activeStart, activeEnd);
            var end = Math.Clamp(block.EndMin, activeStart, activeEnd);
            if (start > cursor && start - cursor > bestEnd - bestStart)
            {
                bestStart = cursor;
                bestEnd = start;
            }
            cursor = Math.Max(cursor, end);
        }

        if (activeEnd > cursor && activeEnd - cursor > bestEnd - bestStart)
        {
            bestStart = cursor;
            bestEnd = activeEnd;
        }

        return (bestStart, bestEnd, Math.Max(0, bestEnd - bestStart));
    }

    private Control RenderOverviewStats(CompletionStats completion)
    {
        var grid = new UniformGrid { Columns = 2 };
        grid.Children.Add(StatCard("已完成", $"{completion.Done}/{completion.Total}"));
        grid.Children.Add(StatCard("问题", GetScheduleIssuesForDisplay().Count.ToString()));
        grid.Children.Add(StatCard("固定分钟", _daySchedule.Summary.FixedMinutes.ToString()));
        grid.Children.Add(StatCard("任务分钟", _daySchedule.Summary.TaskMinutes.ToString()));
        return grid;
    }

    private Control RenderOverviewActions()
    {
        var root = new StackPanel { Spacing = 8 };
        root.Children.Add(Button("新建日程", async (_, _) =>
        {
            _activePage = "Schedule";
            _state.Preferences.StartupPage = "Schedule";
            await CreateScheduleBlockInDayViewAsync(ResolveDefaultNewBlockStartMin());
        }));
        root.Children.Add(Button("复制今日提醒", async (_, _) =>
        {
            var reminder = _reminderService.Generate(_daySchedule);
            await (Clipboard?.SetTextAsync(reminder) ?? Task.CompletedTask);
            SetStatus("提醒已复制到剪贴板");
        }, secondary: true));
        root.Children.Add(Button("打开对话", (_, _) =>
        {
            _activePage = "Chat";
            _state.Preferences.StartupPage = "Chat";
            RenderActivePage();
        }, secondary: true));
        return Card("快捷入口", root);
    }

    private Control RenderChat()
    {
        var root = new Grid
        {
            RowDefinitions = new RowDefinitions("Auto,*,Auto"),
            RowSpacing = 12
        };
        var topStrip = RenderChatTopStrip();
        Grid.SetRow(topStrip, 0);
        root.Children.Add(topStrip);

        var workArea = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,340"),
            ColumnSpacing = 14
        };

        var messages = new StackPanel { Spacing = 10 };
        foreach (var message in _chatMessages)
        {
            messages.Children.Add(ChatBubble(message));
        }

        var scroller = new ScrollViewer
        {
            Content = messages,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto
        };
        var messagePanel = new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#dadce0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(14),
            Child = scroller
        };
        Grid.SetColumn(messagePanel, 0);
        workArea.Children.Add(messagePanel);

        var sidePanel = _pendingActions.Count > 0 ? BuildActionPreview() : RenderChatContextPanel();
        Grid.SetColumn(sidePanel, 1);
        workArea.Children.Add(sidePanel);

        Grid.SetRow(workArea, 1);
        root.Children.Add(workArea);

        var input = new TextBox
        {
            Watermark = "例如：这周日晚上七点半要到教一601考试，大概九点去居酒屋",
            MinHeight = 64,
            MaxHeight = 140,
            AcceptsReturn = true,
            TextWrapping = TextWrapping.Wrap
        };
        var send = Button(_chatBusy ? "处理中" : "发送", async (_, _) => await SubmitChatAsync());
        send.IsEnabled = !_chatBusy;
        send.MinHeight = 64;
        send.VerticalAlignment = VerticalAlignment.Stretch;

        async Task SubmitChatAsync()
        {
            if (_chatBusy) return;
            var text = (input.Text ?? "").Trim();
            if (text.Length == 0) return;
            input.Text = "";
            await SendChatAsync(text);
        }

        input.KeyDown += async (_, args) =>
        {
            if (args.Key != Key.Enter || args.KeyModifiers.HasFlag(KeyModifiers.Shift)) return;
            args.Handled = true;
            await SubmitChatAsync();
        };

        var promptRow = new WrapPanel { Orientation = Orientation.Horizontal };
        foreach (var prompt in new[]
                 {
                     ("今晚", "今晚七点半安排复习数学，九点去运动。"),
                     ("考试", "我这周日晚上七点半要到教一601考试，然后大概九点要去居酒屋。"),
                     ("调晚", "把写代码往后挪半小时。")
                 })
        {
            promptRow.Children.Add(Button(prompt.Item1, (_, _) =>
            {
                input.Text = prompt.Item2;
                input.Focus();
            }, secondary: true));
            if (promptRow.Children[^1] is Button button)
            {
                button.Margin = new Thickness(0, 0, 8, 6);
                button.Padding = new Thickness(9, 5);
                button.MinHeight = 30;
            }
        }
        var inputRow = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,96")
        };
        Grid.SetColumn(input, 0);
        Grid.SetColumn(send, 1);
        inputRow.Children.Add(input);
        inputRow.Children.Add(send);
        var composer = new StackPanel { Spacing = 8, Margin = new Thickness(0, 14, 0, 0) };
        composer.Children.Add(promptRow);
        composer.Children.Add(inputRow);
        var composerPanel = new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#dadce0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(12),
            Child = composer
        };
        Grid.SetRow(composerPanel, 2);
        root.Children.Add(composerPanel);

        return root;
    }

    private Control RenderChatTopStrip()
    {
        var completion = GetCompletionStats(_daySchedule);
        var visibleCount = _daySchedule.Blocks.Count(IsVisibleBlock);
        var hasKey = !string.IsNullOrWhiteSpace(_aiSettings.ApiKey);
        var row = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,Auto,Auto,Auto"),
            ColumnSpacing = 8
        };

        var pills = new WrapPanel { Orientation = Orientation.Horizontal };
        pills.Children.Add(ChatStatusPill($"{_focusDate:yyyy-MM-dd} 周{WeekdayText(_focusDate)}", "#1a73e8", "#e8f0fe", "#bfdbfe"));
        pills.Children.Add(ChatStatusPill($"{visibleCount} 个日程", "#334155", "#f8fafc", "#e2e8f0"));
        pills.Children.Add(ChatStatusPill($"完成 {completion.Done}/{completion.Total}", "#166534", "#f0fdf4", "#bbf7d0"));
        pills.Children.Add(ChatStatusPill(hasKey ? "AI 已配置" : "AI 未配置", hasKey ? "#166534" : "#991b1b", hasKey ? "#f0fdf4" : "#fef2f2", hasKey ? "#bbf7d0" : "#fecaca"));
        Grid.SetColumn(pills, 0);
        row.Children.Add(pills);

        var schedule = Button("打开日程", (_, _) =>
        {
            _activePage = "Schedule";
            _state.Preferences.StartupPage = "Schedule";
            RenderActivePage();
        }, secondary: true);
        var settings = Button("AI 设置", (_, _) =>
        {
            _activePage = "Ai";
            _state.Preferences.StartupPage = "Ai";
            RenderActivePage();
        }, secondary: !hasKey);
        var clear = Button("清空", (_, _) =>
        {
            ResetChatMessages();
            _pendingActions.Clear();
            SetStatus("对话已清空");
            RenderActivePage();
        }, secondary: true);
        Grid.SetColumn(schedule, 1);
        Grid.SetColumn(settings, 2);
        Grid.SetColumn(clear, 3);
        row.Children.Add(schedule);
        row.Children.Add(settings);
        row.Children.Add(clear);

        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#dadce0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(10),
            Child = row
        };
    }

    private void ResetChatMessages()
    {
        _chatMessages.Clear();
        _chatMessages.Add(new AiChatMessage
        {
            Role = "assistant",
            Content = "新的 Avalonia 桌面端已经启动。你可以直接说要调整的日程。"
        });
    }

    private static Control ChatStatusPill(string text, string color, string background, string border)
    {
        return new Border
        {
            Background = Brush(background),
            BorderBrush = Brush(border),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(9, 5),
            Margin = new Thickness(0, 0, 8, 4),
            Child = Text(text, 12, color, FontWeight.SemiBold)
        };
    }

    private Control RenderChatContextPanel()
    {
        var root = new StackPanel { Spacing = 10 };
        root.Children.Add(Text("今日上下文", 15, "#111827", FontWeight.SemiBold));
        root.Children.Add(Text($"{_focusDate:yyyy-MM-dd} 周{WeekdayText(_focusDate)}", 12, "#1a73e8", FontWeight.SemiBold));
        root.Children.Add(RenderChatNowNext());

        var blocks = _daySchedule.Blocks
            .Where(IsVisibleBlock)
            .OrderBy(block => block.StartMin)
            .ToList();
        if (blocks.Count == 0)
        {
            root.Children.Add(RulesEmptyState("当天还没有日程。"));
        }
        else
        {
            foreach (var block in blocks.Take(8))
            {
                root.Children.Add(RenderChatScheduleRow(block));
            }
            if (blocks.Count > 8)
            {
                root.Children.Add(Text($"还有 {blocks.Count - 8} 个日程", 12, "#64748b", FontWeight.SemiBold));
            }
        }

        var actions = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,*"),
            ColumnSpacing = 8
        };
        var create = Button("新建日程", async (_, _) =>
        {
            _activePage = "Schedule";
            _state.Preferences.StartupPage = "Schedule";
            await CreateScheduleBlockInDayViewAsync(ResolveDefaultNewBlockStartMin());
        });
        var settings = Button("AI 设置", (_, _) =>
        {
            _activePage = "Ai";
            _state.Preferences.StartupPage = "Ai";
            RenderActivePage();
        }, secondary: true);
        Grid.SetColumn(create, 0);
        Grid.SetColumn(settings, 1);
        actions.Children.Add(create);
        actions.Children.Add(settings);
        root.Children.Add(actions);

        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#dadce0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(14),
            Child = new ScrollViewer
            {
                Content = root,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto
            }
        };
    }

    private Control RenderChatNowNext()
    {
        var now = DateTime.Now.Hour * 60 + DateTime.Now.Minute;
        var visibleBlocks = _daySchedule.Blocks.Where(IsVisibleBlock).OrderBy(block => block.StartMin).ToList();
        var current = IsFocusDateToday()
            ? visibleBlocks.FirstOrDefault(block => block.StartMin <= now && now < block.EndMin)
            : null;
        var next = visibleBlocks.FirstOrDefault(block => block.StartMin >= (IsFocusDateToday() ? now : 0));
        var root = new StackPanel { Spacing = 6 };
        root.Children.Add(AiInfoRow("当前", current is null ? "无进行中日程" : $"{current.Start}-{current.End} {current.Title}"));
        root.Children.Add(AiInfoRow("下一个", next is null ? "无后续日程" : $"{next.Start}-{next.End} {next.Title}"));
        return new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10),
            Child = root
        };
    }

    private Control RenderChatScheduleRow(ScheduleBlock block)
    {
        var done = IsBlockCompleted(block);
        var accent = block.Type == ScheduleBlockType.Fixed ? "#1a73e8" : MonthEventAccent(block);
        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,*"),
            ColumnSpacing = 8
        };
        grid.Children.Add(new Border
        {
            Width = 4,
            Background = Brush(done ? "#cbd5e1" : accent),
            CornerRadius = new CornerRadius(3)
        });
        var text = new StackPanel { Spacing = 2 };
        text.Children.Add(Text($"{block.Start}-{block.End}", 11, done ? "#94a3b8" : "#475569", FontWeight.SemiBold));
        text.Children.Add(Text(block.Title, 12, done ? "#64748b" : "#111827", FontWeight.SemiBold));
        Grid.SetColumn(text, 1);
        grid.Children.Add(text);
        return new Border
        {
            Background = Brush(done ? "#f8fafc" : "#ffffff"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(9),
            Child = grid
        };
    }

    private async Task SendChatAsync(string text)
    {
        if (_chatBusy) return;
        _chatBusy = true;
        _chatMessages.Add(new AiChatMessage { Role = "user", Content = text });
        _chatMessages.Add(new AiChatMessage { Role = "assistant", Content = "思考中..." });
        RenderActivePage();

        try
        {
            var result = await _aiChatService.SendAsync(new AiChatRequest
            {
                Settings = _aiSettings,
                PlannerState = _state,
                FocusDate = _focusDate,
                CurrentSchedule = _daySchedule,
                Messages = [.. _chatMessages.Where(item => item.Content != "思考中...")]
            });

            _chatMessages[^1] = new AiChatMessage
            {
                Role = "assistant",
                Content = result.Text
            };
            _pendingActions.Clear();
            var targetDate = ScheduleActionDateResolver.ResolveSingleExplicitTargetDate(_focusDate, result.Actions);
            if (targetDate is not null)
            {
                _focusDate = targetDate.Value;
                _selectedRuntimeIds.Clear();
                RebuildSchedules();
            }

            _pendingActions.AddRange(result.Actions);
            SetStatus(result.Actions.Count > 0
                ? targetDate is null
                    ? $"AI 提取了 {result.Actions.Count} 条改动"
                    : $"AI 提取了 {result.Actions.Count} 条改动，已切换到 {targetDate:yyyy-MM-dd} 预览"
                : "AI 没有提取可直接应用的改动");
        }
        catch (Exception ex)
        {
            _chatMessages[^1] = new AiChatMessage
            {
                Role = "assistant",
                Content = $"请求失败：{ex.Message}"
            };
            _pendingActions.Clear();
            SetStatus("AI 对话失败，请检查 API 设置或网络。", error: true);
        }
        finally
        {
            _chatBusy = false;
            RenderActivePage();
        }
    }

    private Control BuildActionPreview()
    {
        var previewGroups = BuildActionPreviewGroups();
        var aggregatePreview = AggregateActionPreview(previewGroups);
        var affectedDates = previewGroups.Select(group => group.Date).Distinct().ToList();

        var root = new StackPanel { Spacing = 8 };
        root.Children.Add(RenderActionPreviewHeader(_pendingActions.Count, affectedDates, aggregatePreview.ApplicableCount));
        root.Children.Add(RenderActionPreviewSummary(aggregatePreview));

        var displayIndex = 1;
        foreach (var group in previewGroups)
        {
            if (previewGroups.Count > 1)
            {
                root.Children.Add(RenderActionPreviewDateHeader(group));
            }

            foreach (var item in group.Preview.Results)
            {
                var (label, color, background, border) = ActionStatusStyle(item.Status);
                var resultRow = new StackPanel { Spacing = 4 };
                resultRow.Children.Add(Text($"{displayIndex}. {label}", 12, color, FontWeight.SemiBold));
                resultRow.Children.Add(Text(item.Message, 12, "#334155"));
                var detail = ActionResultDetail(item);
                if (!string.IsNullOrWhiteSpace(detail))
                {
                    resultRow.Children.Add(Text(detail, 11, "#64748b", FontWeight.SemiBold));
                }
                root.Children.Add(new Border
                {
                    Background = Brush(background),
                    BorderBrush = Brush(border),
                    BorderThickness = new Thickness(1),
                    CornerRadius = new CornerRadius(7),
                    Padding = new Thickness(10),
                    Child = resultRow
                });
                displayIndex += 1;
            }
        }

        var actionRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        var applyButton = Button(ActionApplyButtonText(aggregatePreview.ApplicableCount, affectedDates.Count), (_, _) => ApplyPendingActions());
        applyButton.IsEnabled = aggregatePreview.ApplicableCount > 0;
        actionRow.Children.Add(applyButton);
        actionRow.Children.Add(Button("丢弃", (_, _) =>
        {
            _pendingActions.Clear();
            RenderActivePage();
        }, secondary: true));
        root.Children.Add(actionRow);
        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#dadce0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(14),
            Child = new ScrollViewer
            {
                Content = root,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto
            }
        };
    }

    private static Control RenderActionPreviewHeader(int actionCount, IReadOnlyList<DateOnly> affectedDates, int applicableCount)
    {
        var root = new StackPanel { Spacing = 5 };
        var titleRow = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,Auto"),
            ColumnSpacing = 8
        };
        var title = Text($"{actionCount} 条日程改动待确认", 15, "#111827", FontWeight.SemiBold);
        var badge = new Border
        {
            Background = Brush(applicableCount > 0 ? "#f0fdf4" : "#f8fafc"),
            BorderBrush = Brush(applicableCount > 0 ? "#bbf7d0" : "#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(8, 4),
            Child = Text($"{applicableCount} 可应用", 11, applicableCount > 0 ? "#166534" : "#64748b", FontWeight.SemiBold)
        };
        Grid.SetColumn(title, 0);
        Grid.SetColumn(badge, 1);
        titleRow.Children.Add(title);
        titleRow.Children.Add(badge);
        root.Children.Add(titleRow);

        if (affectedDates.Count > 0)
        {
            root.Children.Add(Text(ActionDateSummary(affectedDates), 12, "#475569", FontWeight.SemiBold));
        }

        return root;
    }

    private List<ActionPreviewDateGroup> BuildActionPreviewGroups()
    {
        return ScheduleActionDateResolver
            .GroupByTargetDate(_focusDate, _pendingActions)
            .Select(group =>
            {
                var schedule = group.Date == _daySchedule.Date ? _daySchedule : BuildScheduleForDate(group.Date);
                return new ActionPreviewDateGroup(group.Date, _scheduleActionService.Preview(schedule, group.Actions));
            })
            .ToList();
    }

    private static ScheduleActionPreview AggregateActionPreview(IEnumerable<ActionPreviewDateGroup> groups)
    {
        return new ScheduleActionPreview
        {
            Results = [.. groups.SelectMany(group => group.Preview.Results)]
        };
    }

    private static Control RenderActionPreviewDateHeader(ActionPreviewDateGroup group)
    {
        var conflictCount = group.Preview.Results.Count(item => item.Status == "conflict");
        var skippedCount = group.Preview.Results.Count(item => item.Status == "invalid" || item.Status == "skipped");
        var detailParts = new List<string> { $"{group.Preview.ApplicableCount}/{group.Preview.Results.Count} 可应用" };
        if (conflictCount > 0) detailParts.Add($"{conflictCount} 冲突");
        if (skippedCount > 0) detailParts.Add($"{skippedCount} 跳过");

        var row = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,Auto"),
            ColumnSpacing = 8
        };
        var title = Text(ActionDateLabel(group.Date), 12, "#1a73e8", FontWeight.SemiBold);
        var count = Text(string.Join(" · ", detailParts), 11, conflictCount > 0 ? "#991b1b" : "#64748b", FontWeight.SemiBold);
        Grid.SetColumn(title, 0);
        Grid.SetColumn(count, 1);
        row.Children.Add(title);
        row.Children.Add(count);
        return new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(9, 6),
            Child = row
        };
    }

    private void ApplyPendingActions()
    {
        var groups = ScheduleActionDateResolver.GroupByTargetDate(_focusDate, _pendingActions);
        if (groups.Count == 0) return;

        var aggregatePreview = AggregateActionPreview(BuildActionPreviewGroups());
        if (aggregatePreview.ApplicableCount <= 0) return;

        var targetDates = groups.Select(group => group.Date).Distinct().ToList();
        if (groups.Count == 1)
        {
            var targetDate = groups[0].Date;
            if (_focusDate != targetDate)
            {
                _focusDate = targetDate;
                RebuildSchedules();
            }
        }

        CaptureUndo(groups.Count == 1 ? "AI 改动" : "AI 跨日改动", targetDates);

        var changedCount = 0;
        var changedDates = new List<DateOnly>();
        var issues = new List<ScheduleIssue>();

        foreach (var group in groups)
        {
            var schedule = BuildScheduleForDate(group.Date);
            var result = _scheduleActionService.Apply(schedule, group.Actions);
            if (result.ChangedCount <= 0) continue;

            changedCount += result.ChangedCount;
            changedDates.Add(group.Date);
            var nextSchedule = result.NextSchedule.Clone();
            _state.DayOverrides[DateKey(group.Date)] = nextSchedule.Clone();
            SyncDayIntoWeekPlan(nextSchedule);
            issues.AddRange(ComputeManualScheduleIssues(nextSchedule));
        }

        if (changedCount == 0)
        {
            ClearUndo();
            SetStatus("没有可应用的 AI 改动", error: true);
            RenderActivePage();
            return;
        }

        _focusDate = changedDates[0];
        _selectedRuntimeIds.Clear();
        _pendingActions.Clear();
        RebuildSchedules();
        _activePage = "Schedule";
        _state.Preferences.StartupPage = "Schedule";

        var dateCount = changedDates.Distinct().Count();
        var issueCount = issues.Count;
        var suffix = issueCount > 0 ? $"；发现 {issueCount} 个时间问题" : "";
        var hasError = issues.Any(issue => issue.Level == ScheduleIssueLevel.Error);
        SetStatus($"已应用 {changedCount} 条 AI 改动，正在自动保存{suffix}", error: hasError);
        QueueStateAutosave($"已应用 {changedCount} 条 AI 改动，覆盖 {dateCount} 天并已自动保存{suffix}", hasError);
        RenderActivePage();
    }

    private static string ActionDateLabel(DateOnly date) => $"{date:yyyy-MM-dd} 周{WeekdayText(date)}";

    private static string ActionDateSummary(IReadOnlyList<DateOnly> dates)
    {
        if (dates.Count == 0) return "目标日期：当前日期";
        if (dates.Count == 1) return $"目标日期：{ActionDateLabel(dates[0])}";

        var shown = dates.Take(3).Select(ActionDateLabel).ToList();
        var suffix = dates.Count > shown.Count ? $" 等 {dates.Count} 天" : "";
        return $"将影响 {dates.Count} 天：{string.Join("、", shown)}{suffix}";
    }

    private static string ActionApplyButtonText(int applicableCount, int affectedDateCount)
    {
        return affectedDateCount > 1
            ? $"应用 {applicableCount} 项 / {affectedDateCount} 天"
            : $"应用 {applicableCount} 项";
    }

    private sealed record ActionPreviewDateGroup(DateOnly Date, ScheduleActionPreview Preview);

    private static Control RenderActionPreviewSummary(ScheduleActionPreview preview)
    {
        var conflictCount = preview.Results.Count(item => item.Status == "conflict");
        var invalidCount = preview.Results.Count(item => item.Status == "invalid" || item.Status == "skipped");
        var grid = new UniformGrid { Columns = 3 };
        grid.Children.Add(ActionSummaryTile("可应用", preview.ApplicableCount.ToString(), "#166534", "#f0fdf4", "#bbf7d0"));
        grid.Children.Add(ActionSummaryTile("冲突", conflictCount.ToString(), "#991b1b", "#fef2f2", "#fecaca"));
        grid.Children.Add(ActionSummaryTile("跳过", invalidCount.ToString(), "#92400e", "#fffbeb", "#fde68a"));
        return grid;
    }

    private static Control ActionSummaryTile(string label, string value, string color, string background, string border)
    {
        var root = new StackPanel { Spacing = 2 };
        root.Children.Add(Text(label, 11, "#64748b", FontWeight.SemiBold));
        root.Children.Add(Text(value, 18, color, FontWeight.SemiBold));
        return new Border
        {
            Background = Brush(background),
            BorderBrush = Brush(border),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(9),
            Margin = new Thickness(0, 0, 6, 0),
            Child = root
        };
    }

    private static string ActionResultDetail(ScheduleActionResult result)
    {
        var block = result.CreatedBlock ?? result.UpdatedBlock ?? result.RemovedBlock;
        if (block is not null)
        {
            return $"{block.Start}-{block.End} · {block.Title}";
        }

        if (result.ConflictingBlocks.Count > 0)
        {
            return "冲突：" + string.Join("、", result.ConflictingBlocks.Take(3).Select(block => $"{block.Start}-{block.End} {block.Title}"));
        }

        return "";
    }

    private static (string Label, string Color, string Background, string Border) ActionStatusStyle(string status)
    {
        return status switch
        {
            "applied" => ("可应用", "#166534", "#f0fdf4", "#bbf7d0"),
            "conflict" => ("时间冲突", "#991b1b", "#fef2f2", "#fecaca"),
            "invalid" => ("无法识别", "#92400e", "#fffbeb", "#fde68a"),
            _ => ("已跳过", "#475569", "#f8fafc", "#e2e8f0")
        };
    }

    private Control RenderSchedule()
    {
        var panelCollapsed = _state.Preferences.SchedulePanelCollapsed;
        var root = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions(panelCollapsed ? "0,*" : "240,*"),
            ColumnSpacing = panelCollapsed ? 0 : 16
        };

        if (!panelCollapsed)
        {
            var leftRail = new StackPanel { Spacing = 12 };
            leftRail.Children.Add(RenderMiniMonthCard());
            leftRail.Children.Add(RenderNowCard());
            leftRail.Children.Add(RenderFocusDayAgendaCard());
            leftRail.Children.Add(RenderSelectionInspector());
            var leftScroller = new ScrollViewer
            {
                Content = leftRail,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto
            };
            leftScroller.Loaded += (_, _) =>
            {
                Dispatcher.UIThread.Post(() => leftScroller.Offset = new Vector(0, 0), DispatcherPriority.Background);
            };
            Grid.SetColumn(leftScroller, 0);
            root.Children.Add(leftScroller);
        }

        var main = new Grid
        {
            RowDefinitions = new RowDefinitions("Auto,Auto,Auto,*"),
            RowSpacing = 12
        };

        var toolbar = RenderScheduleToolbar();
        Grid.SetRow(toolbar, 0);
        main.Children.Add(toolbar);

        var summary = RenderScheduleSummaryStrip();
        Grid.SetRow(summary, 1);
        main.Children.Add(summary);

        var statusStack = new StackPanel { Spacing = 8 };
        if (_selectedRuntimeIds.Count > 0)
        {
            statusStack.Children.Add(RenderSelectedActionBar());
        }

        var issues = GetScheduleIssuesForDisplay();
        if (issues.Count > 0)
        {
            statusStack.Children.Add(RenderScheduleIssues(issues));
        }

        if (statusStack.Children.Count > 0)
        {
            Grid.SetRow(statusStack, 2);
            main.Children.Add(statusStack);
        }

        var calendar = _scheduleView switch
        {
            ScheduleViewMode.Month => RenderMonthCalendar(),
            ScheduleViewMode.Week => RenderWeekCalendar(),
            _ => RenderDayCalendar()
        };
        Grid.SetRow(calendar, 3);
        main.Children.Add(calendar);
        Grid.SetColumn(main, 1);
        root.Children.Add(main);
        return root;
    }

    private Control RenderSelectedActionBar()
    {
        var selected = _daySchedule.Blocks
            .Where(block => _selectedRuntimeIds.Contains(block.RuntimeId) && IsVisibleBlock(block))
            .OrderBy(block => block.StartMin)
            .ToList();
        var editableCount = selected.Count(block => block.Editable);
        var range = selected.Count == 0 ? "" : $"{TimeText.ToTime(selected.Min(block => block.StartMin))}-{TimeText.ToTime(selected.Max(block => block.EndMin))}";

        var text = new StackPanel { Spacing = 2 };
        text.Children.Add(Text($"已选中 {selected.Count} 个日程", 13, "#1d4ed8", FontWeight.SemiBold));
        text.Children.Add(Text(editableCount == 0
            ? "选中的日程不可批量编辑。"
            : $"范围 {range}。拖动可批量移动，Ctrl 点按增减选择。",
            12,
            editableCount == 0 ? "#64748b" : "#334155"));

        var actions = BuildSelectionActionButtons(editableCount > 0, compact: false);
        var clear = ToolbarButton("取消选择", (_, _) =>
        {
            _selectedRuntimeIds.Clear();
            RenderActivePage();
        }, secondary: true);
        var delete = ToolbarButton("删除", async (_, _) => await DeleteSelectedAsync(), secondary: false);
        delete.Background = Brush("#dc2626");
        delete.Foreground = Brush("#ffffff");
        delete.BorderBrush = Brush("#dc2626");
        delete.IsEnabled = editableCount > 0;
        AddSelectionAction(actions, clear);
        AddSelectionAction(actions, delete, 0);
        actions.HorizontalAlignment = HorizontalAlignment.Right;

        Control content;
        if (ResolveScheduleCalendarViewportWidth() < 680)
        {
            var stack = new StackPanel { Spacing = 8 };
            actions.HorizontalAlignment = HorizontalAlignment.Left;
            stack.Children.Add(text);
            stack.Children.Add(actions);
            content = stack;
        }
        else
        {
            actions.MaxWidth = 450;
            var grid = new Grid
            {
                ColumnDefinitions = new ColumnDefinitions("*,Auto"),
                ColumnSpacing = 14
            };
            Grid.SetColumn(text, 0);
            Grid.SetColumn(actions, 1);
            grid.Children.Add(text);
            grid.Children.Add(actions);
            content = grid;
        }

        return new Border
        {
            Background = Brush("#eff6ff"),
            BorderBrush = Brush("#bfdbfe"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(12, 9),
            Child = content
        };
    }

    private WrapPanel BuildSelectionActionButtons(bool enabled, bool compact)
    {
        var actions = new WrapPanel { Orientation = Orientation.Horizontal };
        foreach (var minutes in new[] { 5, 15, 30 })
        {
            var up = compact
                ? Button($"↑{minutes}", (_, _) => MoveSelected(-minutes), secondary: true)
                : ToolbarButton($"上移 {minutes}", (_, _) => MoveSelected(-minutes), secondary: true);
            var down = compact
                ? Button($"↓{minutes}", (_, _) => MoveSelected(minutes), secondary: true)
                : ToolbarButton($"下移 {minutes}", (_, _) => MoveSelected(minutes), secondary: true);
            up.IsEnabled = down.IsEnabled = enabled;
            AddSelectionAction(actions, up);
            AddSelectionAction(actions, down);
        }

        return actions;
    }

    private static void AddSelectionAction(WrapPanel actions, Control control, double right = 8)
    {
        control.Margin = new Thickness(0, 0, right, 8);
        control.VerticalAlignment = VerticalAlignment.Center;
        actions.Children.Add(control);
    }

    private Control RenderScheduleSummaryStrip()
    {
        var visible = _daySchedule.Blocks.Where(IsVisibleBlock).ToList();
        var completion = GetCompletionStats(_daySchedule);
        var issues = GetScheduleIssuesForDisplay();
        var selected = _selectedRuntimeIds.Count;
        var grid = new WrapPanel { Orientation = Orientation.Horizontal };
        grid.Children.Add(ScheduleSummaryChip("日程", visible.Count.ToString(), "#1a73e8", "#e8f0fe", "#bfdbfe"));
        grid.Children.Add(ScheduleSummaryChip("固定", visible.Count(block => block.Type == ScheduleBlockType.Fixed).ToString(), "#0f766e", "#f0fdfa", "#99f6e4"));
        grid.Children.Add(ScheduleSummaryChip("任务", visible.Count(block => block.Type == ScheduleBlockType.Task).ToString(), "#7c3aed", "#f5f3ff", "#ddd6fe"));
        grid.Children.Add(ScheduleSummaryChip("完成", $"{completion.Percent}%", "#166534", "#f0fdf4", "#bbf7d0"));
        grid.Children.Add(ScheduleSummaryChip(selected > 0 ? "已选" : "问题", selected > 0 ? selected.ToString() : issues.Count.ToString(), selected > 0 || issues.Count == 0 ? "#334155" : "#991b1b", selected > 0 || issues.Count == 0 ? "#f8fafc" : "#fef2f2", selected > 0 || issues.Count == 0 ? "#e2e8f0" : "#fecaca"));
        return grid;
    }

    private static Control ScheduleSummaryChip(string label, string value, string color, string background, string border)
    {
        var row = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,Auto"),
            ColumnSpacing = 8
        };
        var labelText = Text(label, 12, "#64748b", FontWeight.SemiBold);
        var valueText = Text(value, 13, color, FontWeight.SemiBold);
        Grid.SetColumn(labelText, 0);
        Grid.SetColumn(valueText, 1);
        row.Children.Add(labelText);
        row.Children.Add(valueText);
        return new Border
        {
            Background = Brush(background),
            BorderBrush = Brush(border),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(9, 6),
            Margin = new Thickness(0, 0, 6, 6),
            MinWidth = 90,
            Child = row
        };
    }

    private Control RenderScheduleToolbar()
    {
        var viewportWidth = ResolveScheduleCalendarViewportWidth();
        var singleLine = viewportWidth >= 880;

        var nav = new WrapPanel
        {
            Orientation = Orientation.Horizontal,
            VerticalAlignment = VerticalAlignment.Center
        };
        void AddNav(Control control, double right = 8)
        {
            control.Margin = new Thickness(0, 0, right, 0);
            control.VerticalAlignment = VerticalAlignment.Center;
            nav.Children.Add(control);
        }

        AddNav(ToolbarButton("今天", (_, _) => GoToToday(), secondary: true));
        AddNav(ToolbarButton(_state.Preferences.SchedulePanelCollapsed ? "展开日历" : "收起日历", (_, _) => ToggleSchedulePanel(), secondary: true));
        AddNav(BuildScheduleNavGroup(), 0);

        var titleStack = new StackPanel
        {
            Spacing = 1,
            MinWidth = 120,
            VerticalAlignment = VerticalAlignment.Center
        };
        titleStack.Children.Add(MonthSingleLineText(SchedulePeriodTitle(), 20, "#202124", FontWeight.SemiBold));
        titleStack.Children.Add(MonthSingleLineText(SchedulePeriodSubtitle(), 11, "#5f6368", FontWeight.SemiBold));

        var actions = BuildScheduleToolbarActions(singleLine);
        Control content;
        if (singleLine)
        {
            var grid = new Grid
            {
                ColumnDefinitions = new ColumnDefinitions("Auto,14,*,14,Auto"),
                MinHeight = 38
            };
            Grid.SetColumn(nav, 0);
            Grid.SetColumn(titleStack, 2);
            Grid.SetColumn(actions, 4);
            grid.Children.Add(nav);
            grid.Children.Add(titleStack);
            grid.Children.Add(actions);
            content = grid;
        }
        else
        {
            var root = new StackPanel { Spacing = 8 };
            var top = new Grid
            {
                ColumnDefinitions = new ColumnDefinitions("Auto,*"),
                ColumnSpacing = 10
            };
            Grid.SetColumn(nav, 0);
            Grid.SetColumn(titleStack, 1);
            top.Children.Add(nav);
            top.Children.Add(titleStack);
            actions.HorizontalAlignment = HorizontalAlignment.Left;
            root.Children.Add(top);
            root.Children.Add(actions);
            content = root;
        }

        return new Border
        {
            Background = Brush("#00ffffff"),
            Padding = new Thickness(0, 0, 0, 2),
            Child = content
        };
    }

    private WrapPanel BuildScheduleToolbarActions(bool alignRight)
    {
        var actions = new WrapPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = alignRight ? HorizontalAlignment.Right : HorizontalAlignment.Left,
            VerticalAlignment = VerticalAlignment.Center
        };
        void AddAction(Control control, double right = 8)
        {
            control.Margin = new Thickness(0, 0, right, 0);
            control.VerticalAlignment = VerticalAlignment.Center;
            actions.Children.Add(control);
        }

        AddAction(BuildScheduleViewSwitcher(), 10);
        AddAction(ToolbarButton("新建", async (_, _) =>
        {
            await CreateScheduleBlockInDayViewAsync(ResolveDefaultNewBlockStartMin());
        }));
        AddAction(ToolbarButton("提醒", async (_, _) =>
        {
            var reminder = _reminderService.Generate(_daySchedule);
            await (Clipboard?.SetTextAsync(reminder) ?? Task.CompletedTask);
            SetStatus("提醒已复制到剪贴板");
        }, secondary: true));
        if (HasCurrentDayOverride())
        {
            AddAction(ToolbarButton("恢复当天", (_, _) => ClearCurrentDayOverride(), secondary: true), 0);
        }

        return actions;
    }

    private Button ToolbarButton(string text, EventHandler<RoutedEventArgs> onClick, bool secondary = false)
    {
        var button = Button(text, onClick, secondary: secondary);
        button.MinHeight = 34;
        button.Padding = new Thickness(12, 7);
        button.FontWeight = FontWeight.SemiBold;
        return button;
    }

    private Control BuildScheduleNavGroup()
    {
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 0 };
        row.Children.Add(FlatToolbarButton("←", (_, _) => ShiftSchedulePeriod(-1), $"上一{ScheduleViewLabel(_scheduleView)}"));
        row.Children.Add(new Border
        {
            Width = 1,
            Height = 22,
            Background = Brush("#dadce0"),
            VerticalAlignment = VerticalAlignment.Center
        });
        row.Children.Add(FlatToolbarButton("→", (_, _) => ShiftSchedulePeriod(1), $"下一{ScheduleViewLabel(_scheduleView)}"));
        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#dadce0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            ClipToBounds = true,
            Child = row
        };
    }

    private Button FlatToolbarButton(string text, EventHandler<RoutedEventArgs> onClick, string? tip = null)
    {
        var button = new Button
        {
            Content = CenteredIconText(text, 15, "#3c4043"),
            MinHeight = 34,
            Padding = new Thickness(13, 7),
            Background = Brush("#00ffffff"),
            Foreground = Brush("#3c4043"),
            BorderBrush = Brush("#00ffffff"),
            BorderThickness = new Thickness(0),
            CornerRadius = new CornerRadius(0),
            HorizontalContentAlignment = HorizontalAlignment.Center,
            VerticalContentAlignment = VerticalAlignment.Center
        };
        if (!string.IsNullOrWhiteSpace(tip))
        {
            ToolTip.SetTip(button, tip);
        }
        button.Click += onClick;
        return button;
    }

    private Control BuildScheduleViewSwitcher()
    {
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 0 };
        row.Children.Add(ScheduleViewButton("月", ScheduleViewMode.Month));
        row.Children.Add(ScheduleViewButton("周", ScheduleViewMode.Week));
        row.Children.Add(ScheduleViewButton("日", ScheduleViewMode.Day));
        return new Border
        {
            Background = Brush("#f8fafd"),
            BorderBrush = Brush("#dadce0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            ClipToBounds = true,
            Child = row
        };
    }

    private Button ScheduleViewButton(string label, ScheduleViewMode mode)
    {
        var active = _scheduleView == mode;
        var button = Button(label, (_, _) =>
        {
            SwitchScheduleView(mode);
        }, secondary: !active);
        button.MinHeight = 34;
        button.Padding = new Thickness(14, 7);
        button.Background = Brush(active ? "#e8f0fe" : "#00ffffff");
        button.Foreground = Brush(active ? "#1967d2" : "#3c4043");
        button.BorderBrush = Brush("#00ffffff");
        button.BorderThickness = new Thickness(0);
        button.CornerRadius = new CornerRadius(0);
        ToolTip.SetTip(button, $"{ScheduleViewLabel(mode)}视图 Ctrl+{ScheduleViewShortcutNumber(mode)}");
        return button;
    }

    private void SwitchScheduleView(ScheduleViewMode mode)
    {
        SetScheduleView(mode, savePreference: true);
        _selectedRuntimeIds.Clear();
        RebuildSchedules();
        RenderActivePage();
    }

    private void SetScheduleView(ScheduleViewMode mode, bool savePreference)
    {
        _scheduleView = mode;
        _state.Preferences.ScheduleView = mode.ToString();
        if (savePreference)
        {
            QueueStateAutosave($"已切换到{ScheduleViewLabel(mode)}视图，并已保存偏好");
        }
    }

    private static ScheduleViewMode ParseScheduleViewMode(string? value)
    {
        return Enum.TryParse<ScheduleViewMode>(value, ignoreCase: true, out var mode)
            ? mode
            : ScheduleViewMode.Week;
    }

    private static string ScheduleViewLabel(ScheduleViewMode mode)
    {
        return mode switch
        {
            ScheduleViewMode.Month => "月",
            ScheduleViewMode.Week => "周",
            _ => "日"
        };
    }

    private static int ScheduleViewShortcutNumber(ScheduleViewMode mode)
    {
        return mode switch
        {
            ScheduleViewMode.Month => 1,
            ScheduleViewMode.Week => 2,
            _ => 3
        };
    }

    private string SchedulePeriodTitle()
    {
        return _scheduleView switch
        {
            ScheduleViewMode.Month => $"{_focusDate:yyyy 年 M 月}",
            ScheduleViewMode.Week => WeekTitle(),
            _ => $"{_focusDate:yyyy 年 M 月 d 日}"
        };
    }

    private string SchedulePeriodSubtitle()
    {
        return _scheduleView switch
        {
            ScheduleViewMode.Month => $"{_focusDate:yyyy-MM}",
            ScheduleViewMode.Week => $"周视图 · 聚焦周{WeekdayText(_focusDate)}",
            _ => $"周{WeekdayText(_focusDate)} · 日视图"
        };
    }

    private string WeekTitle()
    {
        var start = TimeText.MondayOfWeek(_focusDate);
        var end = start.AddDays(6);
        return start.Year == end.Year && start.Month == end.Month
            ? $"{start:yyyy 年 M 月 d 日} - {end:d 日}"
            : $"{start:yyyy 年 M 月 d 日} - {end:yyyy 年 M 月 d 日}";
    }

    private void ShiftSchedulePeriod(int direction)
    {
        _focusDate = _scheduleView switch
        {
            ScheduleViewMode.Month => _focusDate.AddMonths(direction),
            ScheduleViewMode.Week => _focusDate.AddDays(direction * 7),
            _ => _focusDate.AddDays(direction)
        };
        _selectedRuntimeIds.Clear();
        RebuildSchedules();
        RenderActivePage();
    }

    private void GoToToday()
    {
        _focusDate = DateOnly.FromDateTime(DateTime.Today);
        _selectedRuntimeIds.Clear();
        RebuildSchedules();
        RenderActivePage();
    }

    private void ToggleSchedulePanel()
    {
        _state.Preferences.SchedulePanelCollapsed = !_state.Preferences.SchedulePanelCollapsed;
        QueueStateAutosave(_state.Preferences.SchedulePanelCollapsed ? "日程左栏已收起，并已保存偏好" : "日程左栏已展开，并已保存偏好");
        RenderActivePage();
    }

    private bool HasCurrentDayOverride() => _state.DayOverrides.ContainsKey(DateKey(_focusDate));

    private List<ScheduleIssue> GetScheduleIssuesForDisplay()
    {
        return _daySchedule.Issues
            .Concat(ComputeManualScheduleIssues(_daySchedule))
            .GroupBy(issue => $"{issue.Level}:{issue.Code}:{issue.Message}")
            .Select(group => group.First())
            .ToList();
    }

    private static List<ScheduleIssue> ComputeManualScheduleIssues(DaySchedule schedule)
    {
        var issues = new List<ScheduleIssue>();
        var blocks = schedule.Blocks
            .Where(IsVisibleBlock)
            .OrderBy(block => block.StartMin)
            .ToList();

        foreach (var block in blocks)
        {
            if (block.StartMin < schedule.DayStartMin || block.EndMin > schedule.DayEndMin || block.EndMin <= block.StartMin)
            {
                issues.Add(new ScheduleIssue
                {
                    Level = ScheduleIssueLevel.Error,
                    Code = "manual_range",
                    Message = $"{block.Title} 的时间范围无效或超出当天范围"
                });
            }
        }

        for (var i = 0; i < blocks.Count; i++)
        {
            for (var j = i + 1; j < blocks.Count; j++)
            {
                var left = blocks[i];
                var right = blocks[j];
                if (left.StartMin < right.EndMin && right.StartMin < left.EndMin)
                {
                    issues.Add(new ScheduleIssue
                    {
                        Level = ScheduleIssueLevel.Error,
                        Code = "manual_overlap",
                        Message = $"{left.Title} 与 {right.Title} 时间重叠"
                    });
                }
            }
        }

        return issues;
    }

    private static Control RenderScheduleIssues(IReadOnlyList<ScheduleIssue> issues)
    {
        var hasError = issues.Any(issue => issue.Level == ScheduleIssueLevel.Error);
        var root = new StackPanel { Spacing = 5 };
        root.Children.Add(Text(hasError ? "需要处理的时间问题" : "日程提示", 13, hasError ? "#991b1b" : "#92400e", FontWeight.SemiBold));
        foreach (var issue in issues.Take(4))
        {
            root.Children.Add(Text(issue.Message, 12, hasError ? "#7f1d1d" : "#78350f"));
        }
        if (issues.Count > 4)
        {
            root.Children.Add(Text($"还有 {issues.Count - 4} 条问题", 12, hasError ? "#7f1d1d" : "#78350f"));
        }

        return new Border
        {
            Background = Brush(hasError ? "#fef2f2" : "#fffbeb"),
            BorderBrush = Brush(hasError ? "#fecaca" : "#fde68a"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(12, 9),
            Child = root
        };
    }

    private Control RenderMiniMonthCard()
    {
        var first = new DateOnly(_focusDate.Year, _focusDate.Month, 1);
        var last = first.AddMonths(1).AddDays(-1);
        var daysInMonth = DateTime.DaysInMonth(_focusDate.Year, _focusDate.Month);
        var startOffset = (int)first.DayOfWeek;
        var monthSchedules = BuildMonthSchedules(first, last);

        var root = new StackPanel { Spacing = 10 };
        var head = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto") };
        var prev = ToolbarButton("←", (_, _) =>
        {
            _focusDate = _focusDate.AddMonths(-1);
            _selectedRuntimeIds.Clear();
            RebuildSchedules();
            RenderActivePage();
        }, secondary: true);
        ToolTip.SetTip(prev, "上个月");
        var next = ToolbarButton("→", (_, _) =>
        {
            _focusDate = _focusDate.AddMonths(1);
            _selectedRuntimeIds.Clear();
            RebuildSchedules();
            RenderActivePage();
        }, secondary: true);
        ToolTip.SetTip(next, "下个月");
        var label = Text($"{_focusDate:yyyy 年 M 月}", 15, "#111827", FontWeight.SemiBold);
        label.HorizontalAlignment = HorizontalAlignment.Center;
        Grid.SetColumn(prev, 0);
        Grid.SetColumn(label, 1);
        Grid.SetColumn(next, 2);
        head.Children.Add(prev);
        head.Children.Add(label);
        head.Children.Add(next);
        root.Children.Add(head);

        var quick = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,*"),
            ColumnSpacing = 8
        };
        var today = Button("今天", (_, _) => GoToToday(), secondary: true);
        var month = Button("月视图", (_, _) =>
        {
            SetScheduleView(ScheduleViewMode.Month, savePreference: true);
            _selectedRuntimeIds.Clear();
            RebuildSchedules();
            RenderActivePage();
        }, secondary: true);
        foreach (var button in new[] { today, month })
        {
            button.Padding = new Thickness(8, 5);
            button.MinHeight = 30;
        }
        Grid.SetColumn(today, 0);
        Grid.SetColumn(month, 1);
        quick.Children.Add(today);
        quick.Children.Add(month);
        root.Children.Add(quick);

        var grid = new UniformGrid { Columns = 7 };
        foreach (var day in new[] { "日", "一", "二", "三", "四", "五", "六" })
        {
            var weekday = Text(day, 11, "#64748b", FontWeight.SemiBold);
            weekday.HorizontalAlignment = HorizontalAlignment.Center;
            grid.Children.Add(weekday);
        }

        for (var i = 0; i < startOffset; i++)
        {
            grid.Children.Add(new Border());
        }

        for (var day = 1; day <= daysInMonth; day++)
        {
            var date = new DateOnly(_focusDate.Year, _focusDate.Month, day);
            var isSelected = date == _focusDate;
            var isToday = date == DateOnly.FromDateTime(DateTime.Today);
            var blockCount = monthSchedules.TryGetValue(date, out var schedule)
                ? schedule.Blocks.Count(IsVisibleBlock)
                : 0;
            var button = new Button
            {
                Content = BuildMiniMonthDayContent(day, blockCount, isSelected, isToday),
                Width = 30,
                Height = 30,
                MinHeight = 30,
                Margin = new Thickness(1),
                Padding = new Thickness(0),
                FontSize = 12,
                Background = Brush(isSelected ? "#1a73e8" : "#00ffffff"),
                Foreground = Brush(isSelected ? "#ffffff" : isToday ? "#1a73e8" : "#202124"),
                BorderBrush = Brush(isSelected || isToday ? "#1a73e8" : "#00ffffff"),
                BorderThickness = new Thickness(isSelected || isToday ? 1 : 0),
                CornerRadius = new CornerRadius(15),
                HorizontalContentAlignment = HorizontalAlignment.Center,
                VerticalContentAlignment = VerticalAlignment.Center
            };
            if (blockCount > 0)
            {
                ToolTip.SetTip(button, $"{blockCount} 个日程");
            }
            button.Click += (_, _) =>
            {
                _focusDate = date;
                _selectedRuntimeIds.Clear();
                RebuildSchedules();
                RenderActivePage();
            };
            grid.Children.Add(button);
        }

        root.Children.Add(grid);
        return Card("日历", root);
    }

    private static Control BuildMiniMonthDayContent(int day, int blockCount, bool selected, bool today)
    {
        var root = new StackPanel
        {
            Spacing = 1,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
        var text = Text(day.ToString(), 12, selected ? "#ffffff" : today ? "#1a73e8" : "#202124", FontWeight.SemiBold);
        text.HorizontalAlignment = HorizontalAlignment.Center;
        root.Children.Add(text);
        root.Children.Add(new Border
        {
            Width = 4,
            Height = 4,
            CornerRadius = new CornerRadius(2),
            Background = Brush(blockCount > 0 ? selected ? "#ffffff" : "#1a73e8" : "#00ffffff"),
            HorizontalAlignment = HorizontalAlignment.Center
        });
        return root;
    }

    private Control RenderSelectionInspector()
    {
        var selected = _daySchedule.Blocks
            .Where(block => _selectedRuntimeIds.Contains(block.RuntimeId) && IsVisibleBlock(block))
            .OrderBy(block => block.StartMin)
            .ToList();
        var completion = GetCompletionStats(_daySchedule);

        var root = new StackPanel { Spacing = 10 };
        if (selected.Count == 0)
        {
            root.Children.Add(Text("快捷操作", 18, "#111827", FontWeight.SemiBold));
            root.Children.Add(Text($"当天完成 {completion.Done}/{completion.Total}，{completion.Percent}%", 12, "#2563eb", FontWeight.SemiBold));
            root.Children.Add(Text(EmptySelectionHint(), 12, "#64748b"));

            var actions = new Grid
            {
                ColumnDefinitions = new ColumnDefinitions("*,*"),
                RowDefinitions = new RowDefinitions("Auto,Auto"),
                ColumnSpacing = 8,
                RowSpacing = 8
            };
            var create = Button("新建", async (_, _) => await CreateScheduleBlockAsync(ResolveDefaultNewBlockStartMin()));
            var openDay = Button("日视图", (_, _) =>
            {
                SetScheduleView(ScheduleViewMode.Day, savePreference: true);
                RebuildSchedules();
                RenderActivePage();
            }, secondary: true);
            var reminder = Button("复制提醒", async (_, _) =>
            {
                var text = _reminderService.Generate(_daySchedule);
                await (Clipboard?.SetTextAsync(text) ?? Task.CompletedTask);
                SetStatus("提醒已复制到剪贴板");
            }, secondary: true);
            var restore = Button("恢复当天", (_, _) => ClearCurrentDayOverride(), secondary: true);
            restore.IsEnabled = HasCurrentDayOverride();
            Grid.SetColumn(create, 0);
            Grid.SetColumn(openDay, 1);
            Grid.SetRow(reminder, 1);
            Grid.SetColumn(reminder, 0);
            Grid.SetRow(restore, 1);
            Grid.SetColumn(restore, 1);
            actions.Children.Add(create);
            actions.Children.Add(openDay);
            actions.Children.Add(reminder);
            actions.Children.Add(restore);
            root.Children.Add(actions);

            return Card("操作", root);
        }

        root.Children.Add(Text($"已选中 {selected.Count} 个", 18, "#111827", FontWeight.SemiBold));
        root.Children.Add(Text("拖动任意选中日程可批量移动，Ctrl 点按增减选择。", 12, "#64748b"));

        var buttons = BuildSelectionActionButtons(selected.Any(block => block.Editable), compact: true);
        var clear = Button("取消选择", (_, _) =>
        {
            _selectedRuntimeIds.Clear();
            RenderActivePage();
        }, secondary: true);
        var delete = Button("删除", async (_, _) => await DeleteSelectedAsync(), danger: true);
        delete.IsEnabled = selected.Any(block => block.Editable);
        AddSelectionAction(buttons, clear);
        AddSelectionAction(buttons, delete, 0);
        root.Children.Add(buttons);

        foreach (var block in selected.Take(5))
        {
            root.Children.Add(new Border
            {
                Background = Brush("#f8fafc"),
                BorderBrush = Brush("#e2e8f0"),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(7),
                Padding = new Thickness(10),
                Child = Text($"{block.Start}-{block.End}\n{block.Title}", 12, "#334155", FontWeight.SemiBold)
            });
        }

        if (selected.Count > 5)
        {
            root.Children.Add(Text($"还有 {selected.Count - 5} 个选中项", 12, "#64748b"));
        }

        return Card("批量调整", root);
    }

    private string EmptySelectionHint()
    {
        return _scheduleView switch
        {
            ScheduleViewMode.Month => "单击日期查看当天日程，拖动事件可改到其他日期。",
            ScheduleViewMode.Week => "拖动空白创建时间段，拖动事件可改时间或日期。",
            _ => "拖动空白可框选多个日程，右键选中项可批量移动或删除。"
        };
    }

    private Control RenderFocusDayAgendaCard()
    {
        var root = new StackPanel { Spacing = 8 };
        var head = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto,Auto"), ColumnSpacing = 6 };
        var title = Text($"{_focusDate:MM-dd} 周{WeekdayText(_focusDate)}", 15, "#111827", FontWeight.SemiBold);
        var add = Button("新建", async (_, _) => await CreateScheduleBlockAsync(ResolveDefaultNewBlockStartMin()), secondary: true);
        var open = Button("打开", (_, _) =>
        {
            SetScheduleView(ScheduleViewMode.Day, savePreference: true);
            _selectedRuntimeIds.Clear();
            RebuildSchedules();
            RenderActivePage();
        }, secondary: true);
        add.Padding = new Thickness(8, 4);
        add.MinHeight = 28;
        open.Padding = new Thickness(8, 4);
        open.MinHeight = 28;
        Grid.SetColumn(title, 0);
        Grid.SetColumn(add, 1);
        Grid.SetColumn(open, 2);
        head.Children.Add(title);
        head.Children.Add(add);
        head.Children.Add(open);
        root.Children.Add(head);

        var blocks = _daySchedule.Blocks
            .Where(IsVisibleBlock)
            .OrderBy(block => block.StartMin)
            .ToList();
        if (blocks.Count == 0)
        {
            root.Children.Add(new Border
            {
                Background = Brush("#f8fafc"),
                BorderBrush = Brush("#e2e8f0"),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(7),
                Padding = new Thickness(10),
                Child = Text("当天没有日程。", 12, "#64748b")
            });
        }
        else
        {
            foreach (var block in blocks.Take(7))
            {
                root.Children.Add(BuildFocusDayAgendaRow(block));
            }
            if (blocks.Count > 7)
            {
                root.Children.Add(Text($"还有 {blocks.Count - 7} 个，点击“打开”查看全部。", 11, "#64748b", FontWeight.SemiBold));
            }
        }

        return Card("选中日期", root);
    }

    private Control BuildFocusDayAgendaRow(ScheduleBlock block)
    {
        var done = IsBlockCompleted(block);
        var selected = _selectedRuntimeIds.Contains(block.RuntimeId);
        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,*"),
            ColumnSpacing = 8
        };
        var check = new Button
        {
            Content = CenteredIconText(done ? "✓" : "", 12, done ? "#ffffff" : "#64748b"),
            Width = 22,
            Height = 22,
            MinHeight = 22,
            Padding = new Thickness(0),
            Background = Brush(done ? "#22c55e" : "#ffffff"),
            Foreground = Brush(done ? "#ffffff" : "#64748b"),
            BorderBrush = Brush(done ? "#16a34a" : "#cbd5e1"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(11),
            HorizontalContentAlignment = HorizontalAlignment.Center,
            VerticalContentAlignment = VerticalAlignment.Center
        };
        check.Click += async (_, _) => await ToggleBlockCompleteAsync(block);

        var text = new StackPanel { Spacing = 1 };
        text.Children.Add(Text($"{block.Start}-{block.End}", 11, done ? "#94a3b8" : "#475569", FontWeight.SemiBold));
        text.Children.Add(Text(block.Title, 12, done ? "#64748b" : "#111827", FontWeight.SemiBold));
        Grid.SetColumn(check, 0);
        Grid.SetColumn(text, 1);
        grid.Children.Add(check);
        grid.Children.Add(text);

        var row = new Border
        {
            Background = Brush(selected ? "#e8f0fe" : done ? "#f8fafc" : "#ffffff"),
            BorderBrush = Brush(selected ? "#1a73e8" : "#e2e8f0"),
            BorderThickness = new Thickness(selected ? 2 : 1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(8),
            Opacity = done ? 0.75 : 1,
            Cursor = new Cursor(StandardCursorType.Hand),
            Child = grid
        };
        row.Tapped += (_, args) =>
        {
            QueueFocusDayAgendaSelection(block.RuntimeId);
            args.Handled = true;
        };
        row.DoubleTapped += async (_, args) =>
        {
            Interlocked.Increment(ref _agendaSelectVersion);
            args.Handled = true;
            await EditScheduleBlockAsync(block);
        };

        var menu = new ContextMenu();
        var complete = new MenuItem { Header = done ? "取消完成" : "标记完成" };
        complete.Click += async (_, _) => await ToggleBlockCompleteAsync(block);
        var edit = new MenuItem { Header = "编辑" };
        edit.Click += async (_, _) => await EditScheduleBlockAsync(block);
        var openDay = new MenuItem { Header = "打开日视图" };
        openDay.Click += (_, _) =>
        {
            SetScheduleView(ScheduleViewMode.Day, savePreference: true);
            _selectedRuntimeIds.Clear();
            RebuildSchedules();
            RenderActivePage();
        };
        menu.Items.Add(complete);
        menu.Items.Add(edit);
        menu.Items.Add(openDay);
        AddDaySelectionContextMenuItems(menu, block);
        row.ContextMenu = menu;

        return row;
    }

    private void QueueFocusDayAgendaSelection(string runtimeId)
    {
        var version = Interlocked.Increment(ref _agendaSelectVersion);
        _ = Task.Run(async () =>
        {
            await Task.Delay(170);
            await Dispatcher.UIThread.InvokeAsync(() =>
            {
                if (version != _agendaSelectVersion) return;
                if (_daySchedule.Blocks.All(block => block.RuntimeId != runtimeId)) return;

                _selectedRuntimeIds.Clear();
                _selectedRuntimeIds.Add(runtimeId);
                RenderActivePage();
            });
        });
    }

    private Control RenderNowCard()
    {
        var root = new StackPanel { Spacing = 8 };
        var now = CurrentMinute();
        var visibleBlocks = _daySchedule.Blocks.Where(IsVisibleBlock).OrderBy(block => block.StartMin).ToList();
        var current = IsFocusDateToday()
            ? visibleBlocks.FirstOrDefault(block => block.StartMin <= now && now < block.EndMin)
            : null;
        var next = visibleBlocks.FirstOrDefault(block => block.StartMin >= (IsFocusDateToday() ? now : 0));

        if (current is not null)
        {
            var remaining = Math.Max(0, current.EndMin - now);
            root.Children.Add(Text("正在进行", 12, "#dc2626", FontWeight.SemiBold));
            root.Children.Add(Text(current.Title, 18, "#111827", FontWeight.SemiBold));
            root.Children.Add(Text($"{current.Start}-{current.End}，剩余约 {remaining} 分钟", 12, "#475569"));
        }
        else if (next is not null)
        {
            root.Children.Add(Text(IsFocusDateToday() ? "下一段" : "当天第一段", 12, "#2563eb", FontWeight.SemiBold));
            root.Children.Add(Text(next.Title, 18, "#111827", FontWeight.SemiBold));
            root.Children.Add(Text($"{next.Start}-{next.End}", 12, "#475569"));
        }
        else
        {
            root.Children.Add(Text(IsFocusDateToday() ? "今天没有剩余日程" : "当天没有日程", 12, "#16a34a", FontWeight.SemiBold));
            root.Children.Add(Text("可以直接新建，或让 AI 帮你安排。", 12, "#64748b"));
        }

        if (IsFocusDateToday())
        {
            root.Children.Add(Text($"当前时间 {TimeText.ToTime(now)}", 11, "#94a3b8"));
        }
        else
        {
            root.Children.Add(Text($"{_focusDate:yyyy-MM-dd}", 11, "#94a3b8"));
        }

        var actions = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,*"),
            ColumnSpacing = 8
        };
        var openDay = Button("日视图", (_, _) =>
        {
            SetScheduleView(ScheduleViewMode.Day, savePreference: true);
            _selectedRuntimeIds.Clear();
            RebuildSchedules();
            RenderActivePage();
        }, secondary: true);
        var create = Button("新建", async (_, _) => await CreateScheduleBlockAsync(ResolveDefaultNewBlockStartMin()), secondary: next is not null || current is not null);
        openDay.Padding = new Thickness(8, 5);
        create.Padding = new Thickness(8, 5);
        openDay.MinHeight = 30;
        create.MinHeight = 30;
        Grid.SetColumn(openDay, 0);
        Grid.SetColumn(create, 1);
        actions.Children.Add(openDay);
        actions.Children.Add(create);
        root.Children.Add(actions);

        return Card("现在", root);
    }

    private Control RenderDayCalendar()
    {
        _dayEventWidth = ResolveDayEventWidth();
        var canvasWidth = DayLabelWidth + _dayEventWidth + 34;
        _dayCanvas = new Canvas
        {
            Width = canvasWidth,
            Height = DayTopOffset + TimeText.FullDayEndMin * DayPixelsPerMinute + 32,
            Background = Brush("#ffffff")
        };
        _dayCanvas.PointerPressed += BeginBoxSelection;
        _dayCanvas.PointerMoved += UpdateBoxSelection;
        _dayCanvas.PointerReleased += FinishBoxSelection;
        _dayCanvas.DoubleTapped += async (_, args) =>
        {
            if (args.Source is Canvas)
            {
                args.Handled = true;
                await CreateScheduleBlockAsync(MinuteFromCanvasY(args.GetPosition(_dayCanvas).Y));
            }
        };

        for (var minute = 0; minute <= TimeText.FullDayEndMin; minute += 60)
        {
            var y = DayTopOffset + minute * DayPixelsPerMinute;
            var line = TimelineDecoration(new Border
            {
                Background = Brush(minute % 120 == 0 ? "#d1d5db" : "#e5e7eb"),
                Width = _dayEventWidth + 24,
                Height = 1
            });
            Canvas.SetLeft(line, DayLabelWidth);
            Canvas.SetTop(line, y);
            _dayCanvas.Children.Add(line);
            var label = TimelineDecoration(Text(TimeText.ToTime(minute), 11, "#64748b"));
            Canvas.SetLeft(label, 8);
            Canvas.SetTop(label, y - 8);
            _dayCanvas.Children.Add(label);
        }

        var dayLayouts = ComputeTimelineEventLayouts(_daySchedule.Blocks.Where(IsVisibleBlock));
        foreach (var block in _daySchedule.Blocks.Where(IsVisibleBlock).OrderBy(block => block.StartMin))
        {
            var item = BuildScheduleBlockControl(block, DayPixelsPerMinute, DayTopOffset, dayLayouts[block.RuntimeId]);
            _dayCanvas.Children.Add(item);
        }

        AddCurrentTimeLine(_dayCanvas);

        var scroller = new ScrollViewer
        {
            Content = _dayCanvas,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto
        };
        AttachTimelineInitialScroll(scroller, ResolveDayTimelineFocusMinute(_daySchedule), DayTopOffset, DayPixelsPerMinute);

        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#e5e7eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Child = scroller
        };
    }

    private void AttachTimelineInitialScroll(ScrollViewer scroller, int targetMinute, double topOffset, double pixelsPerMinute)
    {
        scroller.Loaded += (_, _) =>
        {
            Dispatcher.UIThread.Post(() =>
            {
                var minute = Math.Clamp(targetMinute, TimeText.FullDayStartMin, TimeText.FullDayEndMin);
                var y = Math.Max(0, topOffset + minute * pixelsPerMinute - 72);
                scroller.Offset = new Vector(scroller.Offset.X, y);
            }, DispatcherPriority.Background);
        };
    }

    private int ResolveDayTimelineFocusMinute(DaySchedule schedule)
    {
        var selected = schedule.Blocks
            .Where(block => _selectedRuntimeIds.Contains(block.RuntimeId) && IsVisibleBlock(block))
            .OrderBy(block => block.StartMin)
            .FirstOrDefault();
        if (selected is not null) return Math.Max(0, selected.StartMin - 60);

        if (schedule.Date == DateOnly.FromDateTime(DateTime.Today))
        {
            return Math.Max(0, CurrentMinute() - 90);
        }

        var first = schedule.Blocks
            .Where(IsVisibleBlock)
            .OrderBy(block => block.StartMin)
            .FirstOrDefault();
        return Math.Max(0, (first?.StartMin ?? WakeTimeMinute()) - 60);
    }

    private Border BuildScheduleBlockControl(ScheduleBlock block, double pixelsPerMinute, double topOffset, TimelineEventLayout layout)
    {
        var done = IsBlockCompleted(block);
        var current = IsCurrentBlock(block);
        var color = block.Type == ScheduleBlockType.Fixed ? "#dbeafe" : block.Category switch
        {
            "study" => "#dcfce7",
            "code" => "#ede9fe",
            "workout" => "#ffedd5",
            _ => "#f1f5f9"
        };
        var selected = _selectedRuntimeIds.Contains(block.RuntimeId);
        var border = new Border
        {
            Tag = block.RuntimeId,
            Background = Brush(color),
            BorderBrush = Brush(selected ? "#2563eb" : current ? "#ef4444" : "#cbd5e1"),
            BorderThickness = new Thickness(selected || current ? 2 : 1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10, 6),
            Width = DayEventWidthForLayout(layout),
            Opacity = done ? 0.68 : 1,
            Height = Math.Max(32, block.DurationMin * pixelsPerMinute - 4),
            Child = new Grid
            {
                RowDefinitions = new RowDefinitions("*,6")
            }
        };
        ToolTip.SetTip(border, ScheduleBlockTooltip(_focusDate, block, done, current));
        var eventContent = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,*"),
            ColumnSpacing = 10
        };
        var completeButton = new Button
        {
            Content = CenteredIconText(done ? "✓" : "", 15, done ? "#ffffff" : "#64748b"),
            Width = 28,
            Height = 28,
            MinHeight = 28,
            Padding = new Thickness(0),
            Background = Brush(done ? "#22c55e" : "#ffffff"),
            Foreground = Brush(done ? "#ffffff" : "#64748b"),
            BorderBrush = Brush(done ? "#16a34a" : "#cbd5e1"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(14),
            HorizontalContentAlignment = HorizontalAlignment.Center,
            VerticalContentAlignment = VerticalAlignment.Center
        };
        completeButton.Click += async (_, _) => await ToggleBlockCompleteAsync(block);
        var textStack = new StackPanel { Spacing = 2 };
        var timeLabel = Text($"{block.Start}-{block.End}", 11, done ? "#64748b" : "#334155", FontWeight.SemiBold);
        timeLabel.TextWrapping = TextWrapping.NoWrap;
        timeLabel.TextTrimming = TextTrimming.CharacterEllipsis;
        textStack.Children.Add(timeLabel);
        var titleSuffix = done ? "（已完成）" : current ? "（进行中）" : "";
        var titleLabel = Text($"{block.Title}{titleSuffix}", 13, done ? "#64748b" : current ? "#991b1b" : "#0f172a", FontWeight.SemiBold);
        titleLabel.TextWrapping = TextWrapping.NoWrap;
        titleLabel.TextTrimming = TextTrimming.CharacterEllipsis;
        textStack.Children.Add(titleLabel);
        Grid.SetColumn(completeButton, 0);
        Grid.SetColumn(textStack, 1);
        eventContent.Children.Add(completeButton);
        eventContent.Children.Add(textStack);

        var resizeGrip = new Border
        {
            Height = 5,
            Background = Brush("#94a3b8"),
            CornerRadius = new CornerRadius(3),
            Opacity = block.Editable ? 0.42 : 0,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            Margin = layout.LaneCount > 2 ? new Thickness(12, 0, 12, 0) : new Thickness(42, 0, 42, 0),
            Cursor = new Cursor(StandardCursorType.SizeNorthSouth)
        };
        resizeGrip.PointerPressed += (_, args) =>
        {
            if (!block.Editable || !args.GetCurrentPoint(resizeGrip).Properties.IsLeftButtonPressed) return;
            _resizeBlock = block;
            _resizeDate = _focusDate;
            _resizeStart = args.GetPosition(_dayCanvas);
            _resizeOriginalStart = block.StartMin;
            _resizeOriginalEnd = block.EndMin;
            args.Pointer.Capture(resizeGrip);
            args.Handled = true;
        };
        resizeGrip.PointerMoved += (_, args) =>
        {
            if (_resizeBlock is null || args.Pointer.Captured != resizeGrip) return;
            var previewEnd = ResolveResizeEnd(args.GetPosition(_dayCanvas), pixelsPerMinute);
            border.Height = Math.Max(32, (previewEnd - block.StartMin) * pixelsPerMinute - 4);
            timeLabel.Text = $"{block.Start}-{TimeText.ToTime(previewEnd)}";
            border.Opacity = 0.86;
            args.Handled = true;
        };
        resizeGrip.PointerReleased += (_, args) =>
        {
            if (_resizeBlock is not null && args.Pointer.Captured == resizeGrip)
            {
                CommitResize(args.GetPosition(_dayCanvas), pixelsPerMinute);
                args.Pointer.Capture(null);
                args.Handled = true;
            }
        };

        var rootGrid = (Grid)border.Child;
        Grid.SetRow(eventContent, 0);
        Grid.SetRow(resizeGrip, 1);
        rootGrid.Children.Add(eventContent);
        rootGrid.Children.Add(resizeGrip);
        Canvas.SetLeft(border, DayEventLeft(layout));
        Canvas.SetTop(border, topOffset + block.StartMin * pixelsPerMinute + 2);

        border.DoubleTapped += async (_, args) =>
        {
            args.Handled = true;
            await EditScheduleBlockAsync(block);
        };

        border.PointerPressed += (sender, args) =>
        {
            if (args.Source is Button)
            {
                return;
            }
            if (args.GetCurrentPoint(border).Properties.IsRightButtonPressed)
            {
                return;
            }

            var controlPressed = (args.KeyModifiers & KeyModifiers.Control) != 0;
            var alreadySelected = _selectedRuntimeIds.Contains(block.RuntimeId);
            if (controlPressed && alreadySelected)
            {
                _selectedRuntimeIds.Remove(block.RuntimeId);
                RenderActivePage();
                args.Handled = true;
                return;
            }

            if (!controlPressed && !alreadySelected)
            {
                _selectedRuntimeIds.Clear();
            }
            _selectedRuntimeIds.Add(block.RuntimeId);
            _dragBlock = block;
            _dragStart = args.GetPosition(_dayCanvas);
            _dragOriginalStart = block.StartMin;
            _dragOriginalEnd = block.EndMin;
            border.BorderBrush = Brush("#2563eb");
            border.BorderThickness = new Thickness(2);
            args.Pointer.Capture(border);
            args.Handled = true;
        };

        border.PointerMoved += (_, args) =>
        {
            if (_dragBlock is null || args.Pointer.Captured != border) return;

            var previewStart = ResolveDayDragStart(args.GetPosition(_dayCanvas));
            if (previewStart == _dragOriginalStart) return;

            var deltaMinutes = previewStart - _dragOriginalStart;
            foreach (var item in _dayCanvas?.Children.OfType<Border>() ?? Enumerable.Empty<Border>())
            {
                if (item.Tag is not string id || !_selectedRuntimeIds.Contains(id)) continue;
                var targetBlock = _daySchedule.Blocks.FirstOrDefault(block => block.RuntimeId == id);
                if (targetBlock is null) continue;

                var targetDuration = targetBlock.DurationMin;
                var targetStart = Math.Clamp(targetBlock.StartMin + deltaMinutes, 0, TimeText.FullDayEndMin - targetDuration);
                Canvas.SetTop(item, topOffset + targetStart * pixelsPerMinute + 2);
                item.Opacity = 0.86;
            }
            args.Handled = true;
        };

        border.PointerReleased += (_, args) =>
        {
            if (_dragBlock is not null && args.Pointer.Captured == border)
            {
                CommitDrag(args.GetPosition(_dayCanvas));
                args.Pointer.Capture(null);
                args.Handled = true;
            }
        };

        var menu = new ContextMenu();
        var complete = new MenuItem { Header = done ? "取消完成" : "标记完成" };
        complete.Click += async (_, _) => await ToggleBlockCompleteAsync(block);
        var edit = new MenuItem { Header = "编辑" };
        edit.Click += async (_, _) => await EditScheduleBlockAsync(block);
        menu.Items.Add(complete);
        menu.Items.Add(edit);
        AddDaySelectionContextMenuItems(menu, block);
        border.ContextMenu = menu;

        return border;
    }

    private void AddCurrentTimeLine(Canvas canvas)
    {
        if (!IsFocusDateToday()) return;

        var now = CurrentMinute();
        if (now < TimeText.FullDayStartMin || now > TimeText.FullDayEndMin) return;

        var y = DayTopOffset + now * DayPixelsPerMinute;
        var line = TimelineDecoration(new Border
        {
            Background = Brush("#ef4444"),
            Width = _dayEventWidth + 34,
            Height = 2,
            CornerRadius = new CornerRadius(1)
        });
        Canvas.SetLeft(line, DayLabelWidth);
        Canvas.SetTop(line, y);
        canvas.Children.Add(line);

        var label = TimelineDecoration(new Border
        {
            Background = Brush("#ef4444"),
            CornerRadius = new CornerRadius(9),
            Padding = new Thickness(7, 2),
            Child = Text($"现在 {TimeText.ToTime(now)}", 11, "#ffffff", FontWeight.SemiBold)
        });
        Canvas.SetLeft(label, DayLabelWidth + Math.Max(8, _dayEventWidth - 74));
        Canvas.SetTop(label, Math.Max(2, y - 11));
        canvas.Children.Add(label);
    }

    private async Task<bool> CreateScheduleBlockInDayViewAsync(int startMin, int? endMin = null)
    {
        SetScheduleView(ScheduleViewMode.Day, savePreference: true);
        var changed = await CreateScheduleBlockAsync(startMin, endMin);
        if (!changed)
        {
            RenderActivePage();
        }

        return changed;
    }

    private async Task<bool> CreateScheduleBlockAsync(int startMin, int? endMin = null)
    {
        var safeStart = Math.Clamp(startMin, TimeText.FullDayStartMin, TimeText.FullDayEndMin - 30);
        var safeEnd = Math.Clamp(endMin ?? safeStart + 30, safeStart + 15, TimeText.FullDayEndMin);
        var block = new ScheduleBlock
        {
            RuntimeId = Ids.New("manual"),
            Type = ScheduleBlockType.Task,
            Title = "新日程",
            Category = "other",
            StartMin = safeStart,
            EndMin = safeEnd,
            Editable = true
        };

        return await EditScheduleBlockAsync(block, isNew: true);
    }

    private int ResolveDefaultNewBlockStartMin()
    {
        var activeStart = TimeText.ParseMinutes(_state.Preferences.WakeTime) ?? 8 * 60;
        var latestEnd = _daySchedule.Blocks
            .Where(IsVisibleBlock)
            .Select(block => block.EndMin)
            .DefaultIfEmpty(activeStart)
            .Max();

        var candidate = Math.Max(activeStart, latestEnd);
        if (_focusDate == DateOnly.FromDateTime(DateTime.Today))
        {
            var now = DateTime.Now.Hour * 60 + DateTime.Now.Minute;
            var nextHalfHour = ((now + 29) / 30) * 30;
            candidate = Math.Max(candidate, nextHalfHour);
        }

        return Math.Clamp(RoundToStep(candidate, 15), TimeText.FullDayStartMin, TimeText.FullDayEndMin - 30);
    }

    private static int MinuteFromCanvasY(double y)
    {
        var raw = (int)Math.Round((y - DayTopOffset) / DayPixelsPerMinute / 15.0) * 15;
        return Math.Clamp(raw, TimeText.FullDayStartMin, TimeText.FullDayEndMin - 30);
    }

    private static int RoundToStep(int minutes, int step)
    {
        return (int)Math.Round(minutes / (double)step) * step;
    }

    private async Task<bool> EditScheduleBlockAsync(ScheduleBlock block, bool isNew = false)
    {
        if (!block.Editable) return false;

        var title = new TextBox { Text = block.Title, Watermark = "日程标题" };
        var start = new TextBox { Text = block.Start, Watermark = "09:00" };
        var end = new TextBox { Text = block.End, Watermark = "10:30" };
        var categories = CategoryOptionsFor(block.Category);
        var category = new ComboBox
        {
            ItemsSource = categories,
            SelectedItem = categories.FirstOrDefault(item => item.Value == block.Category) ?? categories.First(),
            MinHeight = 38
        };
        var error = Text("", 12, "#dc2626");
        var previewText = Text("", 12, "#64748b");
        var categoryPreviewText = Text("", 12, "#334155", FontWeight.SemiBold);
        var categoryPreview = new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10),
            Child = categoryPreviewText
        };
        var previewBox = new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10),
            Child = previewText
        };

        var form = new StackPanel { Spacing = 11, Margin = new Thickness(18) };
        form.Children.Add(Text(isNew ? "新建日程" : "编辑日程", 20, "#111827", FontWeight.SemiBold));
        form.Children.Add(Text(isNew ? "新建内容会保存为当天手动日程。" : "修改会保存为当天手动调整，不会改动重复规则。", 12, "#64748b"));
        form.Children.Add(Text($"{_focusDate:yyyy-MM-dd} 周{WeekdayText(_focusDate)}", 12, "#1a73e8", FontWeight.SemiBold));
        form.Children.Add(Field("标题", title));
        form.Children.Add(BuildStartPresetRow(start, end, error));
        var timeGrid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,*"),
            ColumnSpacing = 10
        };
        var startField = Field("开始", start);
        var endField = Field("结束", end);
        Grid.SetColumn(startField, 0);
        Grid.SetColumn(endField, 1);
        timeGrid.Children.Add(startField);
        timeGrid.Children.Add(endField);
        form.Children.Add(timeGrid);
        form.Children.Add(BuildDurationPresetRow(start, end, error));
        form.Children.Add(Field("类别", category));
        form.Children.Add(categoryPreview);
        form.Children.Add(error);
        form.Children.Add(previewBox);

        var actions = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto,Auto"),
            ColumnSpacing = 8
        };
        var dialog = new Window
        {
            Title = isNew ? "新建日程" : "编辑日程",
            Width = 500,
            Height = 650,
            MinWidth = 430,
            MinHeight = 560,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Background = Brush("#f8fafc")
        };

        var cancel = Button("取消", (_, _) => dialog.Close(false), secondary: true);
        var delete = Button("删除", async (_, _) =>
        {
            if (isNew) return;
            if (!await ConfirmDangerAsync("删除这个日程？", $"将删除 {_focusDate:yyyy-MM-dd} 的“{block.Title}”。删除后仍可用顶部撤销恢复。", "删除"))
            {
                return;
            }

            CaptureUndo("删除日程");
            _daySchedule.Blocks.RemoveAll(item => item.RuntimeId == block.RuntimeId && item.Editable);
            _selectedRuntimeIds.Remove(block.RuntimeId);
            SaveCurrentDayOverride($"已删除 {block.Title}");
            dialog.Close(true);
        }, danger: true);
        delete.IsVisible = !isNew;
        Button? save = null;

        bool TrySaveScheduleBlock()
        {
            var nextTitle = (title.Text ?? "").Trim();
            var startMin = TimeText.ParseMinutes(start.Text);
            var endMin = TimeText.ParseMinutes(end.Text);
            if (nextTitle.Length == 0)
            {
                error.Text = "标题不能为空。";
                return false;
            }
            if (startMin is null || endMin is null || endMin <= startMin)
            {
                error.Text = "请输入有效时间，例如 09:00 到 10:30。";
                return false;
            }

            CaptureUndo(isNew ? "新建日程" : "编辑日程");
            block.Title = nextTitle;
            block.StartMin = startMin.Value;
            block.EndMin = endMin.Value;
            block.Category = category.SelectedItem is CategoryOption option ? option.Value : "other";
            if (isNew)
            {
                _daySchedule.Blocks.Add(block);
                _selectedRuntimeIds.Clear();
                _selectedRuntimeIds.Add(block.RuntimeId);
            }
            _daySchedule.Blocks = [.. _daySchedule.Blocks.OrderBy(item => item.StartMin).ThenBy(item => item.EndMin)];
            SaveCurrentDayOverride(isNew ? $"已新建 {block.Title}" : $"已编辑 {block.Title}");
            return true;
        }

        void UpdatePreview()
        {
            error.Text = "";
            var nextTitle = (title.Text ?? "").Trim();
            var startMin = TimeText.ParseMinutes(start.Text);
            var endMin = TimeText.ParseMinutes(end.Text);
            var categoryValue = category.SelectedItem is CategoryOption selectedCategory ? selectedCategory.Value : block.Category;
            var categoryLabel = CategoryLabel(categoryValue);
            var accent = MonthEventAccent(new ScheduleBlock { Category = categoryValue, Type = block.Type });
            categoryPreviewText.Text = $"类别：{categoryLabel}";
            categoryPreviewText.Foreground = Brush(accent);
            categoryPreview.Background = Brush(MonthEventBackground(new ScheduleBlock { Category = categoryValue, Type = block.Type }));
            categoryPreview.BorderBrush = Brush(accent);

            if (nextTitle.Length == 0 || startMin is null || endMin is null || endMin <= startMin)
            {
                previewText.Text = "填写标题和有效时间后，会在保存前检查当天冲突。";
                previewText.Foreground = Brush("#64748b");
                previewBox.Background = Brush("#f8fafc");
                previewBox.BorderBrush = Brush("#e2e8f0");
                if (save is not null) save.Content = "保存";
                return;
            }

            var preview = BuildEditPreviewSchedule(block, isNew, nextTitle, startMin.Value, endMin.Value, categoryValue);
            var issues = ComputeManualScheduleIssues(preview);
            if (issues.Count == 0)
            {
                previewText.Text = $"{TimeText.ToTime(startMin.Value)}-{TimeText.ToTime(endMin.Value)} · {endMin.Value - startMin.Value} 分钟 · 时间可用。";
                previewText.Foreground = Brush("#166534");
                previewBox.Background = Brush("#f0fdf4");
                previewBox.BorderBrush = Brush("#bbf7d0");
                if (save is not null) save.Content = "保存";
                return;
            }

            previewText.Text = "保存后会出现时间问题：" + string.Join("；", issues.Take(2).Select(issue => issue.Message))
                + (issues.Count > 2 ? $"；另有 {issues.Count - 2} 条" : "");
            previewText.Foreground = Brush("#991b1b");
            previewBox.Background = Brush("#fef2f2");
            previewBox.BorderBrush = Brush("#fecaca");
            if (save is not null) save.Content = "仍然保存";
        }

        title.TextChanged += (_, _) => UpdatePreview();
        start.TextChanged += (_, _) => UpdatePreview();
        end.TextChanged += (_, _) => UpdatePreview();
        category.SelectionChanged += (_, _) => UpdatePreview();

        save = Button("保存", (_, _) =>
        {
            if (TrySaveScheduleBlock()) dialog.Close(true);
        });
        Grid.SetColumn(delete, 0);
        Grid.SetColumn(cancel, 2);
        Grid.SetColumn(save, 3);
        actions.Children.Add(delete);
        actions.Children.Add(cancel);
        actions.Children.Add(save);
        form.Children.Add(actions);
        dialog.Content = form;
        dialog.Opened += (_, _) =>
        {
            UpdatePreview();
            title.Focus();
            title.SelectAll();
        };
        dialog.KeyDown += (_, args) =>
        {
            if (args.Key == Key.Escape)
            {
                dialog.Close(false);
                args.Handled = true;
                return;
            }

            if (args.Key == Key.Enter && args.KeyModifiers == KeyModifiers.None)
            {
                if (TrySaveScheduleBlock()) dialog.Close(true);
                args.Handled = true;
            }
        };

        var result = await dialog.ShowDialog<bool>(this);
        if (result)
        {
            RenderActivePage();
        }

        return result;
    }

    private DaySchedule BuildEditPreviewSchedule(ScheduleBlock original, bool isNew, string title, int startMin, int endMin, string category)
    {
        var preview = _daySchedule.Clone();
        if (!isNew)
        {
            preview.Blocks.RemoveAll(block => block.RuntimeId == original.RuntimeId);
        }

        var next = original.Clone();
        next.Title = title;
        next.StartMin = startMin;
        next.EndMin = endMin;
        next.Category = category;
        next.Editable = true;
        preview.Blocks.Add(next);
        preview.Blocks = [.. preview.Blocks.OrderBy(block => block.StartMin).ThenBy(block => block.EndMin)];
        return preview;
    }

    private static List<CategoryOption> CategoryOptionsFor(string current)
    {
        var options = new List<CategoryOption>
        {
            new("other", "其他"),
            new("study", "学习"),
            new("code", "编程"),
            new("workout", "运动")
        };
        if (!string.IsNullOrWhiteSpace(current) && options.All(item => item.Value != current))
        {
            options.Insert(0, new CategoryOption(current, $"自定义：{current}"));
        }

        return options;
    }

    private Control BuildStartPresetRow(TextBox start, TextBox end, TextBlock error)
    {
        var row = new WrapPanel { Orientation = Orientation.Horizontal };
        foreach (var (label, minutes) in new[] { ("现在", -1), ("上午 9", 9 * 60), ("下午 2", 14 * 60), ("晚 7:30", 19 * 60 + 30) })
        {
            var button = Button(label, (_, _) =>
            {
                var duration = ResolveEditedDuration(start.Text, end.Text);
                var nextStart = minutes < 0
                    ? RoundToStep(DateTime.Now.Hour * 60 + DateTime.Now.Minute + 14, 15)
                    : minutes;
                nextStart = Math.Clamp(nextStart, TimeText.FullDayStartMin, TimeText.FullDayEndMin - 15);
                start.Text = TimeText.ToTime(nextStart);
                end.Text = TimeText.ToTime(Math.Min(TimeText.FullDayEndMin, nextStart + duration));
                error.Text = "";
            }, secondary: true);
            button.MinHeight = 30;
            button.Padding = new Thickness(9, 5);
            button.Margin = new Thickness(0, 0, 8, 6);
            row.Children.Add(button);
        }

        return Field("常用开始", row);
    }

    private Control BuildDurationPresetRow(TextBox start, TextBox end, TextBlock error)
    {
        var row = new WrapPanel { Orientation = Orientation.Horizontal };
        foreach (var (label, minutes) in new[] { ("30 分钟", 30), ("1 小时", 60), ("90 分钟", 90), ("2 小时", 120) })
        {
            var button = Button(label, (_, _) =>
            {
                var startMin = TimeText.ParseMinutes(start.Text);
                if (startMin is null)
                {
                    error.Text = "先输入有效开始时间，例如 09:00。";
                    return;
                }

                end.Text = TimeText.ToTime(Math.Min(TimeText.FullDayEndMin, startMin.Value + minutes));
                error.Text = "";
            }, secondary: true);
            button.MinHeight = 30;
            button.Padding = new Thickness(9, 5);
            button.Margin = new Thickness(0, 0, 8, 6);
            row.Children.Add(button);
        }

        return Field("快捷时长", row);
    }

    private static int ResolveEditedDuration(string? start, string? end)
    {
        var startMin = TimeText.ParseMinutes(start);
        var endMin = TimeText.ParseMinutes(end);
        return startMin is not null && endMin is not null && endMin > startMin
            ? Math.Clamp(endMin.Value - startMin.Value, 15, 480)
            : 30;
    }

    private Control RenderMonthCalendar()
    {
        var firstOfMonth = new DateOnly(_focusDate.Year, _focusDate.Month, 1);
        var lastOfMonth = firstOfMonth.AddMonths(1).AddDays(-1);
        var visibleStart = firstOfMonth.AddDays(-(int)firstOfMonth.DayOfWeek);
        var visibleEnd = lastOfMonth.AddDays(6 - (int)lastOfMonth.DayOfWeek);
        var dayCount = visibleEnd.DayNumber - visibleStart.DayNumber + 1;
        var rowCount = Math.Max(5, dayCount / 7);
        visibleEnd = visibleStart.AddDays(rowCount * 7 - 1);
        dayCount = rowCount * 7;
        var visibleBlockLimit = rowCount >= 6 ? 2 : 3;
        var schedules = BuildMonthSchedules(visibleStart, visibleEnd);

        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,*,*,*,*,*,*"),
            RowDefinitions = new RowDefinitions("34," + string.Join(",", Enumerable.Repeat("*", rowCount))),
            ClipToBounds = true
        };

        foreach (var (name, column) in new[] { "周日", "周一", "周二", "周三", "周四", "周五", "周六" }.Select((name, column) => (name, column)))
        {
            var label = MonthSingleLineText(name, 12, "#5f6368", FontWeight.SemiBold);
            label.HorizontalAlignment = HorizontalAlignment.Center;
            label.VerticalAlignment = VerticalAlignment.Center;
            var header = new Border
            {
                Background = Brush("#ffffff"),
                BorderBrush = Brush("#dadce0"),
                BorderThickness = new Thickness(column == 0 ? 0 : 1, 0, 0, 1),
                Padding = new Thickness(8, 0),
                Child = label
            };
            Grid.SetColumn(header, column);
            Grid.SetRow(header, 0);
            grid.Children.Add(header);
        }

        for (var offset = 0; offset < dayCount; offset++)
        {
            var date = visibleStart.AddDays(offset);
            var row = offset / 7 + 1;
            var column = offset % 7;
            schedules.TryGetValue(date, out var schedule);
            var cell = BuildMonthDayCell(date, schedule ?? BuildScheduleForDate(date), date.Month == _focusDate.Month, grid, visibleBlockLimit);
            Grid.SetColumn(cell, column);
            Grid.SetRow(cell, row);
            grid.Children.Add(cell);
        }

        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#dadce0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            ClipToBounds = true,
            Child = grid
        };
    }

    private Dictionary<DateOnly, DaySchedule> BuildMonthSchedules(DateOnly visibleStart, DateOnly visibleEnd)
    {
        var schedules = new Dictionary<DateOnly, DaySchedule>();
        var cursor = TimeText.MondayOfWeek(visibleStart);
        while (cursor <= visibleEnd)
        {
            var week = ApplyWeekOverrides(_scheduleEngine.BuildWeek(BuildScheduleRequest(cursor, _state.Tasks)));
            foreach (var day in week.Days)
            {
                if (day.Date >= visibleStart && day.Date <= visibleEnd)
                {
                    schedules[day.Date] = day.Schedule.Clone();
                }
            }

            cursor = cursor.AddDays(7);
        }

        return schedules;
    }

    private Control BuildMonthDayCell(DateOnly date, DaySchedule schedule, bool inCurrentMonth, Grid monthGrid, int visibleBlockLimit)
    {
        var isToday = date == DateOnly.FromDateTime(DateTime.Today);
        var isFocused = date == _focusDate;
        var dateLabel = date.Day == 1 ? $"{date.Month}月{date.Day}日" : date.Day.ToString();
        var root = new StackPanel { Spacing = 4 };
        var dayNumber = MonthSingleLineText(dateLabel, 12, isToday ? "#ffffff" : inCurrentMonth ? "#202124" : "#9aa0a6", FontWeight.SemiBold);
        dayNumber.HorizontalAlignment = HorizontalAlignment.Center;
        dayNumber.VerticalAlignment = VerticalAlignment.Center;
        var dayBadge = new Border
        {
            Width = date.Day == 1 ? 54 : 28,
            Height = 26,
            CornerRadius = new CornerRadius(13),
            Background = Brush(isToday ? "#1a73e8" : "#00ffffff"),
            BorderBrush = Brush(isFocused && !isToday ? "#1a73e8" : "#00ffffff"),
            BorderThickness = new Thickness(isFocused && !isToday ? 1 : 0),
            Child = dayNumber,
            HorizontalAlignment = HorizontalAlignment.Left
        };
        root.Children.Add(dayBadge);

        var visibleBlocks = schedule.Blocks
            .Where(IsVisibleBlock)
            .OrderBy(block => block.StartMin)
            .ToList();
        foreach (var block in visibleBlocks.Take(visibleBlockLimit))
        {
            root.Children.Add(BuildMonthEventChip(date, block, monthGrid));
        }

        if (visibleBlocks.Count > visibleBlockLimit)
        {
            root.Children.Add(BuildMonthMoreButton(date, schedule, visibleBlocks.Count - visibleBlockLimit));
        }

        var cell = new Border
        {
            Background = Brush(isFocused ? "#f8fbff" : inCurrentMonth ? "#ffffff" : "#f8fafd"),
            BorderBrush = Brush(isFocused ? "#1a73e8" : "#dadce0"),
            BorderThickness = isFocused ? new Thickness(2) : new Thickness(0, 0, 1, 1),
            Padding = new Thickness(7, 6),
            Tag = date,
            ClipToBounds = true,
            Child = root
        };
        cell.PointerPressed += (_, args) =>
        {
            if (!args.GetCurrentPoint(cell).Properties.IsLeftButtonPressed) return;
            QueueMonthFocus(date);
        };
        cell.DoubleTapped += async (_, args) =>
        {
            Interlocked.Increment(ref _monthFocusVersion);
            _focusDate = date;
            _selectedRuntimeIds.Clear();
            RebuildSchedules();
            await CreateScheduleBlockAsync(ResolveDefaultNewBlockStartMin());
            args.Handled = true;
        };

        var menu = new ContextMenu();
        var add = new MenuItem { Header = "新建日程" };
        add.Click += async (_, _) => await CreateScheduleBlockOnDateAsync(date);
        var openDay = new MenuItem { Header = "打开日视图" };
        openDay.Click += (_, _) => OpenDayFromMonth(date);
        menu.Items.Add(add);
        menu.Items.Add(openDay);
        cell.ContextMenu = menu;

        return cell;
    }

    private Control BuildMonthMoreButton(DateOnly date, DaySchedule schedule, int hiddenCount)
    {
        var more = new Border
        {
            Background = Brush("#00ffffff"),
            BorderBrush = Brush("#00ffffff"),
            BorderThickness = new Thickness(0),
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(4, 2),
            Cursor = new Cursor(StandardCursorType.Hand),
            Child = MonthSingleLineText($"还有 {hiddenCount} 个", 11, "#1a73e8", FontWeight.SemiBold)
        };
        more.PointerPressed += (_, args) =>
        {
            if (!args.GetCurrentPoint(more).Properties.IsLeftButtonPressed) return;
            args.Handled = true;
            _ = ShowMonthDayDetailsAsync(date, schedule);
        };
        return more;
    }

    private async Task ShowMonthDayDetailsAsync(DateOnly date, DaySchedule schedule)
    {
        Interlocked.Increment(ref _monthFocusVersion);
        var blocks = schedule.Blocks
            .Where(IsVisibleBlock)
            .OrderBy(block => block.StartMin)
            .ToList();

        var root = new StackPanel
        {
            Spacing = 12,
            Margin = new Thickness(18)
        };
        var header = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto"), ColumnSpacing = 10 };
        var title = new StackPanel { Spacing = 3 };
        title.Children.Add(Text($"{date:yyyy 年 M 月 d 日} 周{WeekdayText(date)}", 20, "#111827", FontWeight.SemiBold));
        title.Children.Add(Text($"{blocks.Count} 个日程", 12, "#64748b", FontWeight.SemiBold));
        Grid.SetColumn(title, 0);
        header.Children.Add(title);
        var open = Button("打开日视图", (_, _) =>
        {
            if (root.Tag is Window dialog)
            {
                dialog.Close(false);
            }
            OpenDayFromMonth(date);
        }, secondary: true);
        Grid.SetColumn(open, 1);
        header.Children.Add(open);
        root.Children.Add(header);

        if (blocks.Count == 0)
        {
            root.Children.Add(RulesEmptyState("当天没有日程。"));
        }
        else
        {
            foreach (var block in blocks)
            {
                root.Children.Add(BuildMonthDayDetailsRow(date, block, root));
            }
        }

        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Spacing = 8
        };
        var dialogWindow = new Window
        {
            Title = $"{date:yyyy-MM-dd} 日程",
            Width = 480,
            Height = 560,
            MinWidth = 420,
            MinHeight = 420,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Background = Brush("#f8fafc")
        };
        root.Tag = dialogWindow;
        actions.Children.Add(Button("新建", async (_, _) =>
        {
            dialogWindow.Close(false);
            await CreateScheduleBlockOnDateAsync(date);
        }));
        actions.Children.Add(Button("关闭", (_, _) => dialogWindow.Close(false), secondary: true));
        root.Children.Add(actions);
        dialogWindow.Content = new ScrollViewer
        {
            Content = root,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto
        };

        await dialogWindow.ShowDialog<bool>(this);
        RenderActivePage();
    }

    private Control BuildMonthDayDetailsRow(DateOnly date, ScheduleBlock block, Control dialogRoot)
    {
        var done = IsBlockCompleted(block);
        var accent = MonthEventAccent(block);
        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto"),
            ColumnSpacing = 10
        };
        grid.Children.Add(new Border
        {
            Width = 4,
            Background = Brush(done ? "#cbd5e1" : accent),
            CornerRadius = new CornerRadius(3)
        });

        var text = new StackPanel { Spacing = 2 };
        text.Children.Add(Text($"{block.Start}-{block.End}", 12, done ? "#94a3b8" : "#475569", FontWeight.SemiBold));
        text.Children.Add(Text(block.Title, 14, done ? "#64748b" : "#111827", FontWeight.SemiBold));
        Grid.SetColumn(text, 1);
        grid.Children.Add(text);

        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Spacing = 6
        };
        var complete = Button(done ? "取消" : "完成", async (_, _) =>
        {
            if (dialogRoot.Tag is Window dialog)
            {
                dialog.Close(false);
            }
            await ToggleBlockCompleteAsync(block);
        }, secondary: true);
        var edit = Button("编辑", async (_, _) =>
        {
            if (dialogRoot.Tag is Window dialog)
            {
                dialog.Close(false);
            }
            await EditWeekScheduleBlockAsync(date, block);
        }, secondary: true);
        var delete = Button("删除", async (_, _) =>
        {
            if (dialogRoot.Tag is Window dialog)
            {
                dialog.Close(false);
            }
            await DeleteBlockOnDateAsync(date, block);
        }, danger: true);
        foreach (var button in new[] { complete, edit, delete })
        {
            button.Padding = new Thickness(8, 4);
            button.MinHeight = 28;
        }
        actions.Children.Add(complete);
        actions.Children.Add(edit);
        actions.Children.Add(delete);
        Grid.SetColumn(actions, 2);
        grid.Children.Add(actions);

        return new Border
        {
            Background = Brush(done ? "#f8fafc" : MonthEventBackground(block)),
            BorderBrush = Brush(done ? "#e2e8f0" : "#dbe3ee"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10),
            Child = grid
        };
    }

    private void QueueMonthFocus(DateOnly date)
    {
        var version = Interlocked.Increment(ref _monthFocusVersion);
        _ = Task.Run(async () =>
        {
            await Task.Delay(170);
            await Dispatcher.UIThread.InvokeAsync(() =>
            {
                if (version != _monthFocusVersion || _scheduleView != ScheduleViewMode.Month) return;
                _focusDate = date;
                _selectedRuntimeIds.Clear();
                RebuildSchedules();
                RenderActivePage();
            });
        });
    }

    private void OpenDayFromMonth(DateOnly date)
    {
        Interlocked.Increment(ref _monthFocusVersion);
        _focusDate = date;
        SetScheduleView(ScheduleViewMode.Day, savePreference: true);
        _selectedRuntimeIds.Clear();
        RebuildSchedules();
        RenderActivePage();
    }

    private async Task CreateScheduleBlockOnDateAsync(DateOnly date)
    {
        Interlocked.Increment(ref _monthFocusVersion);
        _focusDate = date;
        _selectedRuntimeIds.Clear();
        RebuildSchedules();
        await CreateScheduleBlockAsync(ResolveDefaultNewBlockStartMin());
    }

    private Control BuildMonthEventChip(DateOnly date, ScheduleBlock block, Grid monthGrid)
    {
        var done = IsBlockCompleted(block);
        var current = IsCurrentBlock(date, block);
        var accent = MonthEventAccent(block);
        var label = MonthSingleLineText($"{(done ? "✓ " : "")}{block.Start} {block.Title}", 11, done ? "#5f6368" : "#202124", FontWeight.SemiBold);
        label.VerticalAlignment = VerticalAlignment.Center;
        var content = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,*"),
            ColumnSpacing = 6
        };
        var colorStrip = new Border
        {
            Width = 3,
            Height = 14,
            CornerRadius = new CornerRadius(2),
            Background = Brush(done ? "#9aa0a6" : accent),
            VerticalAlignment = VerticalAlignment.Center
        };
        Grid.SetColumn(colorStrip, 0);
        Grid.SetColumn(label, 1);
        content.Children.Add(colorStrip);
        content.Children.Add(label);

        var chip = new Border
        {
            Background = Brush(done ? "#f1f3f4" : MonthEventBackground(block)),
            BorderBrush = Brush(current ? "#d93025" : "#00ffffff"),
            BorderThickness = new Thickness(current ? 1 : 0),
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(5, 2),
            Height = 22,
            Opacity = done ? 0.68 : 1,
            Cursor = new Cursor(StandardCursorType.Hand),
            Child = content
        };
        ToolTip.SetTip(chip, ScheduleBlockTooltip(date, block, done, current));
        chip.PointerPressed += (_, args) =>
        {
            if (args.GetCurrentPoint(chip).Properties.IsRightButtonPressed)
            {
                return;
            }

            if (!args.GetCurrentPoint(chip).Properties.IsLeftButtonPressed) return;
            _monthDragBlock = block;
            _monthDragSourceDate = date;
            _monthDragStart = args.GetPosition(monthGrid);
            _monthDragMoved = false;
            args.Pointer.Capture(chip);
            args.Handled = true;
        };
        chip.PointerMoved += (_, args) =>
        {
            if (_monthDragBlock is null || args.Pointer.Captured != chip) return;
            var current = args.GetPosition(monthGrid);
            if (Math.Abs(current.X - _monthDragStart.X) + Math.Abs(current.Y - _monthDragStart.Y) > 8)
            {
                _monthDragMoved = true;
                chip.Opacity = 0.55;
                chip.BorderBrush = Brush("#1a73e8");
                chip.BorderThickness = new Thickness(2);
                UpdateMonthDropTargetHighlight(monthGrid, ResolveMonthDateFromPoint(monthGrid, current));
            }
            args.Handled = true;
        };
        chip.PointerReleased += (_, args) =>
        {
            if (_monthDragBlock is null || args.Pointer.Captured != chip) return;
            args.Pointer.Capture(null);
            ClearMonthDropTargetHighlight();
            var targetDate = ResolveMonthDateFromPoint(monthGrid, args.GetPosition(monthGrid));
            var sourceDate = _monthDragSourceDate;
            var runtimeId = _monthDragBlock.RuntimeId;
            var startMin = _monthDragBlock.StartMin;
            var duration = _monthDragBlock.DurationMin;
            var moved = _monthDragMoved;
            _monthDragBlock = null;
            _monthDragMoved = false;

            if (moved && targetDate is not null && targetDate.Value != sourceDate)
            {
                MoveBlockAcrossDays(runtimeId, sourceDate, targetDate.Value, startMin, duration);
            }
            else if (moved)
            {
                RenderActivePage();
            }
            else if (sourceDate != _focusDate)
            {
                _focusDate = sourceDate;
                _selectedRuntimeIds.Clear();
                RebuildSchedules();
                RenderActivePage();
            }

            args.Handled = true;
        };
        chip.DoubleTapped += async (_, args) =>
        {
            args.Handled = true;
            await EditWeekScheduleBlockAsync(date, block);
        };

        var menu = new ContextMenu();
        var complete = new MenuItem { Header = done ? "取消完成" : "标记完成" };
        complete.Click += async (_, _) => await ToggleBlockCompleteAsync(block);
        var edit = new MenuItem { Header = "编辑" };
        edit.Click += async (_, _) => await EditWeekScheduleBlockAsync(date, block);
        var openDay = new MenuItem { Header = "打开日视图" };
        openDay.Click += (_, _) => OpenDayFromMonth(date);
        var delete = new MenuItem { Header = "删除" };
        delete.Click += async (_, _) => await DeleteBlockOnDateAsync(date, block);
        menu.Items.Add(complete);
        menu.Items.Add(edit);
        menu.Items.Add(openDay);
        menu.Items.Add(delete);
        chip.ContextMenu = menu;

        return chip;
    }

    private static TextBlock MonthSingleLineText(string text, double size, string color, FontWeight weight = FontWeight.Normal)
    {
        return new TextBlock
        {
            Text = text,
            FontSize = size,
            Foreground = Brush(color),
            FontWeight = weight,
            TextWrapping = TextWrapping.NoWrap,
            TextTrimming = TextTrimming.CharacterEllipsis
        };
    }

    private static TextBlock CenteredIconText(string text, double size, string color)
    {
        return new TextBlock
        {
            Text = text,
            FontSize = size,
            LineHeight = size,
            Foreground = Brush(color),
            FontWeight = FontWeight.SemiBold,
            TextAlignment = TextAlignment.Center,
            TextWrapping = TextWrapping.NoWrap,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
    }

    private static string ScheduleBlockTooltip(DateOnly date, ScheduleBlock block, bool done, bool current)
    {
        var type = block.Type == ScheduleBlockType.Fixed ? "固定事项" : "任务";
        var category = block.Type == ScheduleBlockType.Task ? $" · {CategoryLabel(block.Category)}" : "";
        var buffer = block.BufferMin > 0 ? $" · 缓冲 {block.BufferMin} 分钟" : "";
        var status = done ? "已完成" : current ? "进行中" : "未完成";
        return $"{date:yyyy-MM-dd} 周{WeekdayText(date)}\n{block.Start}-{block.End} · {block.DurationMin} 分钟\n{block.Title}\n{type}{category}{buffer} · {status}";
    }

    private static T TimelineDecoration<T>(T control) where T : InputElement
    {
        control.IsHitTestVisible = false;
        return control;
    }

    private static string MonthEventAccent(ScheduleBlock block)
    {
        if (block.Type == ScheduleBlockType.Fixed) return "#1a73e8";
        return block.Category switch
        {
            "study" => "#188038",
            "code" => "#8e24aa",
            "workout" => "#f4511e",
            _ => "#5f6368"
        };
    }

    private static string MonthEventBackground(ScheduleBlock block)
    {
        if (block.Type == ScheduleBlockType.Fixed) return "#e8f0fe";
        return block.Category switch
        {
            "study" => "#e6f4ea",
            "code" => "#f3e8fd",
            "workout" => "#fef7e0",
            _ => "#f1f3f4"
        };
    }

    private void UpdateMonthDropTargetHighlight(Grid monthGrid, DateOnly? date)
    {
        var target = date is null
            ? null
            : monthGrid.Children.OfType<Border>().FirstOrDefault(cell => cell.Tag is DateOnly cellDate && cellDate == date.Value);
        if (ReferenceEquals(target, _monthDropTargetCell)) return;

        ClearMonthDropTargetHighlight();
        if (target is null) return;

        _monthDropTargetCell = target;
        _monthDropTargetBackground = target.Background;
        _monthDropTargetBorderBrush = target.BorderBrush;
        _monthDropTargetBorderThickness = target.BorderThickness;

        target.Background = Brush("#e8f0fe");
        target.BorderBrush = Brush("#1a73e8");
        target.BorderThickness = new Thickness(2);
    }

    private void ClearMonthDropTargetHighlight()
    {
        if (_monthDropTargetCell is null) return;

        _monthDropTargetCell.Background = _monthDropTargetBackground;
        _monthDropTargetCell.BorderBrush = _monthDropTargetBorderBrush;
        _monthDropTargetCell.BorderThickness = _monthDropTargetBorderThickness;
        _monthDropTargetCell = null;
        _monthDropTargetBackground = null;
        _monthDropTargetBorderBrush = null;
        _monthDropTargetBorderThickness = default;
    }

    private static DateOnly? ResolveMonthDateFromPoint(Grid monthGrid, Point point)
    {
        foreach (var cell in monthGrid.Children.OfType<Border>())
        {
            if (cell.Tag is not DateOnly date) continue;
            var translated = cell.TranslatePoint(new Point(0, 0), monthGrid);
            if (translated is null) continue;
            var rect = new Rect(translated.Value, cell.Bounds.Size);
            if (rect.Contains(point)) return date;
        }

        return null;
    }

    private Control RenderWeekCalendar()
    {
        var dayCount = Math.Max(7, _weekPlan.Days.Count);
        _weekDayWidth = ResolveWeekDayWidth(dayCount);
        var canvasWidth = WeekTimeLabelWidth + dayCount * _weekDayWidth;
        var canvasHeight = WeekTopOffset + TimeText.FullDayEndMin * WeekPixelsPerMinute + 28;
        var canvas = new Canvas
        {
            Width = canvasWidth,
            Height = canvasHeight,
            Background = Brush("#ffffff")
        };
        canvas.PointerPressed += BeginWeekCreateSelection;
        canvas.PointerMoved += UpdateWeekCreateSelection;
        canvas.PointerReleased += async (_, args) => await FinishWeekCreateSelectionAsync(args);

        canvas.DoubleTapped += async (_, args) =>
        {
            var position = args.GetPosition(canvas);
            if (position.X < WeekTimeLabelWidth || position.Y < WeekTopOffset) return;

            var dayIndex = WeekDayIndexFromX(position.X);
            if (dayIndex is null || dayIndex.Value >= _weekPlan.Days.Count) return;

            _focusDate = _weekPlan.Days[dayIndex.Value].Date;
            _selectedRuntimeIds.Clear();
            RebuildSchedules();
            await CreateScheduleBlockAsync(MinuteFromWeekCanvasY(position.Y));
            args.Handled = true;
        };

        for (var i = 0; i < _weekPlan.Days.Count; i++)
        {
            AddWeekDayColumn(canvas, _weekPlan.Days[i], i, canvasHeight);
        }

        for (var minute = 0; minute <= TimeText.FullDayEndMin; minute += 30)
        {
            var y = WeekTopOffset + minute * WeekPixelsPerMinute;
            var line = TimelineDecoration(new Border
            {
                Background = Brush(minute % 60 == 0 ? "#e2e8f0" : "#f1f5f9"),
                Width = canvasWidth - WeekTimeLabelWidth,
                Height = 1
            });
            Canvas.SetLeft(line, WeekTimeLabelWidth);
            Canvas.SetTop(line, y);
            canvas.Children.Add(line);

            if (minute % 60 == 0)
            {
                var label = TimelineDecoration(Text(TimeText.ToTime(minute), 11, "#64748b"));
                Canvas.SetLeft(label, 6);
                Canvas.SetTop(label, y - 8);
                canvas.Children.Add(label);
            }
        }

        for (var i = 0; i < _weekPlan.Days.Count; i++)
        {
            var x = WeekTimeLabelWidth + i * _weekDayWidth;
            var separator = TimelineDecoration(new Border
            {
                Background = Brush("#e5e7eb"),
                Width = 1,
                Height = canvasHeight
            });
            Canvas.SetLeft(separator, x);
            Canvas.SetTop(separator, 0);
            canvas.Children.Add(separator);
        }

        foreach (var (day, dayIndex) in _weekPlan.Days.Select((day, index) => (day, index)))
        {
            var layouts = ComputeTimelineEventLayouts(day.Schedule.Blocks.Where(IsVisibleBlock));
            foreach (var block in day.Schedule.Blocks.Where(IsVisibleBlock).OrderBy(block => block.StartMin))
            {
                canvas.Children.Add(BuildWeekScheduleBlockControl(day, block, canvas, dayIndex, layouts[block.RuntimeId]));
            }
        }

        AddWeekCurrentTimeLine(canvas);

        var scroller = new ScrollViewer
        {
            Content = canvas,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto
        };
        AttachTimelineInitialScroll(scroller, ResolveWeekTimelineFocusMinute(), WeekTopOffset, WeekPixelsPerMinute);

        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#e5e7eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Child = scroller
        };
    }

    private int ResolveWeekTimelineFocusMinute()
    {
        var focusDay = _weekPlan.Days.FirstOrDefault(day => day.Date == _focusDate)?.Schedule;
        if (focusDay is not null)
        {
            var selected = focusDay.Blocks
                .Where(block => _selectedRuntimeIds.Contains(block.RuntimeId) && IsVisibleBlock(block))
                .OrderBy(block => block.StartMin)
                .FirstOrDefault();
            if (selected is not null) return Math.Max(0, selected.StartMin - 60);
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        if (_weekPlan.Days.Any(day => day.Date == today))
        {
            return Math.Max(0, CurrentMinute() - 90);
        }

        var focusFirst = focusDay?.Blocks
            .Where(IsVisibleBlock)
            .OrderBy(block => block.StartMin)
            .FirstOrDefault();
        if (focusFirst is not null) return Math.Max(0, focusFirst.StartMin - 60);

        var weekFirst = _weekPlan.Days
            .SelectMany(day => day.Schedule.Blocks.Where(IsVisibleBlock))
            .OrderBy(block => block.StartMin)
            .FirstOrDefault();
        return Math.Max(0, (weekFirst?.StartMin ?? WakeTimeMinute()) - 60);
    }

    private int WakeTimeMinute() => TimeText.ParseMinutes(_state.Preferences.WakeTime) ?? 8 * 60;

    private void AddWeekDayColumn(Canvas canvas, WeekDaySchedule day, int dayIndex, double canvasHeight)
    {
        var x = WeekTimeLabelWidth + dayIndex * _weekDayWidth;
        var today = day.Date == DateOnly.FromDateTime(DateTime.Today);
        var focused = day.Date == _focusDate;
        var compact = _weekDayWidth < 72;

        var background = new Border
        {
            Background = Brush(focused ? "#eff6ff" : today ? "#f8fafc" : "#ffffff"),
            Width = _weekDayWidth,
            Height = canvasHeight - WeekTopOffset
        };
        Canvas.SetLeft(background, x);
        Canvas.SetTop(background, WeekTopOffset);
        canvas.Children.Add(background);

        var headerStack = new StackPanel
        {
            Spacing = 2,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
        headerStack.Children.Add(Text($"周{WeekdayText(day.Date)}", compact ? 10 : 11, focused ? "#1d4ed8" : "#64748b", FontWeight.SemiBold));
        headerStack.Children.Add(Text(compact ? $"{day.Date:dd}" : $"{day.Date:MM-dd}", compact ? 13 : 16, focused ? "#1d4ed8" : "#111827", FontWeight.SemiBold));
        if (day.Schedule.Unscheduled.Count > 0)
        {
            headerStack.Children.Add(Text(compact ? $"未{day.Schedule.Unscheduled.Count}" : $"未排入 {day.Schedule.Unscheduled.Count}", 10, "#b45309", FontWeight.SemiBold));
        }

        var header = new Border
        {
            Background = Brush(focused ? "#dbeafe" : today ? "#f8fafc" : "#ffffff"),
            BorderBrush = Brush(focused ? "#2563eb" : "#e5e7eb"),
            BorderThickness = new Thickness(0, 0, 1, 1),
            Width = _weekDayWidth,
            Height = WeekTopOffset,
            Child = headerStack
        };
        header.PointerPressed += (_, args) =>
        {
            if (!args.GetCurrentPoint(header).Properties.IsLeftButtonPressed) return;
            _focusDate = day.Date;
            _selectedRuntimeIds.Clear();
            RebuildSchedules();
            RenderActivePage();
            args.Handled = true;
        };
        header.DoubleTapped += (_, args) =>
        {
            _focusDate = day.Date;
            _selectedRuntimeIds.Clear();
            SetScheduleView(ScheduleViewMode.Day, savePreference: true);
            RebuildSchedules();
            RenderActivePage();
            args.Handled = true;
        };
        Canvas.SetLeft(header, x);
        Canvas.SetTop(header, 0);
        canvas.Children.Add(header);
    }

    private Border BuildWeekScheduleBlockControl(WeekDaySchedule day, ScheduleBlock block, Canvas canvas, int dayIndex, TimelineEventLayout layout)
    {
        var done = IsBlockCompleted(block);
        var current = IsCurrentBlock(day.Date, block);
        var color = block.Type == ScheduleBlockType.Fixed ? "#dbeafe" : block.Category switch
        {
            "study" => "#dcfce7",
            "code" => "#ede9fe",
            "workout" => "#ffedd5",
            _ => "#f8fafc"
        };
        var eventLabel = Text(
            WeekEventText(block, done, layout),
            IsCompactWeekEvent(layout) ? 10 : 11,
            done ? "#64748b" : current ? "#991b1b" : "#0f172a",
            FontWeight.SemiBold);
        eventLabel.TextWrapping = TextWrapping.Wrap;
        eventLabel.TextTrimming = TextTrimming.CharacterEllipsis;
        var border = new Border
        {
            Tag = $"week:{day.Date:yyyy-MM-dd}:{block.RuntimeId}",
            Background = Brush(done ? "#f1f5f9" : color),
            BorderBrush = Brush(current ? "#ef4444" : "#cbd5e1"),
            BorderThickness = new Thickness(current ? 2 : 1),
            CornerRadius = new CornerRadius(6),
            Padding = _weekDayWidth < 58 ? new Thickness(4, 4) : new Thickness(7, 5),
            Opacity = done ? 0.7 : 1,
            Width = WeekEventWidth(layout),
            Height = Math.Max(24, block.DurationMin * WeekPixelsPerMinute - 3),
            Child = new Grid
            {
                RowDefinitions = new RowDefinitions("*,5")
            }
        };
        ToolTip.SetTip(border, ScheduleBlockTooltip(day.Date, block, done, current));
        var resizeGrip = new Border
        {
            Height = 4,
            Background = Brush("#64748b"),
            CornerRadius = new CornerRadius(3),
            Opacity = block.Editable ? 0.36 : 0,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            Margin = new Thickness(10, 0, 10, 0),
            Cursor = new Cursor(StandardCursorType.SizeNorthSouth)
        };
        resizeGrip.PointerPressed += (_, args) =>
        {
            if (!block.Editable || !args.GetCurrentPoint(resizeGrip).Properties.IsLeftButtonPressed) return;
            _resizeBlock = block;
            _resizeDate = day.Date;
            _resizeStart = args.GetPosition(canvas);
            _resizeOriginalStart = block.StartMin;
            _resizeOriginalEnd = block.EndMin;
            canvas.Children.Remove(border);
            canvas.Children.Add(border);
            args.Pointer.Capture(resizeGrip);
            args.Handled = true;
        };
        resizeGrip.PointerMoved += (_, args) =>
        {
            if (_resizeBlock is null || args.Pointer.Captured != resizeGrip) return;
            var previewEnd = ResolveResizeEnd(args.GetPosition(canvas), WeekPixelsPerMinute);
            border.Height = Math.Max(24, (previewEnd - block.StartMin) * WeekPixelsPerMinute - 3);
            var prefix = done ? "✓ " : "";
            eventLabel.Text = IsCompactWeekEvent(layout)
                ? $"{prefix}{block.Start}\n{block.Title}"
                : $"{prefix}{block.Start}-{TimeText.ToTime(previewEnd)}\n{block.Title}";
            border.Opacity = 0.86;
            args.Handled = true;
        };
        resizeGrip.PointerReleased += (_, args) =>
        {
            if (_resizeBlock is not null && args.Pointer.Captured == resizeGrip)
            {
                CommitResize(args.GetPosition(canvas), WeekPixelsPerMinute);
                args.Pointer.Capture(null);
                args.Handled = true;
            }
        };
        var rootGrid = (Grid)border.Child;
        Grid.SetRow(eventLabel, 0);
        Grid.SetRow(resizeGrip, 1);
        rootGrid.Children.Add(eventLabel);
        rootGrid.Children.Add(resizeGrip);
        Canvas.SetLeft(border, WeekEventLeft(dayIndex, layout));
        Canvas.SetTop(border, WeekTopOffset + block.StartMin * WeekPixelsPerMinute + 2);

        border.DoubleTapped += async (_, args) =>
        {
            args.Handled = true;
            await EditWeekScheduleBlockAsync(day.Date, block);
        };

        border.PointerPressed += (_, args) =>
        {
            if (args.GetCurrentPoint(border).Properties.IsRightButtonPressed)
            {
                return;
            }

            if (!args.GetCurrentPoint(border).Properties.IsLeftButtonPressed) return;
            _weekDragBlock = block;
            _weekDragDate = day.Date;
            _weekDragStart = args.GetPosition(canvas);
            _weekDragOriginalStart = block.StartMin;
            _weekDragOriginalEnd = block.EndMin;
            _weekDragOriginalDayIndex = dayIndex;
            canvas.Children.Remove(border);
            canvas.Children.Add(border);
            args.Pointer.Capture(border);
            args.Handled = true;
        };

        border.PointerMoved += (_, args) =>
        {
            if (_weekDragBlock is null || args.Pointer.Captured != border) return;

            var position = args.GetPosition(canvas);
            var duration = _weekDragOriginalEnd - _weekDragOriginalStart;
            var previewStart = ResolveWeekDragStart(position, duration);
            var previewDayIndex = WeekDayIndexFromX(position.X) ?? _weekDragOriginalDayIndex;
            previewDayIndex = Math.Clamp(previewDayIndex, 0, Math.Max(0, _weekPlan.Days.Count - 1));
            if (previewStart == _weekDragOriginalStart && previewDayIndex == _weekDragOriginalDayIndex) return;

            Canvas.SetLeft(border, WeekTimeLabelWidth + previewDayIndex * _weekDayWidth + 5);
            Canvas.SetTop(border, WeekTopOffset + previewStart * WeekPixelsPerMinute + 2);
            border.Width = Math.Max(18, _weekDayWidth - 10);
            border.Opacity = 0.86;
            args.Handled = true;
        };

        border.PointerReleased += (_, args) =>
        {
            if (_weekDragBlock is not null && args.Pointer.Captured == border)
            {
                CommitWeekDrag(args.GetPosition(canvas));
                args.Pointer.Capture(null);
                args.Handled = true;
            }
        };

        var menu = new ContextMenu();
        var complete = new MenuItem { Header = done ? "取消完成" : "标记完成" };
        complete.Click += async (_, _) => await ToggleBlockCompleteAsync(block);
        var edit = new MenuItem { Header = "编辑" };
        edit.Click += async (_, _) => await EditWeekScheduleBlockAsync(day.Date, block);
        var openDay = new MenuItem { Header = "打开日视图" };
        openDay.Click += (_, _) =>
        {
            _focusDate = day.Date;
            SetScheduleView(ScheduleViewMode.Day, savePreference: true);
            _selectedRuntimeIds.Clear();
            RebuildSchedules();
            RenderActivePage();
        };
        var delete = new MenuItem { Header = "删除" };
        delete.Click += async (_, _) => await DeleteBlockOnDateAsync(day.Date, block);
        menu.Items.Add(complete);
        menu.Items.Add(edit);
        menu.Items.Add(openDay);
        menu.Items.Add(delete);
        border.ContextMenu = menu;

        return border;
    }

    private static Dictionary<string, TimelineEventLayout> ComputeTimelineEventLayouts(IEnumerable<ScheduleBlock> blocks)
    {
        var ordered = blocks
            .OrderBy(block => block.StartMin)
            .ThenBy(block => block.EndMin)
            .ToList();
        var layouts = new Dictionary<string, TimelineEventLayout>();
        var group = new List<ScheduleBlock>();
        var groupEnd = -1;

        foreach (var block in ordered)
        {
            if (group.Count > 0 && block.StartMin >= groupEnd)
            {
                AssignTimelineEventGroupLayouts(group, layouts);
                group.Clear();
                groupEnd = -1;
            }

            group.Add(block);
            groupEnd = Math.Max(groupEnd, block.EndMin);
        }

        if (group.Count > 0)
        {
            AssignTimelineEventGroupLayouts(group, layouts);
        }

        return layouts;
    }

    private static void AssignTimelineEventGroupLayouts(IReadOnlyList<ScheduleBlock> group, Dictionary<string, TimelineEventLayout> layouts)
    {
        var laneEnds = new List<int>();
        var laneById = new Dictionary<string, int>();

        foreach (var block in group.OrderBy(block => block.StartMin).ThenBy(block => block.EndMin))
        {
            var lane = laneEnds.FindIndex(end => end <= block.StartMin);
            if (lane < 0)
            {
                lane = laneEnds.Count;
                laneEnds.Add(block.EndMin);
            }
            else
            {
                laneEnds[lane] = block.EndMin;
            }

            laneById[block.RuntimeId] = lane;
        }

        var laneCount = Math.Max(1, laneEnds.Count);
        foreach (var block in group)
        {
            layouts[block.RuntimeId] = new TimelineEventLayout(laneById[block.RuntimeId], laneCount);
        }
    }

    private double WeekEventWidth(TimelineEventLayout layout)
    {
        var gap = layout.LaneCount <= 1 ? 0 : 3;
        var available = _weekDayWidth - 10;
        return Math.Max(18, (available - gap * (layout.LaneCount - 1)) / layout.LaneCount);
    }

    private double DayEventWidthForLayout(TimelineEventLayout layout)
    {
        var gap = layout.LaneCount <= 1 ? 0 : 5;
        return Math.Max(56, (_dayEventWidth - gap * (layout.LaneCount - 1)) / layout.LaneCount);
    }

    private double DayEventLeft(TimelineEventLayout layout)
    {
        var gap = layout.LaneCount <= 1 ? 0 : 5;
        return DayLabelWidth + 14 + layout.Lane * (DayEventWidthForLayout(layout) + gap);
    }

    private double WeekEventLeft(int dayIndex, TimelineEventLayout layout)
    {
        var gap = layout.LaneCount <= 1 ? 0 : 3;
        return WeekTimeLabelWidth + dayIndex * _weekDayWidth + 5 + layout.Lane * (WeekEventWidth(layout) + gap);
    }

    private string WeekEventText(ScheduleBlock block, bool done, TimelineEventLayout layout)
    {
        var prefix = done ? "✓ " : "";
        return IsCompactWeekEvent(layout)
            ? $"{prefix}{block.Start}\n{block.Title}"
            : $"{prefix}{block.Start}-{block.End}\n{block.Title}";
    }

    private bool IsCompactWeekEvent(TimelineEventLayout layout) => _weekDayWidth < 66 || layout.LaneCount > 2;

    private sealed record TimelineEventLayout(int Lane, int LaneCount);

    private void AddWeekCurrentTimeLine(Canvas canvas)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var dayIndex = _weekPlan.Days.FindIndex(day => day.Date == today);
        if (dayIndex < 0) return;

        var now = CurrentMinute();
        if (now < TimeText.FullDayStartMin || now > TimeText.FullDayEndMin) return;

        var x = WeekTimeLabelWidth + dayIndex * _weekDayWidth;
        var y = WeekTopOffset + now * WeekPixelsPerMinute;
        var line = TimelineDecoration(new Border
        {
            Background = Brush("#ef4444"),
            Width = _weekDayWidth,
            Height = 2,
            CornerRadius = new CornerRadius(1)
        });
        Canvas.SetLeft(line, x);
        Canvas.SetTop(line, y);
        canvas.Children.Add(line);

        var dot = TimelineDecoration(new Border
        {
            Background = Brush("#ef4444"),
            Width = 8,
            Height = 8,
            CornerRadius = new CornerRadius(4)
        });
        Canvas.SetLeft(dot, x - 4);
        Canvas.SetTop(dot, y - 3);
        canvas.Children.Add(dot);
    }

    private async Task EditWeekScheduleBlockAsync(DateOnly date, ScheduleBlock block)
    {
        _focusDate = date;
        RebuildSchedules();
        var target = _daySchedule.Blocks.FirstOrDefault(item => item.RuntimeId == block.RuntimeId);
        if (target is null)
        {
            SetStatus("没有找到要编辑的日程", error: true);
            RenderActivePage();
            return;
        }

        await EditScheduleBlockAsync(target);
    }

    private async Task DeleteBlockOnDateAsync(DateOnly date, ScheduleBlock block)
    {
        _focusDate = date;
        RebuildSchedules();
        _selectedRuntimeIds.Clear();
        _selectedRuntimeIds.Add(block.RuntimeId);
        await DeleteSelectedAsync(confirmMulti: false);
    }

    private void CommitWeekDrag(Point releasePoint)
    {
        if (_weekDragBlock is null) return;

        var draggedId = _weekDragBlock.RuntimeId;
        var sourceDate = _weekDragDate;
        var duration = _weekDragOriginalEnd - _weekDragOriginalStart;
        var nextStart = ResolveWeekDragStart(releasePoint, duration);
        var targetDayIndex = WeekDayIndexFromX(releasePoint.X) ?? _weekDragOriginalDayIndex;
        targetDayIndex = Math.Clamp(targetDayIndex, 0, Math.Max(0, _weekPlan.Days.Count - 1));
        var targetDate = _weekPlan.Days[targetDayIndex].Date;

        _weekDragBlock = null;

        if (targetDate == sourceDate && nextStart == _weekDragOriginalStart)
        {
            return;
        }

        if (targetDate == sourceDate)
        {
            _focusDate = sourceDate;
            RebuildSchedules();
            var target = _daySchedule.Blocks.FirstOrDefault(block => block.RuntimeId == draggedId && block.Editable);
            if (target is null)
            {
                SetStatus("没有找到可拖动的日程", error: true);
                RenderActivePage();
                return;
            }

            CaptureUndo("周视图拖动");
            target.StartMin = nextStart;
            target.EndMin = nextStart + duration;
            _daySchedule.Blocks = [.. _daySchedule.Blocks.OrderBy(block => block.StartMin).ThenBy(block => block.EndMin)];
            SaveCurrentDayOverride($"已拖动 {target.Title}");
            RenderActivePage();
            return;
        }

        MoveBlockAcrossDays(draggedId, sourceDate, targetDate, nextStart, duration);
    }

    private void MoveBlockAcrossDays(string runtimeId, DateOnly sourceDate, DateOnly targetDate, int nextStart, int duration)
    {
        CaptureUndo("跨日移动", [sourceDate, targetDate]);
        var sourceSchedule = BuildScheduleForDate(sourceDate);
        var sourceBlock = sourceSchedule.Blocks.FirstOrDefault(block => block.RuntimeId == runtimeId && block.Editable);
        if (sourceBlock is null)
        {
            ClearUndo();
            SetStatus("没有找到可跨日移动的日程", error: true);
            RenderActivePage();
            return;
        }

        var moved = sourceBlock.Clone();
        sourceSchedule.Blocks.Remove(sourceBlock);
        moved.RuntimeId = Ids.New("manual");
        moved.SourceId = null;
        moved.StartMin = nextStart;
        moved.EndMin = nextStart + duration;
        moved.Editable = true;

        var targetSchedule = BuildScheduleForDate(targetDate);
        targetSchedule.Blocks.Add(moved);
        sourceSchedule.Blocks = [.. sourceSchedule.Blocks.OrderBy(block => block.StartMin).ThenBy(block => block.EndMin)];
        targetSchedule.Blocks = [.. targetSchedule.Blocks.OrderBy(block => block.StartMin).ThenBy(block => block.EndMin)];

        if (IsBlockCompleted(sourceBlock))
        {
            _state.Completed.Remove(sourceBlock.RuntimeId);
            _state.Completed[moved.RuntimeId] = true;
        }

        _state.DayOverrides[DateKey(sourceDate)] = sourceSchedule.Clone();
        _state.DayOverrides[DateKey(targetDate)] = targetSchedule.Clone();
        _focusDate = targetDate;
        RebuildSchedules();

        var issues = ComputeManualScheduleIssues(sourceSchedule).Concat(ComputeManualScheduleIssues(targetSchedule)).ToList();
        var suffix = issues.Count > 0 ? $"；发现 {issues.Count} 个时间问题" : "";
        var hasError = issues.Any(issue => issue.Level == ScheduleIssueLevel.Error);
        var message = $"已把 {moved.Title} 移到 {targetDate:yyyy-MM-dd} {moved.Start}-{moved.End}{suffix}";
        SetStatus($"{message}，正在自动保存", error: hasError);
        QueueStateAutosave($"{message}，并已自动保存", hasError);
        RenderActivePage();
    }

    private int? WeekDayIndexFromX(double x)
    {
        var index = (int)Math.Floor((x - WeekTimeLabelWidth) / _weekDayWidth);
        return index < 0 || index >= _weekPlan.Days.Count ? null : index;
    }

    private int ResolveWeekDragStart(Point point, int duration)
    {
        var minuteDelta = (int)Math.Round((point.Y - _weekDragStart.Y) / WeekPixelsPerMinute / 15.0) * 15;
        return Math.Clamp(_weekDragOriginalStart + minuteDelta, 0, TimeText.FullDayEndMin - duration);
    }

    private void BeginWeekCreateSelection(object? sender, PointerPressedEventArgs args)
    {
        if (sender is not Canvas canvas) return;
        if (!args.GetCurrentPoint(canvas).Properties.IsLeftButtonPressed) return;

        var position = args.GetPosition(canvas);
        if (position.X < WeekTimeLabelWidth || position.Y < WeekTopOffset) return;

        var dayIndex = WeekDayIndexFromX(position.X);
        if (dayIndex is null) return;

        _isWeekCreating = true;
        _weekCreateMoved = false;
        _weekCreateDayIndex = dayIndex.Value;
        _weekCreateAnchorMin = MinuteFromWeekCanvasY(position.Y, allowFullEnd: true);
        _weekCreateStartMin = _weekCreateAnchorMin;
        _weekCreateEndMin = Math.Min(TimeText.FullDayEndMin, _weekCreateStartMin + 30);
        _weekCreatePreview = BuildWeekCreatePreview();
        Canvas.SetLeft(_weekCreatePreview, WeekTimeLabelWidth + _weekCreateDayIndex * _weekDayWidth + 5);
        UpdateWeekCreatePreview();
        canvas.Children.Add(_weekCreatePreview);
        args.Pointer.Capture(canvas);
        args.Handled = true;
    }

    private void UpdateWeekCreateSelection(object? sender, PointerEventArgs args)
    {
        if (!_isWeekCreating || sender is not Canvas canvas || _weekCreatePreview is null) return;

        var position = args.GetPosition(canvas);
        var current = MinuteFromWeekCanvasY(position.Y, allowFullEnd: true);
        if (Math.Abs(current - _weekCreateAnchorMin) >= 15)
        {
            _weekCreateMoved = true;
        }

        var start = Math.Min(_weekCreateAnchorMin, current);
        var end = Math.Max(_weekCreateAnchorMin, current);
        if (end - start < 15)
        {
            if (current < _weekCreateAnchorMin)
            {
                start = Math.Max(TimeText.FullDayStartMin, _weekCreateAnchorMin - 15);
                end = _weekCreateAnchorMin;
            }
            else
            {
                start = _weekCreateAnchorMin;
                end = Math.Min(TimeText.FullDayEndMin, _weekCreateAnchorMin + 30);
            }
        }

        _weekCreateStartMin = start;
        _weekCreateEndMin = end;
        UpdateWeekCreatePreview();
        args.Handled = true;
    }

    private async Task FinishWeekCreateSelectionAsync(PointerReleasedEventArgs args)
    {
        if (!_isWeekCreating) return;

        if (args.Pointer.Captured is Canvas)
        {
            args.Pointer.Capture(null);
        }

        var preview = _weekCreatePreview;
        _weekCreatePreview = null;
        _isWeekCreating = false;

        if (preview?.Parent is Canvas canvas)
        {
            canvas.Children.Remove(preview);
        }

        if (!_weekCreateMoved || _weekCreateEndMin - _weekCreateStartMin < 15 || _weekCreateDayIndex >= _weekPlan.Days.Count)
        {
            args.Handled = true;
            return;
        }

        _focusDate = _weekPlan.Days[_weekCreateDayIndex].Date;
        _selectedRuntimeIds.Clear();
        RebuildSchedules();
        await CreateScheduleBlockAsync(_weekCreateStartMin, _weekCreateEndMin);
        args.Handled = true;
    }

    private Border BuildWeekCreatePreview()
    {
        return new Border
        {
            Background = Brush("#dbeafeaa"),
            BorderBrush = Brush("#2563eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(6),
            Padding = _weekDayWidth < 58 ? new Thickness(4, 4) : new Thickness(7, 5),
            Width = Math.Max(18, _weekDayWidth - 10)
        };
    }

    private void UpdateWeekCreatePreview()
    {
        if (_weekCreatePreview is null) return;

        Canvas.SetTop(_weekCreatePreview, WeekTopOffset + _weekCreateStartMin * WeekPixelsPerMinute + 2);
        _weekCreatePreview.Height = Math.Max(24, (_weekCreateEndMin - _weekCreateStartMin) * WeekPixelsPerMinute - 3);
        _weekCreatePreview.Child = Text($"{TimeText.ToTime(_weekCreateStartMin)}-{TimeText.ToTime(_weekCreateEndMin)}\n新日程", 11, "#1d4ed8", FontWeight.SemiBold);
    }

    private static int MinuteFromWeekCanvasY(double y, bool allowFullEnd = false)
    {
        var raw = (int)Math.Round((y - WeekTopOffset) / WeekPixelsPerMinute / 15.0) * 15;
        return Math.Clamp(raw, TimeText.FullDayStartMin, allowFullEnd ? TimeText.FullDayEndMin : TimeText.FullDayEndMin - 30);
    }

    private Control RenderRules()
    {
        var root = PageStack();
        root.Children.Add(Header("规则", "管理自动排程的基础模板。固定事项优先占用时间，重复任务会按规则填入空档。"));
        root.Children.Add(RenderRulesSummary());
        root.Children.Add(RenderRulesFilter());
        var columns = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,*"),
            ColumnSpacing = 16
        };
        var fixedPanel = RenderFixedRulesPanel();
        var taskPanel = RenderTaskRulesPanel();
        Grid.SetColumn(fixedPanel, 0);
        Grid.SetColumn(taskPanel, 1);
        columns.Children.Add(fixedPanel);
        columns.Children.Add(taskPanel);
        root.Children.Add(columns);
        return Scroll(root);
    }

    private Control RenderRulesSummary()
    {
        var grid = new UniformGrid { Columns = 3 };
        grid.Children.Add(StatCard("固定事项", _state.FixedEvents.Count.ToString()));
        grid.Children.Add(StatCard("重复任务", _state.Tasks.Count.ToString()));
        grid.Children.Add(StatCard("当前星期", $"周{WeekdayText(_focusDate)}"));
        return grid;
    }

    private Control RenderRulesFilter()
    {
        var input = new TextBox
        {
            Text = _rulesFilter,
            Watermark = "搜索标题、时间、类别或星期",
            MinHeight = 38
        };
        var row = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,Auto,Auto"),
            ColumnSpacing = 8
        };
        Grid.SetColumn(input, 0);
        row.Children.Add(input);
        var search = Button("筛选", (_, _) =>
        {
            _rulesFilter = (input.Text ?? "").Trim();
            RenderActivePage();
        }, secondary: true);
        var clear = Button("清空", (_, _) =>
        {
            _rulesFilter = "";
            RenderActivePage();
        }, secondary: true);
        Grid.SetColumn(search, 1);
        Grid.SetColumn(clear, 2);
        row.Children.Add(search);
        row.Children.Add(clear);
        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#e5e7eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(12),
            Child = row
        };
    }

    private bool FixedRuleMatchesFilter(FixedEventRule item)
    {
        if (string.IsNullOrWhiteSpace(_rulesFilter)) return true;
        var query = _rulesFilter.Trim();
        return ContainsQuery(item.Title, query) ||
               ContainsQuery(item.Start, query) ||
               ContainsQuery(item.End, query) ||
               ContainsQuery(WeekdaysText(item.DaysOfWeek), query);
    }

    private bool TaskRuleMatchesFilter(TaskRule item)
    {
        if (string.IsNullOrWhiteSpace(_rulesFilter)) return true;
        var query = _rulesFilter.Trim();
        return ContainsQuery(item.Title, query) ||
               ContainsQuery(item.DurationMin.ToString(), query) ||
               ContainsQuery(CategoryLabel(item.Category), query) ||
               ContainsQuery($"P{item.Priority}", query) ||
               ContainsQuery(WeekdaysText(item.DaysOfWeek), query);
    }

    private static bool ContainsQuery(string value, string query)
    {
        return value.Contains(query, StringComparison.OrdinalIgnoreCase);
    }

    private Control RenderFixedRulesPanel()
    {
        var root = new StackPanel { Spacing = 10, Margin = new Thickness(4) };
        root.Children.Add(Text("固定事项", 17, "#111827", FontWeight.SemiBold));
        root.Children.Add(Text("课程、考试、通勤、会议等不可移动时间。可勾选多个适用星期。", 12, "#64748b"));
        var filtered = _state.FixedEvents
            .Where(FixedRuleMatchesFilter)
            .OrderBy(item => item.Start)
            .ThenBy(item => item.Title)
            .ToList();

        if (_state.FixedEvents.Count == 0)
        {
            root.Children.Add(RulesEmptyState("还没有固定事项。先添加课程、考试或会议，日程会自动避开这些时间。"));
        }
        else if (filtered.Count == 0)
        {
            root.Children.Add(RulesEmptyState("没有匹配的固定事项。"));
        }
        else
        {
            foreach (var item in filtered)
            {
                root.Children.Add(RuleRow(
                    item.Title,
                    $"{item.Start}-{item.End}",
                    $"适用：{WeekdaysText(item.DaysOfWeek)}{(item.BufferMin > 0 ? $" · 前后缓冲 {item.BufferMin} 分钟" : "")}",
                    "#1a73e8",
                    async () => await EditFixedRuleAsync(item),
                    () =>
                    {
                        _state.FixedEvents.Remove(item);
                        RebuildSchedules();
                        SetStatus($"已删除固定事项：{item.Title}，正在自动保存");
                        QueueStateAutosave($"已删除固定事项：{item.Title}");
                        RenderActivePage();
                    }));
            }
        }

        var titleInput = new TextBox { Watermark = "标题" };
        var startInput = new TextBox { Watermark = "开始 09:00" };
        var endInput = new TextBox { Watermark = "结束 10:00" };
        var bufferInput = new TextBox { Watermark = "缓冲 10" };
        var weekdayPicker = BuildWeekdayPicker([TimeText.WeekdayNumber(_focusDate)]);
        var inputGrid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,86,86,86"),
            ColumnSpacing = 8
        };
        Grid.SetColumn(titleInput, 0);
        Grid.SetColumn(startInput, 1);
        Grid.SetColumn(endInput, 2);
        Grid.SetColumn(bufferInput, 3);
        inputGrid.Children.Add(titleInput);
        inputGrid.Children.Add(startInput);
        inputGrid.Children.Add(endInput);
        inputGrid.Children.Add(bufferInput);
        root.Children.Add(inputGrid);
        root.Children.Add(Field("适用星期", weekdayPicker.Panel));
        root.Children.Add(Button("添加固定事项", (_, _) =>
        {
            if (!AddFixedRule(titleInput.Text ?? "", startInput.Text ?? "", endInput.Text ?? "", bufferInput.Text ?? "", SelectedWeekdays(weekdayPicker.Boxes)))
            {
                return;
            }

            titleInput.Text = "";
            startInput.Text = "";
            endInput.Text = "";
            bufferInput.Text = "";
            RebuildSchedules();
            QueueStateAutosave("固定事项已自动保存");
            RenderActivePage();
        }));

        return Card("固定事项", root);
    }

    private Control RenderTaskRulesPanel()
    {
        var root = new StackPanel { Spacing = 10, Margin = new Thickness(4) };
        root.Children.Add(Text("重复任务", 17, "#111827", FontWeight.SemiBold));
        root.Children.Add(Text("学习、训练、项目块等可移动任务。每周次数会自动分配到空档。", 12, "#64748b"));
        var filtered = _state.Tasks
            .Where(TaskRuleMatchesFilter)
            .OrderByDescending(item => item.Priority)
            .ThenBy(item => item.Title)
            .ToList();

        if (_state.Tasks.Count == 0)
        {
            root.Children.Add(RulesEmptyState("还没有重复任务。添加学习、训练或项目块后，系统会自动安排到空档。"));
        }
        else if (filtered.Count == 0)
        {
            root.Children.Add(RulesEmptyState("没有匹配的重复任务。"));
        }
        else
        {
            foreach (var item in filtered)
            {
                var target = item.WeeklyTargetCount > 0 ? $" · 每周 {item.WeeklyTargetCount} 次" : "";
                root.Children.Add(RuleRow(
                    item.Title,
                    $"{item.DurationMin} 分钟 · {CategoryLabel(item.Category)} · P{item.Priority}",
                    $"适用：{WeekdaysText(item.DaysOfWeek)}{target}",
                    MonthEventAccent(new ScheduleBlock { Category = item.Category, Type = ScheduleBlockType.Task }),
                    async () => await EditTaskRuleAsync(item),
                    () =>
                    {
                        _state.Tasks.Remove(item);
                        RebuildSchedules();
                        SetStatus($"已删除任务规则：{item.Title}，正在自动保存");
                        QueueStateAutosave($"已删除任务规则：{item.Title}");
                        RenderActivePage();
                    }));
            }
        }

        var titleInput = new TextBox { Watermark = "标题" };
        var durationInput = new TextBox { Watermark = "时长 30" };
        var priorityInput = new TextBox { Watermark = "优先级 3" };
        var targetInput = new TextBox { Watermark = "每周次数" };
        var weekdayPicker = BuildWeekdayPicker([TimeText.WeekdayNumber(_focusDate)]);
        var categories = CategoryOptionsFor("study");
        var categoryInput = new ComboBox
        {
            ItemsSource = categories,
            SelectedItem = categories.FirstOrDefault(item => item.Value == "study") ?? categories.First(),
            MinHeight = 38
        };
        var inputGrid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,82,78,82,120"),
            ColumnSpacing = 8
        };
        Grid.SetColumn(titleInput, 0);
        Grid.SetColumn(durationInput, 1);
        Grid.SetColumn(priorityInput, 2);
        Grid.SetColumn(targetInput, 3);
        Grid.SetColumn(categoryInput, 4);
        inputGrid.Children.Add(titleInput);
        inputGrid.Children.Add(durationInput);
        inputGrid.Children.Add(priorityInput);
        inputGrid.Children.Add(targetInput);
        inputGrid.Children.Add(categoryInput);
        root.Children.Add(inputGrid);
        root.Children.Add(Field("适用星期", weekdayPicker.Panel));
        root.Children.Add(Button("添加重复任务", (_, _) =>
        {
            var category = categoryInput.SelectedItem is CategoryOption option ? option.Value : "study";
            if (!AddTaskRule(titleInput.Text ?? "", durationInput.Text ?? "", category, priorityInput.Text ?? "", targetInput.Text ?? "", SelectedWeekdays(weekdayPicker.Boxes)))
            {
                return;
            }

            titleInput.Text = "";
            durationInput.Text = "";
            priorityInput.Text = "";
            targetInput.Text = "";
            RebuildSchedules();
            QueueStateAutosave("任务规则已自动保存");
            RenderActivePage();
        }));

        return Card("重复任务", root);
    }

    private async Task EditFixedRuleAsync(FixedEventRule item)
    {
        var title = new TextBox { Text = item.Title, Watermark = "标题" };
        var start = new TextBox { Text = item.Start, Watermark = "09:00" };
        var end = new TextBox { Text = item.End, Watermark = "10:00" };
        var buffer = new TextBox { Text = item.BufferMin > 0 ? item.BufferMin.ToString() : "", Watermark = "缓冲分钟" };
        var weekdayPicker = BuildWeekdayPicker(item.DaysOfWeek);
        var status = Text("", 12, "#64748b");

        var form = new StackPanel { Spacing = 11, Margin = new Thickness(18) };
        form.Children.Add(Text("编辑固定事项", 20, "#111827", FontWeight.SemiBold));
        form.Children.Add(Text("固定事项会优先占用时间，自动排程会避开它和缓冲区。", 12, "#64748b"));
        form.Children.Add(Field("标题", title));
        var timeGrid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,*,120"),
            ColumnSpacing = 10
        };
        var startField = Field("开始", start);
        var endField = Field("结束", end);
        var bufferField = Field("缓冲", buffer);
        Grid.SetColumn(startField, 0);
        Grid.SetColumn(endField, 1);
        Grid.SetColumn(bufferField, 2);
        timeGrid.Children.Add(startField);
        timeGrid.Children.Add(endField);
        timeGrid.Children.Add(bufferField);
        form.Children.Add(timeGrid);
        form.Children.Add(Field("适用星期", weekdayPicker.Panel));
        form.Children.Add(status);

        var dialog = new Window
        {
            Title = "编辑固定事项",
            Width = 500,
            Height = 520,
            MinWidth = 430,
            MinHeight = 480,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Background = Brush("#f8fafc")
        };
        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Spacing = 8
        };
        actions.Children.Add(Button("取消", (_, _) => dialog.Close(false), secondary: true));
        actions.Children.Add(Button("保存", (_, _) =>
        {
            var nextTitle = (title.Text ?? "").Trim();
            var startMin = TimeText.ParseMinutes(start.Text);
            var endMin = TimeText.ParseMinutes(end.Text);
            var days = SelectedWeekdays(weekdayPicker.Boxes);
            if (nextTitle.Length == 0)
            {
                status.Text = "固定事项需要标题。";
                status.Foreground = Brush("#dc2626");
                return;
            }
            if (startMin is null || endMin is null || endMin <= startMin)
            {
                status.Text = "请输入有效时间，例如 09:00 到 10:00。";
                status.Foreground = Brush("#dc2626");
                return;
            }
            if (!string.IsNullOrWhiteSpace(buffer.Text) && !int.TryParse(buffer.Text, out _))
            {
                status.Text = "缓冲必须是分钟数。";
                status.Foreground = Brush("#dc2626");
                return;
            }
            if (days.Count == 0)
            {
                status.Text = "请选择适用星期。";
                status.Foreground = Brush("#dc2626");
                return;
            }

            item.Title = nextTitle;
            item.Start = TimeText.ToTime(startMin.Value);
            item.End = TimeText.ToTime(endMin.Value);
            item.BufferMin = int.TryParse(buffer.Text, out var bufferMin) ? Math.Clamp(bufferMin, 0, 180) : 0;
            item.DaysOfWeek = days;
            RebuildSchedules();
            SetStatus($"已编辑固定事项：{item.Title}，正在自动保存");
            QueueStateAutosave($"固定事项已自动保存：{item.Title}");
            dialog.Close(true);
        }));
        form.Children.Add(actions);
        dialog.Content = form;
        dialog.Opened += (_, _) =>
        {
            title.Focus();
            title.SelectAll();
        };

        if (await dialog.ShowDialog<bool>(this))
        {
            RenderActivePage();
        }
    }

    private async Task EditTaskRuleAsync(TaskRule item)
    {
        var title = new TextBox { Text = item.Title, Watermark = "标题" };
        var duration = new TextBox { Text = item.DurationMin.ToString(), Watermark = "时长分钟" };
        var priority = new TextBox { Text = item.Priority.ToString(), Watermark = "1-5" };
        var target = new TextBox { Text = item.WeeklyTargetCount > 0 ? item.WeeklyTargetCount.ToString() : "", Watermark = "每周次数" };
        var weekdayPicker = BuildWeekdayPicker(item.DaysOfWeek);
        var categories = CategoryOptionsFor(item.Category);
        var category = new ComboBox
        {
            ItemsSource = categories,
            SelectedItem = categories.FirstOrDefault(option => option.Value == item.Category) ?? categories.First(),
            MinHeight = 38
        };
        var status = Text("", 12, "#64748b");

        var form = new StackPanel { Spacing = 11, Margin = new Thickness(18) };
        form.Children.Add(Text("编辑重复任务", 20, "#111827", FontWeight.SemiBold));
        form.Children.Add(Text("重复任务会按优先级填入空档；每周次数为空时按勾选星期执行。", 12, "#64748b"));
        form.Children.Add(Field("标题", title));
        var inputGrid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,90,90"),
            ColumnSpacing = 10
        };
        var durationField = Field("时长", duration);
        var priorityField = Field("优先级", priority);
        var targetField = Field("每周次数", target);
        Grid.SetColumn(durationField, 0);
        Grid.SetColumn(priorityField, 1);
        Grid.SetColumn(targetField, 2);
        inputGrid.Children.Add(durationField);
        inputGrid.Children.Add(priorityField);
        inputGrid.Children.Add(targetField);
        form.Children.Add(inputGrid);
        form.Children.Add(Field("类别", category));
        form.Children.Add(Field("适用星期", weekdayPicker.Panel));
        form.Children.Add(status);

        var dialog = new Window
        {
            Title = "编辑重复任务",
            Width = 520,
            Height = 610,
            MinWidth = 450,
            MinHeight = 540,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Background = Brush("#f8fafc")
        };
        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Spacing = 8
        };
        actions.Children.Add(Button("取消", (_, _) => dialog.Close(false), secondary: true));
        actions.Children.Add(Button("保存", (_, _) =>
        {
            var nextTitle = (title.Text ?? "").Trim();
            var days = SelectedWeekdays(weekdayPicker.Boxes);
            if (nextTitle.Length == 0)
            {
                status.Text = "重复任务需要标题。";
                status.Foreground = Brush("#dc2626");
                return;
            }
            if (!int.TryParse(duration.Text, out var durationMin))
            {
                status.Text = "时长必须是分钟数。";
                status.Foreground = Brush("#dc2626");
                return;
            }
            if (!int.TryParse(priority.Text, out var priorityValue))
            {
                status.Text = "优先级必须是 1 到 5 的数字。";
                status.Foreground = Brush("#dc2626");
                return;
            }
            if (!string.IsNullOrWhiteSpace(target.Text) && !int.TryParse(target.Text, out _))
            {
                status.Text = "每周次数必须是数字。";
                status.Foreground = Brush("#dc2626");
                return;
            }
            if (days.Count == 0 && string.IsNullOrWhiteSpace(target.Text))
            {
                status.Text = "请选择适用星期，或填写每周次数让系统自动分配。";
                status.Foreground = Brush("#dc2626");
                return;
            }

            item.Title = nextTitle;
            item.DurationMin = Math.Clamp(durationMin, 5, 480);
            item.Priority = Math.Clamp(priorityValue, 1, 5);
            item.WeeklyTargetCount = int.TryParse(target.Text, out var targetValue) ? Math.Clamp(targetValue, 0, 7) : 0;
            item.Category = category.SelectedItem is CategoryOption option ? option.Value : "other";
            item.DaysOfWeek = days;
            RebuildSchedules();
            SetStatus($"已编辑任务规则：{item.Title}，正在自动保存");
            QueueStateAutosave($"任务规则已自动保存：{item.Title}");
            dialog.Close(true);
        }));
        form.Children.Add(actions);
        dialog.Content = form;
        dialog.Opened += (_, _) =>
        {
            title.Focus();
            title.SelectAll();
        };

        if (await dialog.ShowDialog<bool>(this))
        {
            RenderActivePage();
        }
    }

    private Control RuleRow(string title, string meta, string detail, string accent, Func<Task> edit, Action delete)
    {
        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto"),
            ColumnSpacing = 8
        };
        var marker = new Border
        {
            Width = 4,
            Background = Brush(accent),
            CornerRadius = new CornerRadius(3),
            HorizontalAlignment = HorizontalAlignment.Stretch
        };
        var text = new StackPanel { Spacing = 3 };
        text.Children.Add(Text(title, 13, "#111827", FontWeight.SemiBold));
        text.Children.Add(Text(meta, 11, "#64748b"));
        text.Children.Add(Text(detail, 11, "#64748b"));
        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Spacing = 6
        };
        var editButton = Button("编辑", async (_, _) => await edit(), secondary: true);
        var deleteButton = Button("删除", (_, _) => delete(), danger: true);
        editButton.Padding = new Thickness(9, 5);
        deleteButton.Padding = new Thickness(9, 5);
        actions.Children.Add(editButton);
        actions.Children.Add(deleteButton);
        Grid.SetColumn(marker, 0);
        Grid.SetColumn(text, 1);
        Grid.SetColumn(actions, 2);
        grid.Children.Add(marker);
        grid.Children.Add(text);
        grid.Children.Add(actions);
        return new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10),
            Child = grid
        };
    }

    private static Control RulesEmptyState(string message)
    {
        return new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(12),
            Child = Text(message, 12, "#64748b")
        };
    }

    private WeekdayPicker BuildWeekdayPicker(IEnumerable<int> selectedDays)
    {
        var selected = selectedDays.ToHashSet();
        var row = new WrapPanel { Orientation = Orientation.Horizontal };
        var boxes = new List<CheckBox>();
        for (var day = 0; day < 7; day++)
        {
            var box = new CheckBox
            {
                Content = $"周{"日一二三四五六"[day]}",
                IsChecked = selected.Contains(day),
                Tag = day,
                Margin = new Thickness(0, 0, 10, 6),
                MinHeight = 28
            };
            boxes.Add(box);
            row.Children.Add(box);
        }

        var quick = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 6 };
        quick.Children.Add(Button("工作日", (_, _) =>
        {
            foreach (var box in boxes)
            {
                box.IsChecked = box.Tag is int day && day is >= 1 and <= 5;
            }
        }, secondary: true));
        quick.Children.Add(Button("周末", (_, _) =>
        {
            foreach (var box in boxes)
            {
                box.IsChecked = box.Tag is int day && day is 0 or 6;
            }
        }, secondary: true));
        quick.Children.Add(Button("每天", (_, _) =>
        {
            foreach (var box in boxes)
            {
                box.IsChecked = true;
            }
        }, secondary: true));

        foreach (var button in quick.Children.OfType<Button>())
        {
            button.Padding = new Thickness(8, 4);
            button.MinHeight = 28;
        }

        var panel = new StackPanel { Spacing = 6 };
        panel.Children.Add(row);
        panel.Children.Add(quick);
        return new WeekdayPicker(panel, boxes);
    }

    private static List<int> SelectedWeekdays(IEnumerable<CheckBox> boxes)
    {
        return boxes
            .Where(box => box.IsChecked == true && box.Tag is int)
            .Select(box => (int)box.Tag!)
            .OrderBy(day => day)
            .ToList();
    }

    private static string WeekdaysText(IReadOnlyCollection<int> days)
    {
        if (days.Count == 0) return "未指定";
        if (days.Count == 7) return "每天";
        return string.Join("、", days.OrderBy(day => day).Select(day => $"周{"日一二三四五六"[Math.Clamp(day, 0, 6)]}"));
    }

    private static string CategoryLabel(string category)
    {
        return category switch
        {
            "study" => "学习",
            "code" => "编程",
            "workout" => "运动",
            "other" or "" => "其他",
            _ => category
        };
    }

    private bool AddFixedRule(string title, string start, string end, string buffer, List<int> days)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            SetStatus("固定事项需要标题", error: true);
            return false;
        }

        var startText = string.IsNullOrWhiteSpace(start) ? "09:00" : start.Trim();
        var endText = string.IsNullOrWhiteSpace(end) ? "10:00" : end.Trim();
        var startMin = TimeText.ParseMinutes(startText);
        var endMin = TimeText.ParseMinutes(endText);
        if (startMin is null || endMin is null)
        {
            SetStatus("固定事项时间格式无效，请输入 09:00 这类格式", error: true);
            return false;
        }

        if (endMin <= startMin)
        {
            SetStatus("固定事项结束时间必须晚于开始时间", error: true);
            return false;
        }

        if (days.Count == 0)
        {
            SetStatus("请选择固定事项适用星期", error: true);
            return false;
        }

        _state.FixedEvents.Add(new FixedEventRule
        {
            Title = title.Trim(),
            Start = TimeText.ToTime(startMin.Value),
            End = TimeText.ToTime(endMin.Value),
            BufferMin = int.TryParse(buffer, out var bufferMin) ? Math.Clamp(bufferMin, 0, 180) : 0,
            DaysOfWeek = days
        });
        SetStatus("已新增固定事项，正在自动保存");
        return true;
    }

    private bool AddTaskRule(string title, string duration, string category, string priority, string target, List<int> days)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            SetStatus("重复任务需要标题", error: true);
            return false;
        }

        if (!string.IsNullOrWhiteSpace(duration) && !int.TryParse(duration, out _))
        {
            SetStatus("任务时长必须是分钟数", error: true);
            return false;
        }

        if (!string.IsNullOrWhiteSpace(priority) && !int.TryParse(priority, out _))
        {
            SetStatus("优先级必须是 1 到 5 的数字", error: true);
            return false;
        }

        if (!string.IsNullOrWhiteSpace(target) && !int.TryParse(target, out _))
        {
            SetStatus("每周次数必须是数字", error: true);
            return false;
        }

        if (days.Count == 0 && string.IsNullOrWhiteSpace(target))
        {
            SetStatus("请选择适用星期，或填写每周次数让系统自动分配", error: true);
            return false;
        }

        var durationMin = int.TryParse(duration, out var minutes) ? Math.Clamp(minutes, 5, 480) : 30;
        var priorityValue = int.TryParse(priority, out var parsedPriority) ? Math.Clamp(parsedPriority, 1, 5) : 3;
        var targetValue = int.TryParse(target, out var parsedTarget) ? Math.Clamp(parsedTarget, 0, 7) : 0;
        _state.Tasks.Add(new TaskRule
        {
            Title = title.Trim(),
            DurationMin = durationMin,
            Category = string.IsNullOrWhiteSpace(category) ? "other" : category.Trim(),
            Priority = priorityValue,
            WeeklyTargetCount = targetValue,
            DaysOfWeek = days
        });
        SetStatus("已新增任务规则，正在自动保存");
        return true;
    }

    private Control RenderAiSettings()
    {
        var root = PageStack();
        root.Children.Add(Header("AI 设置", "配置对话模型、请求头和回复风格。密钥只保存在本机用户数据目录。"));

        var baseUrl = Input("Base URL", string.IsNullOrWhiteSpace(_aiSettings.BaseUrl) ? "https://api.openai.com/v1" : _aiSettings.BaseUrl);
        var model = Input("Model", string.IsNullOrWhiteSpace(_aiSettings.Model) ? "gpt-4.1-mini" : _aiSettings.Model);
        var path = Input("Chat Path", string.IsNullOrWhiteSpace(_aiSettings.ChatPath) ? "/chat/completions" : _aiSettings.ChatPath);
        var key = Input("API Key", _aiSettings.ApiKey, password: true);
        var header = Input("Key Header", string.IsNullOrWhiteSpace(_aiSettings.ApiKeyHeader) ? "Authorization" : _aiSettings.ApiKeyHeader);
        var prefix = Input("Key Prefix", _aiSettings.ApiKeyPrefix);
        var style = new TextBox
        {
            Text = _aiSettings.StylePrompt,
            AcceptsReturn = true,
            TextWrapping = TextWrapping.Wrap,
            MinHeight = 112,
            MaxHeight = 180,
            Watermark = "例如：直接、清晰、简短。"
        };
        var saveStatus = Text("", 12, "#64748b");

        bool TryReadSettingsFromForm(bool requireKey, out AiSettings next, out string message)
        {
            next = new AiSettings();
            var nextBaseUrl = (baseUrl.Text.Text ?? "").Trim();
            var nextPath = (path.Text.Text ?? "").Trim();
            if (string.IsNullOrWhiteSpace(nextBaseUrl) || !Uri.TryCreate(nextBaseUrl, UriKind.Absolute, out _))
            {
                message = "Base URL 必须是有效地址。";
                return false;
            }

            if (string.IsNullOrWhiteSpace(nextPath))
            {
                message = "Chat Path 不能为空。";
                return false;
            }

            next.BaseUrl = nextBaseUrl.TrimEnd('/');
            next.Model = string.IsNullOrWhiteSpace(model.Text.Text) ? "gpt-4.1-mini" : model.Text.Text.Trim();
            next.ChatPath = nextPath.StartsWith("/", StringComparison.Ordinal) ? nextPath : $"/{nextPath}";
            next.ApiKey = key.Text.Text ?? "";
            next.ApiKeyHeader = string.IsNullOrWhiteSpace(header.Text.Text) ? "Authorization" : header.Text.Text.Trim();
            next.ApiKeyPrefix = prefix.Text.Text ?? "";
            next.StylePrompt = string.IsNullOrWhiteSpace(style.Text) ? "直接、清晰、简短。" : style.Text.Trim();

            if (requireKey && string.IsNullOrWhiteSpace(next.ApiKey))
            {
                message = "API Key 不能为空。";
                return false;
            }

            message = "";
            return true;
        }

        void SetAiFormStatus(string message, bool error)
        {
            saveStatus.Text = message;
            saveStatus.Foreground = Brush(error ? "#dc2626" : "#16a34a");
            SetStatus(error ? $"AI 设置：{message}" : message, error);
        }

        void MarkAiSettingsDirty(object? _, TextChangedEventArgs __)
        {
            saveStatus.Text = "有未保存更改。测试连接只读取当前输入，保存后才会写入本地。";
            saveStatus.Foreground = Brush("#64748b");
        }

        foreach (var input in new[] { baseUrl.Text, model.Text, path.Text, key.Text, header.Text, prefix.Text })
        {
            input.TextChanged += MarkAiSettingsDirty;
        }
        style.TextChanged += MarkAiSettingsDirty;

        var connection = new StackPanel { Spacing = 12 };
        connection.Children.Add(RenderAiSettingsState());
        connection.Children.Add(baseUrl.Panel);

        var endpointGrid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,150"),
            ColumnSpacing = 10
        };
        Grid.SetColumn(path.Panel, 0);
        Grid.SetColumn(model.Panel, 1);
        endpointGrid.Children.Add(path.Panel);
        endpointGrid.Children.Add(model.Panel);
        connection.Children.Add(endpointGrid);

        var authGrid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,160"),
            ColumnSpacing = 10
        };
        Grid.SetColumn(header.Panel, 0);
        Grid.SetColumn(prefix.Panel, 1);
        authGrid.Children.Add(header.Panel);
        authGrid.Children.Add(prefix.Panel);
        connection.Children.Add(authGrid);
        connection.Children.Add(key.Panel);

        var connectionActions = new WrapPanel { Orientation = Orientation.Horizontal };
        void AddConnectionAction(Control control, double right = 8)
        {
            control.Margin = new Thickness(0, 0, right, 8);
            control.VerticalAlignment = VerticalAlignment.Center;
            connectionActions.Children.Add(control);
        }

        AddConnectionAction(Button("使用默认 OpenAI", (_, _) =>
        {
            baseUrl.Text.Text = "https://api.openai.com/v1";
            path.Text.Text = "/chat/completions";
            header.Text.Text = "Authorization";
            prefix.Text.Text = "Bearer ";
            if (string.IsNullOrWhiteSpace(model.Text.Text))
            {
                model.Text.Text = "gpt-4.1-mini";
            }
            saveStatus.Text = "已填入默认连接配置，保存后生效。";
            saveStatus.Foreground = Brush("#64748b");
        }, secondary: true));
        var testButton = Button("测试连接", async (sender, _) =>
        {
            if (sender is not Button currentButton) return;

            if (!TryReadSettingsFromForm(requireKey: true, out var testSettings, out var message))
            {
                SetAiFormStatus(message, error: true);
                return;
            }

            currentButton.IsEnabled = false;
            saveStatus.Text = "正在测试连接...";
            saveStatus.Foreground = Brush("#2563eb");
            SetStatus("正在测试 AI 连接");
            var startedAt = DateTimeOffset.Now;
            try
            {
                var result = await _aiChatService.SendAsync(new AiChatRequest
                {
                    Settings = testSettings,
                    PlannerState = _state,
                    FocusDate = _focusDate,
                    CurrentSchedule = _daySchedule,
                    Messages =
                    [
                        new AiChatMessage
                        {
                            Role = "user",
                            Content = "连接测试。请只返回 JSON：{\"text\":\"连接正常\",\"actions\":[]}"
                        }
                    ]
                });
                var elapsed = Math.Max(1, (int)(DateTimeOffset.Now - startedAt).TotalMilliseconds);
                var diagnostic = SanitizeAiDiagnostic(result.Text, testSettings);
                var failed = diagnostic.StartsWith("AI 请求失败", StringComparison.OrdinalIgnoreCase) ||
                             diagnostic.StartsWith("请先", StringComparison.OrdinalIgnoreCase);
                if (failed)
                {
                    SetAiFormStatus($"测试失败：{diagnostic}", error: true);
                }
                else
                {
                    saveStatus.Text = $"连接正常。模型：{(string.IsNullOrWhiteSpace(result.Model) ? testSettings.Model : result.Model)}，耗时 {elapsed}ms。";
                    saveStatus.Foreground = Brush("#16a34a");
                    SetStatus("AI 连接测试通过");
                }
            }
            catch (Exception ex)
            {
                SetAiFormStatus($"测试失败：{SanitizeAiDiagnostic(ex.Message, testSettings)}", error: true);
            }
            finally
            {
                currentButton.IsEnabled = true;
            }
        }, secondary: true);
        AddConnectionAction(testButton);
        AddConnectionAction(Button("清空 Key", (_, _) =>
        {
            key.Text.Text = "";
            saveStatus.Text = "API Key 已从输入框清空，保存后会更新本地设置。";
            saveStatus.Foreground = Brush("#64748b");
        }, secondary: true), 0);
        connection.Children.Add(connectionActions);
        connection.Children.Add(saveStatus);
        connection.Children.Add(RulesEmptyState("测试连接只使用当前输入框内容，不会保存设置；点击“保存 AI 设置”后才会写入本地用户数据目录。"));

        var behavior = new StackPanel { Spacing = 12 };
        behavior.Children.Add(Field("对话风格预提示词", style));
        behavior.Children.Add(RenderAiProtocolCard());

        async Task<bool> SaveAiSettingsFromFormAsync()
        {
            if (!TryReadSettingsFromForm(requireKey: false, out var nextSettings, out var message))
            {
                SetAiFormStatus(message, error: true);
                return false;
            }

            _aiSettings = nextSettings;
            await _store.SaveAiSettingsAsync(_aiSettings);
            saveStatus.Text = _aiSettings.ApiKey.Length == 0
                ? "已保存连接配置。API Key 为空时，对话页会提示先配置密钥。"
                : "已保存 AI 设置。";
            saveStatus.Foreground = Brush("#16a34a");
            SetStatus("AI 设置已保存到用户数据目录");
            RenderActivePage();
            return true;
        }

        var saveButton = Button("保存 AI 设置", async (_, _) => await SaveAiSettingsFromFormAsync());
        var saveAndChatButton = Button("保存并打开对话", async (_, _) =>
        {
            if (!await SaveAiSettingsFromFormAsync()) return;
            _activePage = "Chat";
            _state.Preferences.StartupPage = "Chat";
            RenderActivePage();
        }, secondary: true);

        var left = new StackPanel { Spacing = 14 };
        left.Children.Add(Card("连接", connection));
        left.Children.Add(Card("行为", behavior));

        var right = new StackPanel { Spacing = 14 };
        right.Children.Add(RenderAiSafetyPanel());
        right.Children.Add(RenderAiQuickExamples());

        var columns = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,330"),
            ColumnSpacing = 16
        };
        Grid.SetColumn(left, 0);
        Grid.SetColumn(right, 1);
        columns.Children.Add(left);
        columns.Children.Add(right);
        root.Children.Add(columns);
        var bottomActions = new WrapPanel { Orientation = Orientation.Horizontal };
        AddSelectionAction(bottomActions, saveButton);
        AddSelectionAction(bottomActions, saveAndChatButton, 0);
        root.Children.Add(bottomActions);
        return Scroll(root);
    }

    private static string SanitizeAiDiagnostic(string text, AiSettings settings)
    {
        var value = string.IsNullOrWhiteSpace(text) ? "没有返回诊断信息。" : text.Trim();
        var key = (settings.ApiKey ?? "").Trim().Trim('"', '\'');
        if (!string.IsNullOrWhiteSpace(key))
        {
            value = value.Replace(key, "******", StringComparison.Ordinal);
            var prefixed = $"{settings.ApiKeyPrefix}{key}".Trim();
            if (!string.IsNullOrWhiteSpace(prefixed))
            {
                value = value.Replace(prefixed, "******", StringComparison.Ordinal);
            }
        }

        return value.Length > 220 ? value[..220] + "..." : value;
    }

    private Control RenderAiSettingsState()
    {
        var configured = !string.IsNullOrWhiteSpace(_aiSettings.ApiKey);
        var grid = new UniformGrid { Columns = 3 };
        grid.Children.Add(AiStatusTile("密钥", configured ? "已配置" : "未配置", configured ? "#16a34a" : "#dc2626"));
        grid.Children.Add(AiStatusTile("模型", string.IsNullOrWhiteSpace(_aiSettings.Model) ? "默认" : _aiSettings.Model, "#2563eb"));
        grid.Children.Add(AiStatusTile("路径", string.IsNullOrWhiteSpace(_aiSettings.ChatPath) ? "/chat/completions" : _aiSettings.ChatPath, "#64748b"));
        return grid;
    }

    private static Control AiStatusTile(string label, string value, string accent)
    {
        var stack = new StackPanel { Spacing = 3 };
        stack.Children.Add(Text(label, 11, "#64748b", FontWeight.SemiBold));
        var text = Text(value, 13, accent, FontWeight.SemiBold);
        text.TextWrapping = TextWrapping.Wrap;
        stack.Children.Add(text);
        return new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10),
            Margin = new Thickness(0, 0, 8, 0),
            Child = stack
        };
    }

    private Control RenderAiSafetyPanel()
    {
        var root = new StackPanel { Spacing = 10 };
        root.Children.Add(AiInfoRow("保存位置", Path.Combine(_store.DataDirectory, "ai-settings.local.json")));
        root.Children.Add(AiInfoRow("仓库状态", ".env 和 publish 目录已忽略"));
        root.Children.Add(AiInfoRow("可见内容", "聊天窗口只显示回复文字和可应用预览"));
        root.Children.Add(AiInfoRow("测试连接", "只读取当前输入框，不会保存 API Key"));
        root.Children.Add(Button("复制数据目录", async (_, _) =>
        {
            await (Clipboard?.SetTextAsync(_store.DataDirectory) ?? Task.CompletedTask);
            SetStatus("数据目录已复制到剪贴板");
        }, secondary: true));
        return Card("本地安全", root);
    }

    private static Control RenderAiProtocolCard()
    {
        var root = new StackPanel { Spacing = 8 };
        root.Children.Add(AiInfoRow("后台格式", "JSON actions"));
        root.Children.Add(AiInfoRow("支持操作", "新增、移动、删除日程"));
        root.Children.Add(AiInfoRow("缺少结束时间", "默认 30 分钟并在回复里提示"));
        return new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(12),
            Child = root
        };
    }

    private static Control RenderAiQuickExamples()
    {
        var root = new StackPanel { Spacing = 8 };
        root.Children.Add(Text("可识别示例", 13, "#111827", FontWeight.SemiBold));
        root.Children.Add(ExampleText("这周日晚上七点半教一601考试，九点去居酒屋"));
        root.Children.Add(ExampleText("move gym to 8:30 pm"));
        root.Children.Add(ExampleText("把明早九点的复习删掉"));
        return Card("对话测试", root);
    }

    private static Control AiInfoRow(string label, string value)
    {
        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("86,*"),
            ColumnSpacing = 8
        };
        var labelText = Text(label, 12, "#64748b", FontWeight.SemiBold);
        var valueText = Text(value, 12, "#334155");
        valueText.TextWrapping = TextWrapping.Wrap;
        Grid.SetColumn(labelText, 0);
        Grid.SetColumn(valueText, 1);
        grid.Children.Add(labelText);
        grid.Children.Add(valueText);
        return grid;
    }

    private static Control ExampleText(string value)
    {
        return new Border
        {
            Background = Brush("#f8fafc"),
            BorderBrush = Brush("#e2e8f0"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10),
            Child = Text(value, 12, "#334155")
        };
    }

    private Control RenderCommunity()
    {
        var root = PageStack();
        root.Children.Add(Header("社区", "保存提醒、经验和可复用的日程想法。"));
        root.Children.Add(RenderCommunitySummary());

        var input = new TextBox
        {
            Watermark = "写一句提醒或日程经验",
            AcceptsReturn = true,
            TextWrapping = TextWrapping.Wrap,
            MinHeight = 76,
            MaxHeight = 140
        };
        var status = Text("", 12, "#64748b");
        var composer = new StackPanel { Spacing = 10 };
        composer.Children.Add(input);
        var composerActions = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        Grid.SetColumn(status, 0);
        composerActions.Children.Add(status);
        var publish = Button("发布", (_, _) =>
        {
            var text = (input.Text ?? "").Trim();
            if (text.Length < 2)
            {
                status.Text = "内容太短。";
                status.Foreground = Brush("#dc2626");
                return;
            }

            _state.CommunityPosts.Insert(0, new CommunityPost
            {
                Text = text,
                CreatedAt = DateTimeOffset.Now
            });
            input.Text = "";
            SetStatus("社区内容已发布，正在自动保存");
            QueueStateAutosave("社区内容已自动保存");
            RenderActivePage();
        });
        Grid.SetColumn(publish, 1);
        composerActions.Children.Add(publish);
        composer.Children.Add(composerActions);
        root.Children.Add(Card("发布", composer));

        var posts = _state.CommunityPosts.OrderByDescending(item => item.CreatedAt).ToList();
        if (posts.Count == 0)
        {
            root.Children.Add(RulesEmptyState("还没有内容。可以先记录一句对自己有用的日程提醒。"));
        }
        else
        {
            foreach (var post in posts)
            {
                root.Children.Add(RenderCommunityPost(post));
            }
        }

        return Scroll(root);
    }

    private Control RenderCommunitySummary()
    {
        var today = DateTimeOffset.Now.Date;
        var grid = new UniformGrid { Columns = 3 };
        grid.Children.Add(StatCard("内容", _state.CommunityPosts.Count.ToString()));
        grid.Children.Add(StatCard("今日新增", _state.CommunityPosts.Count(item => item.CreatedAt.LocalDateTime.Date == today).ToString()));
        grid.Children.Add(StatCard("总赞", _state.CommunityPosts.Sum(item => item.Likes).ToString()));
        return grid;
    }

    private Control RenderCommunityPost(CommunityPost post)
    {
        var root = new StackPanel { Spacing = 10 };
        var head = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        var time = Text($"{post.CreatedAt.LocalDateTime:yyyy-MM-dd HH:mm}", 12, "#64748b", FontWeight.SemiBold);
        var likeCount = Text($"{post.Likes} 赞", 12, "#2563eb", FontWeight.SemiBold);
        Grid.SetColumn(time, 0);
        Grid.SetColumn(likeCount, 1);
        head.Children.Add(time);
        head.Children.Add(likeCount);
        root.Children.Add(head);
        root.Children.Add(Text(post.Text, 14, "#111827"));

        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Spacing = 8
        };
        actions.Children.Add(Button("赞", (_, _) =>
        {
            post.Likes += 1;
            SetStatus("已点赞，正在自动保存");
            QueueStateAutosave("点赞已自动保存");
            RenderActivePage();
        }, secondary: true));
        actions.Children.Add(Button("删除", (_, _) =>
        {
            _state.CommunityPosts.Remove(post);
            SetStatus("已删除社区内容，正在自动保存");
            QueueStateAutosave("社区内容删除已自动保存");
            RenderActivePage();
        }, danger: true));
        root.Children.Add(actions);

        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#e5e7eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(14),
            Child = root
        };
    }

    private Control RenderAdvanced()
    {
        var root = PageStack();
        root.Children.Add(Header("高级", "管理日程生成偏好和本地数据。"));

        var columns = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,330"),
            ColumnSpacing = 16
        };
        var left = new StackPanel { Spacing = 14 };
        left.Children.Add(RenderPreferenceSettings());
        left.Children.Add(RenderLocalDataMaintenance());
        var right = new StackPanel { Spacing = 14 };
        right.Children.Add(RenderDataDirectoryPanel());
        right.Children.Add(RenderAdvancedSnapshot());
        Grid.SetColumn(left, 0);
        Grid.SetColumn(right, 1);
        columns.Children.Add(left);
        columns.Children.Add(right);
        root.Children.Add(columns);
        return Scroll(root);
    }

    private Control RenderPreferenceSettings()
    {
        var root = new StackPanel { Spacing = 10 };
        root.Children.Add(Text("这些时间会影响自动排程的可用时间段。", 12, "#64748b"));

        var wake = Input("起床 / 可用开始", _state.Preferences.WakeTime);
        var bed = Input("睡觉 / 可用结束", _state.Preferences.Bedtime);
        var startupOptions = StartupPageOptions();
        var startup = new ComboBox
        {
            ItemsSource = startupOptions,
            SelectedItem = startupOptions.FirstOrDefault(item => item.Value == _state.Preferences.StartupPage) ??
                           startupOptions.First(item => item.Value == "Chat"),
            MinHeight = 38
        };
        var status = Text("", 12, "#dc2626");

        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("*,*"),
            ColumnSpacing = 12
        };
        Grid.SetColumn(wake.Panel, 0);
        Grid.SetColumn(bed.Panel, 1);
        grid.Children.Add(wake.Panel);
        grid.Children.Add(bed.Panel);
        root.Children.Add(grid);
        root.Children.Add(Field("启动页面", startup));
        root.Children.Add(status);
        root.Children.Add(Button("保存偏好", async (_, _) =>
        {
            var wakeMin = TimeText.ParseMinutes(wake.Text.Text);
            var bedMin = TimeText.ParseMinutes(bed.Text.Text);
            if (wakeMin is null || bedMin is null || bedMin <= wakeMin)
            {
                status.Text = "请输入有效时间，例如 07:30 到 23:30。";
                return;
            }

            _state.Preferences.WakeTime = TimeText.ToTime(wakeMin.Value);
            _state.Preferences.Bedtime = TimeText.ToTime(bedMin.Value);
            _state.Preferences.StartupPage = startup.SelectedItem is PageOption option ? option.Value : "Chat";
            _state.DayOverrides.Remove(DateKey(_focusDate));
            RebuildSchedules();
            await _store.SaveStateAsync(_state);
            SetStatus("偏好已保存，并已重建当前日程");
            RenderActivePage();
        }));

        return Card("应用偏好", root);
    }

    private static List<PageOption> StartupPageOptions()
    {
        return
        [
            new PageOption("Overview", "总览"),
            new PageOption("Chat", "对话"),
            new PageOption("Schedule", "日程"),
            new PageOption("Rules", "规则"),
            new PageOption("Ai", "AI 设置"),
            new PageOption("Community", "社区"),
            new PageOption("Advanced", "高级")
        ];
    }

    private Control RenderDataDirectoryPanel()
    {
        var root = new StackPanel { Spacing = 10 };
        var path = Text(_store.DataDirectory, 12, "#334155");
        path.TextWrapping = TextWrapping.Wrap;
        root.Children.Add(path);
        root.Children.Add(Button("复制目录", async (_, _) =>
        {
            await (Clipboard?.SetTextAsync(_store.DataDirectory) ?? Task.CompletedTask);
            SetStatus("数据目录已复制到剪贴板");
        }, secondary: true));
        return Card("数据目录", root);
    }

    private Control RenderAdvancedSnapshot()
    {
        var root = new StackPanel { Spacing = 8 };
        root.Children.Add(AiInfoRow("固定事项", _state.FixedEvents.Count.ToString()));
        root.Children.Add(AiInfoRow("任务规则", _state.Tasks.Count.ToString()));
        root.Children.Add(AiInfoRow("手动调整", $"{_state.DayOverrides.Count} 天"));
        root.Children.Add(AiInfoRow("完成记录", $"{_state.Completed.Count} 条"));
        root.Children.Add(AiInfoRow("社区内容", $"{_state.CommunityPosts.Count} 条"));
        return Card("数据维护", root);
    }

    private Control RenderLocalDataMaintenance()
    {
        var root = new StackPanel { Spacing = 10 };
        root.Children.Add(Text("这些操作会直接修改本地状态。清除手动调整后，日程会回到自动生成结果。", 12, "#64748b"));

        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        row.Children.Add(Button("清除完成状态", async (_, _) =>
        {
            _state.Completed.Clear();
            await _store.SaveStateAsync(_state);
            SetStatus("已清除完成状态");
            RenderActivePage();
        }, secondary: true));
        row.Children.Add(Button("清除所有手动调整", async (_, _) =>
        {
            if (!await ConfirmDangerAsync(
                    "清除所有手动调整？",
                    $"将删除 {_state.DayOverrides.Count} 天的手动调整，保留固定事项和任务规则。",
                    "清除"))
            {
                return;
            }

            _state.DayOverrides.Clear();
            RebuildSchedules();
            await _store.SaveStateAsync(_state);
            SetStatus("已清除所有手动调整");
            RenderActivePage();
        }, danger: true));
        row.Children.Add(Button("重建示例数据", async (_, _) =>
        {
            if (!await ConfirmDangerAsync(
                    "重建示例数据？",
                    "将替换当前固定事项、任务规则、完成记录、手动调整和社区内容。",
                    "重建"))
            {
                return;
            }

            _state = PlannerDefaults.Create();
            RebuildSchedules();
            await _store.SaveStateAsync(_state);
            SetStatus("已重建示例数据并保存");
            RenderActivePage();
        }, danger: true));
        root.Children.Add(row);
        return Card("本地状态", root);
    }

    private async Task<bool> ConfirmDangerAsync(string title, string message, string actionText)
    {
        var root = new StackPanel
        {
            Spacing = 12,
            Margin = new Thickness(18)
        };
        root.Children.Add(Text(title, 20, "#111827", FontWeight.SemiBold));
        root.Children.Add(Text(message, 13, "#475569"));

        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Spacing = 8
        };
        var dialog = new Window
        {
            Title = title,
            Width = 400,
            Height = 200,
            MinWidth = 360,
            MinHeight = 180,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Background = Brush("#f8fafc")
        };
        actions.Children.Add(Button("取消", (_, _) => dialog.Close(false), secondary: true));
        actions.Children.Add(Button(actionText, (_, _) => dialog.Close(true), danger: true));
        root.Children.Add(actions);
        dialog.Content = root;
        return await dialog.ShowDialog<bool>(this);
    }

    private int SelectedEditableBlockCount()
    {
        return _daySchedule.Blocks.Count(block => _selectedRuntimeIds.Contains(block.RuntimeId) && block.Editable);
    }

    private void AddDaySelectionContextMenuItems(ContextMenu menu, ScheduleBlock block)
    {
        var selectedEditableCount = SelectedEditableBlockCount();
        var useBatchSelection = _selectedRuntimeIds.Contains(block.RuntimeId) && selectedEditableCount > 1;

        if (useBatchSelection)
        {
            var moveUp = new MenuItem { Header = "选中项上移 15 分钟" };
            moveUp.Click += (_, _) => MoveSelected(-15);
            var moveDown = new MenuItem { Header = "选中项下移 15 分钟" };
            moveDown.Click += (_, _) => MoveSelected(15);
            menu.Items.Add(moveUp);
            menu.Items.Add(moveDown);
        }

        var delete = new MenuItem { Header = useBatchSelection ? $"删除选中 {selectedEditableCount} 个" : "删除" };
        delete.Click += async (_, _) =>
        {
            if (useBatchSelection)
            {
                await DeleteSelectedAsync();
                return;
            }

            _selectedRuntimeIds.Clear();
            _selectedRuntimeIds.Add(block.RuntimeId);
            await DeleteSelectedAsync(confirmMulti: false);
        };
        menu.Items.Add(delete);

        if (!useBatchSelection) return;

        var clearSelection = new MenuItem { Header = "取消选择" };
        clearSelection.Click += (_, _) =>
        {
            _selectedRuntimeIds.Clear();
            RenderActivePage();
        };
        menu.Items.Add(clearSelection);
    }

    private void MoveSelected(int deltaMinutes)
    {
        var selectedCount = SelectedEditableBlockCount();
        if (selectedCount == 0) return;

        CaptureUndo("批量调整");
        foreach (var block in _daySchedule.Blocks.Where(block => _selectedRuntimeIds.Contains(block.RuntimeId) && block.Editable))
        {
            var duration = block.DurationMin;
            block.StartMin = Math.Clamp(block.StartMin + deltaMinutes, 0, TimeText.FullDayEndMin - duration);
            block.EndMin = block.StartMin + duration;
        }
        _daySchedule.Blocks = [.. _daySchedule.Blocks.OrderBy(block => block.StartMin)];
        var direction = deltaMinutes < 0 ? "上移" : "下移";
        SaveCurrentDayOverride($"已{direction} {selectedCount} 个日程 {Math.Abs(deltaMinutes)} 分钟");
        RenderActivePage();
    }

    private async Task DeleteSelectedAsync(bool confirmMulti = true)
    {
        var selectedCount = SelectedEditableBlockCount();
        if (selectedCount == 0) return;
        if (confirmMulti && selectedCount > 1 && !await ConfirmDeleteSelectedAsync(selectedCount))
        {
            return;
        }

        CaptureUndo("删除日程");
        var before = _daySchedule.Blocks.Count;
        _daySchedule.Blocks.RemoveAll(block => _selectedRuntimeIds.Contains(block.RuntimeId) && block.Editable);
        var changed = before - _daySchedule.Blocks.Count;
        _selectedRuntimeIds.Clear();
        SaveCurrentDayOverride($"已删除 {changed} 个日程");
        RenderActivePage();
    }

    private async Task<bool> ConfirmDeleteSelectedAsync(int selectedCount)
    {
        var root = new StackPanel
        {
            Spacing = 12,
            Margin = new Thickness(18)
        };
        root.Children.Add(Text("删除选中的日程？", 20, "#111827", FontWeight.SemiBold));
        root.Children.Add(Text($"将删除 {selectedCount} 个日程。删除后仍可用顶部“撤销”恢复。", 13, "#475569"));

        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Spacing = 8
        };
        var dialog = new Window
        {
            Title = "确认删除",
            Width = 360,
            Height = 190,
            MinWidth = 340,
            MinHeight = 180,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Background = Brush("#f8fafc")
        };
        actions.Children.Add(Button("取消", (_, _) => dialog.Close(false), secondary: true));
        actions.Children.Add(Button($"删除 {selectedCount} 个", (_, _) => dialog.Close(true), danger: true));
        root.Children.Add(actions);
        dialog.Content = root;
        return await dialog.ShowDialog<bool>(this);
    }

    private void BeginBoxSelection(object? sender, PointerPressedEventArgs args)
    {
        if (_dayCanvas is null || args.Source is not Canvas) return;
        if (!args.GetCurrentPoint(_dayCanvas).Properties.IsLeftButtonPressed) return;
        _isBoxSelecting = true;
        _selectionMoved = false;
        _selectionStart = args.GetPosition(_dayCanvas);
        _selectionBox = new Border
        {
            BorderBrush = Brush("#2563eb"),
            BorderThickness = new Thickness(1),
            Background = Brush("#bfdbfe66")
        };
        args.Handled = true;
    }

    private void UpdateBoxSelection(object? sender, PointerEventArgs args)
    {
        if (!_isBoxSelecting || _dayCanvas is null || _selectionBox is null) return;
        var current = args.GetPosition(_dayCanvas);
        var deltaX = Math.Abs(current.X - _selectionStart.X);
        var deltaY = Math.Abs(current.Y - _selectionStart.Y);
        if (!_selectionMoved)
        {
            if (Math.Max(deltaX, deltaY) < SelectionDragThreshold)
            {
                args.Handled = true;
                return;
            }

            _selectionMoved = true;
            _selectedRuntimeIds.Clear();
            _dayCanvas.Children.Add(_selectionBox);
        }

        var left = Math.Min(_selectionStart.X, current.X);
        var top = Math.Min(_selectionStart.Y, current.Y);
        Canvas.SetLeft(_selectionBox, left);
        Canvas.SetTop(_selectionBox, top);
        _selectionBox.Width = deltaX;
        _selectionBox.Height = deltaY;
        args.Handled = true;
    }

    private void FinishBoxSelection(object? sender, PointerReleasedEventArgs args)
    {
        if (!_isBoxSelecting || _dayCanvas is null || _selectionBox is null) return;
        if (!_selectionMoved)
        {
            _selectionBox = null;
            _isBoxSelecting = false;
            args.Handled = true;
            return;
        }

        var rect = new Rect(Canvas.GetLeft(_selectionBox), Canvas.GetTop(_selectionBox), _selectionBox.Width, _selectionBox.Height);
        foreach (var border in _dayCanvas.Children.OfType<Border>().Where(item => item.Tag is string))
        {
            var itemRect = new Rect(Canvas.GetLeft(border), Canvas.GetTop(border), border.Width, border.Height);
            if (rect.Intersects(itemRect) && border.Tag is string id)
            {
                _selectedRuntimeIds.Add(id);
            }
        }
        _dayCanvas.Children.Remove(_selectionBox);
        _selectionBox = null;
        _isBoxSelecting = false;
        _selectionMoved = false;
        RenderActivePage();
        args.Handled = true;
    }

    private void CommitDrag(Point releasePoint)
    {
        if (_dragBlock is null) return;
        var duration = _dragOriginalEnd - _dragOriginalStart;
        var nextStart = ResolveDayDragStart(releasePoint);
        var minutes = nextStart - _dragOriginalStart;
        var selectedBlocks = _daySchedule.Blocks
            .Where(block => _selectedRuntimeIds.Contains(block.RuntimeId) && block.Editable)
            .ToList();
        if (minutes == 0)
        {
            _dragBlock = null;
            RenderActivePage();
            return;
        }

        if (selectedBlocks.Count <= 1)
        {
            CaptureUndo("拖动日程");
            _dragBlock.StartMin = nextStart;
            _dragBlock.EndMin = nextStart + duration;
        }
        else
        {
            CaptureUndo("批量拖动");
            var deltaMinutes = nextStart - _dragOriginalStart;
            foreach (var block in selectedBlocks)
            {
                var blockDuration = block.DurationMin;
                block.StartMin = Math.Clamp(block.StartMin + deltaMinutes, 0, TimeText.FullDayEndMin - blockDuration);
                block.EndMin = block.StartMin + blockDuration;
            }
        }
        _dragBlock = null;
        SaveCurrentDayOverride($"已拖动调整 {Math.Max(1, selectedBlocks.Count)} 个日程");
        RenderActivePage();
    }

    private int ResolveDayDragStart(Point point)
    {
        var delta = point.Y - _dragStart.Y;
        var minutes = (int)Math.Round(delta / DayPixelsPerMinute / 15.0) * 15;
        var duration = _dragOriginalEnd - _dragOriginalStart;
        return Math.Clamp(_dragOriginalStart + minutes, 0, TimeText.FullDayEndMin - duration);
    }

    private void CommitResize(Point releasePoint, double pixelsPerMinute)
    {
        if (_resizeBlock is null) return;

        var runtimeId = _resizeBlock.RuntimeId;
        var date = _resizeDate;
        var nextEnd = ResolveResizeEnd(releasePoint, pixelsPerMinute);
        _resizeBlock = null;

        if (nextEnd == _resizeOriginalEnd)
        {
            RenderActivePage();
            return;
        }

        _focusDate = date;
        RebuildSchedules();
        var target = _daySchedule.Blocks.FirstOrDefault(block => block.RuntimeId == runtimeId && block.Editable);
        if (target is null)
        {
            SetStatus("没有找到可调整时长的日程", error: true);
            RenderActivePage();
            return;
        }

        CaptureUndo("调整时长");
        target.EndMin = nextEnd;
        _daySchedule.Blocks = [.. _daySchedule.Blocks.OrderBy(block => block.StartMin).ThenBy(block => block.EndMin)];
        SaveCurrentDayOverride($"已调整 {target.Title} 到 {target.Start}-{target.End}");
        RenderActivePage();
    }

    private int ResolveResizeEnd(Point point, double pixelsPerMinute)
    {
        var delta = point.Y - _resizeStart.Y;
        var minutes = (int)Math.Round(delta / pixelsPerMinute / 15.0) * 15;
        return Math.Clamp(_resizeOriginalEnd + minutes, _resizeOriginalStart + 15, TimeText.FullDayEndMin);
    }

    private static bool IsVisibleBlock(ScheduleBlock block) => block.Type != ScheduleBlockType.Buffer;

    private bool IsFocusDateToday() => _focusDate == DateOnly.FromDateTime(DateTime.Today);

    private static int CurrentMinute() => DateTime.Now.Hour * 60 + DateTime.Now.Minute;

    private bool IsCurrentBlock(ScheduleBlock block)
    {
        return IsCurrentBlock(_focusDate, block);
    }

    private static bool IsCurrentBlock(DateOnly date, ScheduleBlock block)
    {
        if (date != DateOnly.FromDateTime(DateTime.Today) || !IsVisibleBlock(block)) return false;
        var now = CurrentMinute();
        return block.StartMin <= now && now < block.EndMin;
    }

    private bool IsBlockCompleted(ScheduleBlock block)
    {
        return _state.Completed.TryGetValue(block.RuntimeId, out var done) && done;
    }

    private async Task ToggleBlockCompleteAsync(ScheduleBlock block)
    {
        if (IsBlockCompleted(block))
        {
            _state.Completed.Remove(block.RuntimeId);
            SetStatus($"已取消完成：{block.Title}");
        }
        else
        {
            _state.Completed[block.RuntimeId] = true;
            SetStatus($"已完成：{block.Title}");
        }

        await _store.SaveStateAsync(_state);
        RenderActivePage();
    }

    private CompletionStats GetCompletionStats(DaySchedule schedule)
    {
        var blocks = schedule.Blocks.Where(IsVisibleBlock).ToList();
        var total = blocks.Count;
        var done = blocks.Count(IsBlockCompleted);
        return new CompletionStats(total, done);
    }

    private static string WeekdayText(DateOnly date) => "日一二三四五六"[(int)date.DayOfWeek].ToString();

    private Button NavButton(string text, string page)
    {
        var button = new Button
        {
            Content = text,
            Padding = new Thickness(12, 8),
            Background = Brush("#00ffffff"),
            Foreground = Brush("#cbd5e1"),
            BorderBrush = Brush("#00ffffff"),
            BorderThickness = new Thickness(0),
            CornerRadius = new CornerRadius(7)
        };
        button.Click += (_, _) =>
        {
            _activePage = page;
            _state.Preferences.StartupPage = page;
            RenderActivePage();
        };
        button.HorizontalAlignment = HorizontalAlignment.Stretch;
        button.HorizontalContentAlignment = HorizontalAlignment.Left;
        button.VerticalContentAlignment = VerticalAlignment.Center;
        button.Margin = new Thickness(0, 0, 0, 4);
        return button;
    }

    private Control BuildScheduleList(IEnumerable<ScheduleBlock> blocks)
    {
        var stack = new StackPanel { Spacing = 6 };
        foreach (var block in blocks.OrderBy(block => block.StartMin))
        {
            var done = IsBlockCompleted(block);
            stack.Children.Add(Text($"{(done ? "✓ " : "")}{block.Start}-{block.End}  {block.Title}", 13, done ? "#64748b" : "#334155"));
        }
        return stack.Children.Count == 0 ? CenterText("暂无日程") : stack;
    }

    private void SetStatus(string message, bool error = false)
    {
        _statusText.Text = message;
        _statusText.Foreground = Brush(error ? "#fca5a5" : "#9ca3af");
        _topbarStatusText.Text = message;
        _topbarStatusText.Foreground = Brush(error ? "#991b1b" : "#475569");
        if (_topbarStatusPill is not null)
        {
            _topbarStatusPill.Background = Brush(error ? "#fef2f2" : "#f8fafc");
            _topbarStatusPill.BorderBrush = Brush(error ? "#fecaca" : "#e2e8f0");
        }
    }
}
