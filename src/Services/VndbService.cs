using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using VnHub.Common;

namespace VnHub.Services;

public static class VndbService
{
    private static HttpClient Http;
    private static string _currentProxy = "";

    static VndbService()
    {
        Http = CreateClient(null);
    }

    public static void ConfigureProxy(string? proxyAddress)
    {
        var addr = proxyAddress?.Trim() ?? "";
        if (addr == _currentProxy) return;
        _currentProxy = addr;
        var old = Http;
        Http = CreateClient(addr);
        // delay disposal so requests already in flight on the old client aren't disrupted
        _ = Task.Delay(TimeSpan.FromSeconds(30)).ContinueWith(_ => old?.Dispose());
    }

    private static HttpClient CreateClient(string? proxyAddress)
    {
        HttpClientHandler handler;
        if (!string.IsNullOrWhiteSpace(proxyAddress))
        {
            handler = new HttpClientHandler
            {
                Proxy = new System.Net.WebProxy(proxyAddress),
                UseProxy = true
            };
        }
        else
        {
            handler = new HttpClientHandler();
        }
        var client = new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan };
        client.DefaultRequestHeaders.UserAgent.Add(
            new ProductInfoHeaderValue("VNHub", "1.0"));
        client.DefaultRequestHeaders.UserAgent.Add(
            new ProductInfoHeaderValue("(visual-novel-library-manager)"));
        return client;
    }

    private static readonly TimeSpan ApiTimeout = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan DownloadTimeout = TimeSpan.FromSeconds(60);

    public static async Task<MetadataResult?> SearchAsync(string title, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(title)) return null;

        try
        {
            var body = new
            {
                filters = new object[] { "search", "=", title },
                fields = "title, image.url, description, tags.name, tags.rating, rating, length_minutes",
                sort = "searchrank",
                results = 5
            };

            var json = JsonSerializer.Serialize(body, Bridge.JsonOpts);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            using var apiCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            apiCts.CancelAfter(ApiTimeout);
            var response = await Http.PostAsync("https://api.vndb.org/kana/vn", content, apiCts.Token);
            if (!response.IsSuccessStatusCode) return null;

            var responseJson = await response.Content.ReadAsStringAsync(apiCts.Token);
            var result = JsonSerializer.Deserialize<VndbApiResponse>(responseJson, Bridge.JsonOpts);

            if (result?.Results == null || result.Results.Count == 0) return null;

            var best = result.Results[0];

            var tags = new List<string>();
            if (best.Tags != null)
            {
                foreach (var tag in best.Tags
                    .OrderByDescending(t => t.Rating)
                    .Take(10))
                {
                    if (!string.IsNullOrEmpty(tag.Name))
                        tags.Add(tag.Name);
                }
            }

            return new MetadataResult
            {
                ExternalId = best.Id ?? "",
                Title = best.Title ?? "",
                ImageUrl = best.Image?.Url,
                Description = CleanDescription(best.Description),
                Tags = tags,
                Rating = best.Rating,
                LengthMinutes = best.LengthMinutes
            };
        }
        catch (OperationCanceledException)
        {
            return null;
        }
        catch (Exception ex)
        {
            LogService.Error("VNDB search failed", ex);
            return null;
        }
    }

    private const long MaxCoverBytes = 25 * 1024 * 1024;

    public static async Task<(string? FileName, string? Error)> DownloadCoverAsync(string imageUrl, string vnId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(imageUrl)) return (null, "No image URL");

        try
        {
            using var dlCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            dlCts.CancelAfter(DownloadTimeout);
            using var response = await Http.GetAsync(imageUrl, HttpCompletionOption.ResponseHeadersRead, dlCts.Token);
            if (!response.IsSuccessStatusCode)
                return (null, $"HTTP {(int)response.StatusCode} from {imageUrl}");

            if (response.Content.Headers.ContentLength is long declaredLength && declaredLength > MaxCoverBytes)
                return (null, $"Image too large ({declaredLength} bytes)");

            var bytes = await response.Content.ReadAsByteArrayAsync(dlCts.Token);
            if (bytes.Length < 100)
                return (null, $"Image too small ({bytes.Length} bytes)");
            if (bytes.Length > MaxCoverBytes)
                return (null, $"Image too large ({bytes.Length} bytes)");

            var coversDir = VnHub.Common.AppPaths.EnsureCoversDir();

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "";
            var ext = contentType switch
            {
                "image/png" => ".png",
                "image/webp" => ".webp",
                _ => ".jpg"
            };

            var fileName = $"{vnId}{ext}";
            if (!PathGuard.IsSafeFileName(fileName, ".jpg", ".png", ".webp"))
                return (null, "Invalid VN id");
            var filePath = Path.Combine(coversDir, fileName);
            await File.WriteAllBytesAsync(filePath, bytes);

            return (fileName, null);
        }
        catch (OperationCanceledException)
        {
            return (null, "Download cancelled");
        }
        catch (Exception ex)
        {
            LogService.Error("Cover download failed", ex);
            return (null, ex.Message);
        }
    }

    private static readonly System.Text.RegularExpressions.Regex VndbUrlTagRegex =
        new(@"\[url=[^\]]*\]([^\[]*)\[/url\]", System.Text.RegularExpressions.RegexOptions.Compiled);
    private static readonly System.Text.RegularExpressions.Regex VndbTagRegex =
        new(@"\[/?[a-zA-Z]+[^\]]*\]", System.Text.RegularExpressions.RegexOptions.Compiled);

    private static string? CleanDescription(string? desc)
    {
        if (string.IsNullOrEmpty(desc)) return null;

        desc = VndbUrlTagRegex.Replace(desc, "$1");
        desc = VndbTagRegex.Replace(desc, "");

        return desc.Trim();
    }

    private class VndbApiResponse
    {
        public List<VndbVnItem> Results { get; set; } = new();
    }

    private class VndbVnItem
    {
        public string? Id { get; set; }
        public string? Title { get; set; }
        public VndbImage? Image { get; set; }
        public string? Description { get; set; }
        public List<VndbTag>? Tags { get; set; }
        public double? Rating { get; set; }
        public int? LengthMinutes { get; set; }
    }

    private class VndbImage
    {
        public string? Url { get; set; }
    }

    private class VndbTag
    {
        public string? Name { get; set; }
        public double Rating { get; set; }
    }
}
