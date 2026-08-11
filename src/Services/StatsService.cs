using System.Globalization;
using System.Text.Json;
using VnHub.Database;
using VnHub.Models;

namespace VnHub.Services;

public static class StatsService
{
    public static object Compute(List<VnEntry> entries)
    {
        var agg = Aggregate(entries);
        var tagFreq = ComputeTagFrequency(entries);

        var topPlayed = BuildTopPlayed(entries);
        var topRated = BuildTopRated(entries);

        var avgRating = agg.RatingCount > 0 ? Math.Round(agg.RatingSum / agg.RatingCount, 1) : 0.0;
        var topTags = BuildTopTags(tagFreq);
        var avgCompletionTime = agg.CompletionCount > 0 ? agg.CompletionTimeSum / agg.CompletionCount : 0L;
        var categoryAvgs = BuildCategoryAvgs(agg);

        var (achievements, newlyUnlocked) = EvaluateAchievements(agg, tagFreq, topRated.Count > 0);

        var activity = ReadDailyActivity();
        var heatmap = BuildHeatmap(activity);
        var streak = ComputeStreak(activity);

        return new
        {
            totalVn = agg.TotalVn,
            byStatus = agg.ByStatus,
            totalPlayTime = agg.TotalPlayTime,
            monthlyAdds = agg.MonthlyAdds,
            topPlayed,
            topRated,
            favCount = agg.FavCount,
            avgRating,
            byRating = agg.ByRating,
            topTags,
            avgCompletionTime,
            categoryAvgs,
            achievements,
            newlyUnlocked,
            heatmap,
            streak
        };
    }

    private sealed class Aggregates
    {
        public int TotalVn;
        public Dictionary<int, int> ByStatus = new();
        public long TotalPlayTime;
        public int FavCount;
        public double RatingSum;
        public int RatingCount;
        public Dictionary<string, int> MonthlyAdds = new();
        public Dictionary<int, int> ByRating = new();
        public long CompletionTimeSum;
        public int CompletionCount;
        public double StorySum; public int StoryCount;
        public double ArtSum;   public int ArtCount;
        public double MusicSum; public int MusicCount;
        public double CharSum;  public int CharCount;
    }

    private static Aggregates Aggregate(List<VnEntry> entries)
    {
        var a = new Aggregates { TotalVn = entries.Count };
        for (int i = 0; i <= 4; i++) a.ByStatus[i] = 0;

        foreach (var e in entries)
        {
            a.ByStatus[(int)e.Status]++;
            a.TotalPlayTime += e.PlayTimeSeconds;
            if (e.IsFavorite) a.FavCount++;
            if (e.UserRating.HasValue)
            {
                a.RatingSum += e.UserRating.Value;
                a.RatingCount++;
                int r = Math.Clamp((int)Math.Round(e.UserRating.Value), 1, 10);
                a.ByRating.TryGetValue(r, out int rc);
                a.ByRating[r] = rc + 1;
            }
            if (!string.IsNullOrEmpty(e.DateAdded))
            {
                if (DateTime.TryParse(e.DateAdded, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var d))
                {
                    var key = d.ToString("yyyy-MM");
                    a.MonthlyAdds.TryGetValue(key, out int c);
                    a.MonthlyAdds[key] = c + 1;
                }
            }
            if (e.Status == VnStatus.Completed && e.PlayTimeSeconds > 0)
            {
                a.CompletionTimeSum += e.PlayTimeSeconds;
                a.CompletionCount++;
            }
            if (e.StoryRating.HasValue)     { a.StorySum += e.StoryRating.Value;     a.StoryCount++; }
            if (e.ArtRating.HasValue)       { a.ArtSum   += e.ArtRating.Value;       a.ArtCount++;   }
            if (e.MusicRating.HasValue)     { a.MusicSum += e.MusicRating.Value;     a.MusicCount++; }
            if (e.CharacterRating.HasValue) { a.CharSum  += e.CharacterRating.Value; a.CharCount++;  }
        }

        return a;
    }

    private static Dictionary<string, int> ComputeTagFrequency(List<VnEntry> entries)
    {
        var tagFreq = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in entries)
        {
            if (string.IsNullOrEmpty(e.Tags) || e.Tags == "[]") continue;
            try
            {
                var tags = JsonSerializer.Deserialize<List<string>>(e.Tags);
                if (tags != null)
                    foreach (var tag in tags)
                    {
                        if (string.IsNullOrWhiteSpace(tag)) continue;
                        tagFreq.TryGetValue(tag, out int tc);
                        tagFreq[tag] = tc + 1;
                    }
            }
            catch (Exception ex)
            {
                LogService.Error($"Failed to parse tags for entry {e.Id}", ex);
            }
        }
        return tagFreq;
    }

    private static List<object> BuildTopPlayed(List<VnEntry> entries) => entries
        .Where(e => e.PlayTimeSeconds > 0)
        .OrderByDescending(e => e.PlayTimeSeconds)
        .Take(10)
        .Select(e => (object)new { id = e.Id, title = e.Title, cover = e.CoverPath, playTime = e.PlayTimeSeconds, userRating = e.UserRating })
        .ToList();

    private static List<object> BuildTopRated(List<VnEntry> entries) => entries
        .Where(e => e.UserRating.HasValue)
        .OrderByDescending(e => e.UserRating!.Value)
        .Take(10)
        .Select(e => (object)new { id = e.Id, title = e.Title, cover = e.CoverPath, playTime = e.PlayTimeSeconds, userRating = e.UserRating })
        .ToList();

    private static List<object> BuildTopTags(Dictionary<string, int> tagFreq) => tagFreq
        .OrderByDescending(kv => kv.Value)
        .Take(12)
        .Select(kv => (object)new { tag = kv.Key, count = kv.Value })
        .ToList();

    private static object BuildCategoryAvgs(Aggregates a) => new
    {
        story     = a.StoryCount > 0 ? (double?)Math.Round(a.StorySum / a.StoryCount, 1) : null,
        art       = a.ArtCount   > 0 ? (double?)Math.Round(a.ArtSum   / a.ArtCount,   1) : null,
        music     = a.MusicCount > 0 ? (double?)Math.Round(a.MusicSum / a.MusicCount, 1) : null,
        character = a.CharCount  > 0 ? (double?)Math.Round(a.CharSum  / a.CharCount,  1) : null,
    };

    private static (object achievements, object newlyUnlocked) EvaluateAchievements(
        Aggregates a, Dictionary<string, int> tagFreq, bool hasRating)
    {
        var ctx = new AchievementService.StatsContext
        {
            TotalVn = a.TotalVn,
            Completed = a.ByStatus[(int)VnStatus.Completed],
            FavCount = a.FavCount,
            HasRating = hasRating,
            TotalHours = a.TotalPlayTime / 3600.0,
            TagCounts = tagFreq
        };
        return AchievementService.Evaluate(ctx);
    }

    private static List<(DateTime Day, long Seconds)> ReadDailyActivity()
    {
        var raw = SessionRepository.GetStatsByDays(0);
        var result = new List<(DateTime, long)>(raw.Count);
        foreach (var o in raw)
        {
            if (string.IsNullOrEmpty(o.Day)) continue;
            if (DateTime.TryParse(o.Day, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
                result.Add((d.Date, o.Seconds));
        }
        return result;
    }

    private static List<object> BuildHeatmap(List<(DateTime Day, long Seconds)> activity) => activity
        .Where(x => x.Seconds > 0)
        .Select(x => (object)new { day = x.Day.ToString("yyyy-MM-dd"), seconds = x.Seconds })
        .ToList();

    private static object ComputeStreak(List<(DateTime Day, long Seconds)> activity)
    {
        var played = activity
            .Where(x => x.Seconds > 0)
            .Select(x => x.Day.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        int longest = 0, run = 0;
        DateTime? prev = null;
        foreach (var d in played)
        {
            run = prev.HasValue && d == prev.Value.AddDays(1) ? run + 1 : 1;
            if (run > longest) longest = run;
            prev = d;
        }

        var set = new HashSet<DateTime>(played);
        int current = 0;
        var cursor = DateTime.Today;
        if (!set.Contains(cursor)) cursor = cursor.AddDays(-1);
        while (set.Contains(cursor))
        {
            current++;
            cursor = cursor.AddDays(-1);
        }

        return new { current, longest };
    }
}
