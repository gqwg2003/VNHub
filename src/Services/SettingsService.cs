using System.Text.Json;

namespace VnHub.Services;

public class AppSettings
{
    public string Theme { get; set; } = "dark";
    public string DefaultFolder { get; set; } = "";
    public string Language { get; set; } = "en";
    public string DbPath { get; set; } = "";
    public bool VndbEnabled { get; set; } = true;
    public bool AutoStart { get; set; } = false;
    public bool MinimizeToTray { get; set; } = false;
    public bool StartMinimized { get; set; } = false;
    public int MaxBackups { get; set; } = 5;
    public string BackupInterval { get; set; } = "startup";
    public string ProxyAddress { get; set; } = "";
    public string SortBy { get; set; } = "title";
    public string SortDir { get; set; } = "asc";
    public string GridSize { get; set; } = "medium";
    public Dictionary<string, string> Shortcuts { get; set; } = new();
    public int? WindowX { get; set; }
    public int? WindowY { get; set; }
    public int? WindowWidth { get; set; }
    public int? WindowHeight { get; set; }
    public bool WindowMaximized { get; set; } = false;

    public List<string> ScanBlacklistExe { get; set; } = new();
    public List<string> ScanBlacklistDirs { get; set; } = new();
    public string ScanSortBy { get; set; } = "title";
    public string ScanSortDir { get; set; } = "asc";
    public bool ScanSkipExisting { get; set; } = true;
    public bool ScanRecursive { get; set; } = false;

    public CustomizationSettings Customization { get; set; } = new();

    public string MetadataProvider { get; set; } = "vndb";
    public string IgdbClientId { get; set; } = "";
    public string IgdbClientSecret { get; set; } = "";
    public string RawgApiKey { get; set; } = "";
}

public class CustomizationSettings
{
    public string ActiveFont { get; set; } = "";
    public List<string> Fonts { get; set; } = new();
    public string BackgroundImage { get; set; } = "";
    public double BackgroundOpacity { get; set; } = 0.4;
    public int BackgroundBlur { get; set; } = 0;
    public string SidebarBackgroundImage { get; set; } = "";
    public double SidebarBackgroundOpacity { get; set; } = 0.6;
    public int SidebarBackgroundBlur { get; set; } = 0;
    public string TopbarBackgroundImage { get; set; } = "";
    public double TopbarBackgroundOpacity { get; set; } = 0.6;
    public int TopbarBackgroundBlur { get; set; } = 0;
    public double PanelSurfaceOpacity { get; set; } = 1.0;
    public int SidebarWidth { get; set; } = 220;
    public int CardRadius { get; set; } = 8;
    public Dictionary<string, string> Colors { get; set; } = new();
}

public static class SettingsService
{
    private static readonly string SettingsDir = VnHub.Common.AppPaths.Root;
    private static readonly string SettingsPath = Path.Combine(SettingsDir, "settings.json");

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private static readonly object Gate = new();
    private static AppSettings? _cached;

    public static AppSettings Load()
    {
        lock (Gate)
        {
            if (_cached != null) return _cached;

            if (!File.Exists(SettingsPath))
                return new AppSettings();

            try
            {
                var json = File.ReadAllText(SettingsPath);
                _cached = JsonSerializer.Deserialize<AppSettings>(json, JsonOpts) ?? new AppSettings();
                return _cached;
            }
            catch (Exception ex)
            {
                LogService.Error("Failed to load settings, using defaults", ex);
                return new AppSettings();
            }
        }
    }

    public static void Save(AppSettings settings)
    {
        lock (Gate)
        {
            _cached = null;
            Directory.CreateDirectory(SettingsDir);
            var json = JsonSerializer.Serialize(settings, JsonOpts);

            var tempPath = SettingsPath + ".tmp";
            File.WriteAllText(tempPath, json);
            File.Move(tempPath, SettingsPath, overwrite: true);
        }
    }

    public static string MaskSecret(string? secret)
    {
        if (string.IsNullOrEmpty(secret)) return "";
        if (secret.Length <= 4) return new string('\u2022', 4);
        return new string('\u2022', 4) + secret[^4..];
    }
}
