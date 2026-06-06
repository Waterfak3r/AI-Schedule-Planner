namespace AiSchedulePlanner.Core;

public static class PlannerDefaults
{
    public static PlannerState Create()
    {
        return new PlannerState
        {
            Preferences = new PlannerPreferences
            {
                WakeTime = "07:30",
                Bedtime = "23:30",
                Tone = "direct",
                StartupPage = "Chat"
            },
            FixedEvents =
            [
                new FixedEventRule
                {
                    Id = "fixed_course",
                    Title = "课程",
                    Start = "10:00",
                    End = "11:30",
                    BufferMin = 10,
                    DaysOfWeek = [1, 3]
                }
            ],
            Tasks =
            [
                new TaskRule
                {
                    Id = "task_words",
                    Title = "背单词",
                    Category = "study",
                    DurationMin = 30,
                    Priority = 4,
                    DaysOfWeek = [1, 2, 3, 4, 5]
                },
                new TaskRule
                {
                    Id = "task_code",
                    Title = "写代码",
                    Category = "code",
                    DurationMin = 90,
                    Priority = 5,
                    WeeklyTargetCount = 3
                },
                new TaskRule
                {
                    Id = "task_math",
                    Title = "复习数学",
                    Category = "study",
                    DurationMin = 60,
                    Priority = 4,
                    DaysOfWeek = [0, 2, 4]
                }
            ],
            CommunityPosts =
            [
                new CommunityPost
                {
                    Id = "post_seed_1",
                    Text = "今晚先做最硬的一块，剩下的交给明天上午。",
                    Likes = 3
                }
            ]
        };
    }
}
