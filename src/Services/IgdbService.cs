using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace VnHub.Services;

public class IgdbService : MetadataServiceBase
{
    public override string Id => "igdb";
    public override string DisplayName => "IGDB";

    protected override string UserAgent => "VNHub/1.0";

    private string _cachedToken = "";
    private DateTime _tokenExpiry = DateTime.MinValue;

    protected override void OnProxyChanged() => _cachedToken = "";

    private async Task<string?> GetTokenAsync(string clientId, string clientSecret, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(_cachedToken) && DateTime.UtcNow < _tokenExpiry)
            return _cachedToken;

        try
        {
            using var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = clientId,
                ["client_secret"] = clientSecret,
                ["grant_type"] = "client_credentials"
            });
            using var cts = LinkedTimeout(ct, TimeSpan.FromSeconds(15));
            var resp = await Http.PostAsync("https://id.twitch.tv/oauth2/token", content, cts.Token);
            if (!resp.IsSuccessStatusCode) return null;

            var json = await resp.Content.ReadAsStringAsync(cts.Token);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var token = root.GetProperty("access_token").GetString() ?? "";
            var expiresIn = root.GetProperty("expires_in").GetInt32();
            _cachedToken = token;
            _tokenExpiry = DateTime.UtcNow.AddSeconds(expiresIn - 60);
            return _cachedToken;
        }
        catch (Exception ex)
        {
            LogService.Error("IGDB token fetch failed", ex);
            return null;
        }
    }

    public override Task<MetadataResult?> SearchAsync(string title, CancellationToken ct = default)
        => ExecuteSearchAsync(title, SearchCoreAsync, ct);

    private async Task<MetadataResult?> SearchCoreAsync(string title, CancellationToken ct)
    {
        var settings = SettingsService.Load();
        var clientId = settings.IgdbClientId?.Trim() ?? "";
        var clientSecret = settings.IgdbClientSecret?.Trim() ?? "";
        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
        {
            LogService.Info("IGDB credentials not configured.");
            return null;
        }

        var token = await GetTokenAsync(clientId, clientSecret, ct);
        if (string.IsNullOrEmpty(token)) return null;

        var escaped = title.Replace("\\", "\\\\").Replace("\"", "\\\"");
        var query = $"search \"{escaped}\"; fields name,summary,cover.url,genres.name,themes.name,rating; limit 1;";

        using var cts = LinkedTimeout(ct, TimeSpan.FromSeconds(15));

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.igdb.com/v4/games")
        {
            Content = new StringContent(query, Encoding.UTF8, "text/plain")
        };
        req.Headers.Add("Client-ID", clientId);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await Http.SendAsync(req, cts.Token);
        if (!response.IsSuccessStatusCode) return null;

        var responseJson = await response.Content.ReadAsStringAsync(cts.Token);
        using var doc = JsonDocument.Parse(responseJson);
        var arr = doc.RootElement;
        if (arr.ValueKind != JsonValueKind.Array || arr.GetArrayLength() == 0) return null;

        var item = arr[0];
        var id = item.GetProperty("id").GetRawText();
        var itemTitle = item.TryGetProperty("name", out var nameEl) ? nameEl.GetString() ?? title : title;
        var description = item.StringOrNull("summary");

        double? rating = null;
        if (item.TryGetProperty("rating", out var ratingEl))
            rating = ratingEl.GetDouble();

        string? imageUrl = null;
        if (item.TryGetProperty("cover", out var cover) && cover.TryGetProperty("url", out var urlEl))
        {
            var raw = urlEl.GetString() ?? "";
            imageUrl = (raw.StartsWith("//") ? "https:" : "") + raw.Replace("t_thumb", "t_cover_big");
        }

        var tags = item.NamedArray("genres", "name");
        tags.AddRange(item.NamedArray("themes", "name"));

        return new MetadataResult
        {
            ExternalId = id,
            Title = itemTitle,
            ImageUrl = imageUrl,
            Description = description,
            Tags = tags,
            Rating = rating
        };
    }
}
