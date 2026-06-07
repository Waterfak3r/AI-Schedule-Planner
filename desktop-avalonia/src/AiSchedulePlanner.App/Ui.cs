using AiSchedulePlanner.Core;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;

namespace AiSchedulePlanner.App;

internal sealed record CompletionStats(int Total, int Done)
{
    public int Percent => Total <= 0 ? 0 : (int)Math.Round(Done * 100.0 / Total);
}

internal static class Ui
{
    public static IBrush Brush(string color) => SolidColorBrush.Parse(color);

    public static Button Button(string text, EventHandler<RoutedEventArgs>? onClick, bool secondary = false, bool danger = false)
    {
        var button = new Button
        {
            Content = text,
            Padding = new Thickness(12, 8),
            Background = Brush(danger ? "#dc2626" : secondary ? "#f8fafc" : "#2563eb"),
            Foreground = Brush(danger ? "#ffffff" : secondary ? "#0f172a" : "#ffffff"),
            BorderBrush = Brush(danger ? "#dc2626" : secondary ? "#cbd5e1" : "#2563eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(6),
            HorizontalContentAlignment = HorizontalAlignment.Center,
            VerticalContentAlignment = VerticalAlignment.Center
        };

        if (onClick is not null)
        {
            button.Click += onClick;
        }

        return button;
    }

    public static TextBlock Text(string text, double size, string color, FontWeight weight = FontWeight.Normal)
    {
        return new TextBlock
        {
            Text = text,
            FontSize = size,
            Foreground = Brush(color),
            FontWeight = weight,
            TextWrapping = TextWrapping.Wrap
        };
    }

    public static Control Header(string title, string subtitle)
    {
        var stack = new StackPanel { Spacing = 4 };
        stack.Children.Add(Text(title, 22, "#111827", FontWeight.SemiBold));
        stack.Children.Add(Text(subtitle, 13, "#64748b"));
        return stack;
    }

    public static StackPanel PageStack() => new() { Spacing = 14 };

    public static ScrollViewer Scroll(Control content) => new()
    {
        Content = content,
        HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
        VerticalScrollBarVisibility = ScrollBarVisibility.Auto
    };

    public static Control Card(string title, Control content)
    {
        var stack = new StackPanel { Spacing = 10 };
        stack.Children.Add(Text(title, 15, "#111827", FontWeight.SemiBold));
        stack.Children.Add(content);
        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#e5e7eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(14),
            Child = stack
        };
    }

    public static Control StatCard(string title, string value)
    {
        var stack = new StackPanel { Spacing = 6 };
        stack.Children.Add(Text(title, 12, "#64748b"));
        stack.Children.Add(Text(value, 24, "#111827", FontWeight.SemiBold));
        return new Border
        {
            Background = Brush("#ffffff"),
            BorderBrush = Brush("#e5e7eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(16),
            Margin = new Thickness(4),
            Child = stack
        };
    }

    public static Control ProgressCard(CompletionStats completion)
    {
        var percent = Math.Clamp(completion.Percent, 0, 100);
        var root = new StackPanel { Spacing = 10 };
        var head = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        var title = Text("今日完成度", 15, "#111827", FontWeight.SemiBold);
        var label = Text($"{completion.Done}/{completion.Total}  {percent}%", 13, "#2563eb", FontWeight.SemiBold);
        Grid.SetColumn(title, 0);
        Grid.SetColumn(label, 1);
        head.Children.Add(title);
        head.Children.Add(label);
        root.Children.Add(head);

        var track = new Grid
        {
            Tag = "overview-completion-track",
            Height = 12,
            ClipToBounds = true,
            ColumnDefinitions = new ColumnDefinitions($"{percent}*,{100 - percent}*")
        };
        var trackBackground = new Border
        {
            Background = Brush("#e2e8f0"),
            CornerRadius = new CornerRadius(8)
        };
        Grid.SetColumnSpan(trackBackground, 2);
        track.Children.Add(trackBackground);
        if (percent > 0)
        {
            track.Children.Add(new Border
            {
                Tag = "overview-completion-fill",
                Background = Brush(percent >= 80 ? "#22c55e" : percent >= 40 ? "#38bdf8" : "#f59e0b"),
                CornerRadius = new CornerRadius(8)
            });
        }
        root.Children.Add(track);

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

    public static Control FeatureCard(string eyebrow, string title, string body, string background, string accent)
    {
        var stack = new StackPanel { Spacing = 7 };
        stack.Children.Add(Text(eyebrow, 12, accent, FontWeight.SemiBold));
        stack.Children.Add(Text(title, 26, "#0f172a", FontWeight.SemiBold));
        stack.Children.Add(Text(body, 15, "#334155", FontWeight.SemiBold));
        return new Border
        {
            Background = Brush(background),
            BorderBrush = Brush("#dbe3ee"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(18),
            Child = stack
        };
    }

    public static Control ChatBubble(AiChatMessage message)
    {
        var user = message.Role == "user";
        var root = new StackPanel { Spacing = 5 };
        var role = Text(user ? "你" : "AI", 11, user ? "#dbeafe" : "#64748b", FontWeight.SemiBold);
        role.HorizontalAlignment = user ? HorizontalAlignment.Right : HorizontalAlignment.Left;
        root.Children.Add(role);
        root.Children.Add(Text(message.Content, 13, user ? "#ffffff" : "#111827"));

        return new Border
        {
            HorizontalAlignment = user ? HorizontalAlignment.Right : HorizontalAlignment.Left,
            Background = Brush(user ? "#2563eb" : "#ffffff"),
            BorderBrush = Brush(user ? "#2563eb" : "#e5e7eb"),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(12),
            MaxWidth = 720,
            Child = root
        };
    }

    public static (StackPanel Panel, TextBox Text) Input(string label, string value, bool password = false)
    {
        var text = new TextBox
        {
            Text = value,
            PasswordChar = password ? '*' : '\0'
        };
        var panel = new StackPanel { Spacing = 5 };
        panel.Children.Add(Text(label, 12, "#475569", FontWeight.SemiBold));
        panel.Children.Add(text);
        return (panel, text);
    }

    public static Control Field(string label, Control input)
    {
        var panel = new StackPanel { Spacing = 5 };
        panel.Children.Add(Text(label, 12, "#475569", FontWeight.SemiBold));
        panel.Children.Add(input);
        return panel;
    }

    public static Control CenterText(string text)
    {
        return new Border
        {
            Padding = new Thickness(24),
            Child = Text(text, 14, "#64748b")
        };
    }
}
