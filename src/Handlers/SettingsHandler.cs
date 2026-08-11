using System.Reflection;
using System.Text.Json;
using Microsoft.Win32;
using VnHub.Common;
using VnHub.Database;
using VnHub.Models;
using VnHub.Services;

namespace VnHub.Handlers;

public static class SettingsHandler
{
    public static Task Handle(string action, JsonElement? payload)
    {
        switch (action)
        {
            case "getSettings":
            {
                SendSettings();
                break;
            }

            case "saveSettings":
            {
                var s = Bridge.Deserialize<AppSettings>(payload);
                if (s == null) break;
                s.ProxyAddress = Validation.SanitizeProxy(s.ProxyAddress);

                var current = SettingsService.Load();
                if (s.IgdbClientSecret == SettingsService.MaskSecret(current.IgdbClientSecret))
                    s.IgdbClientSecret = current.IgdbClientSecret;
                if (s.RawgApiKey == SettingsService.MaskSecret(current.RawgApiKey))
                    s.RawgApiKey = current.RawgApiKey;

                SettingsService.Save(s);
                AppServices.Metadata.ConfigureProxies(s.ProxyAddress);
                Bridge.SendToJs("settingsSaved", new { ok = true, proxyAddress = s.ProxyAddress });
                break;
            }

            case "setAutoStart":
            {
                var p = Bridge.Deserialize<Bridge.AutoStartPayload>(payload);
                if (p == null) break;
                try
                {
                    using var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                    if (key != null)
                    {
                        if (p.Enabled)
                            key.SetValue("VnHub", $"\"{Application.ExecutablePath}\"");
                        else
                            key.DeleteValue("VnHub", throwOnMissingValue: false);
                    }
                    Bridge.SendToJs("autoStartSet", new { enabled = p.Enabled });
                    LogService.Info($"AutoStart set to {p.Enabled}");
                }
                catch (Exception ex)
                {
                    LogService.Error("AutoStart toggle failed", ex);
                    Bridge.SendToJs("onError", new { message = $"AutoStart failed: {ex.Message}" });
                }
                break;
            }

            case "exportSettings":
            {
                Bridge.InvokeOnUiThread(() =>
                {
                    using var dialog = new SaveFileDialog
                    {
                        Filter = "JSON|*.json",
                        FileName = "vnhub-settings.json"
                    };
                    if (dialog.ShowDialog() != DialogResult.OK) return;
                    try
                    {
                        var settings = SettingsService.Load();
                        var json = JsonSerializer.Serialize(settings, JsonHelpers.IndentedOpts);
                        File.WriteAllText(dialog.FileName, json);
                        Bridge.SendToJs("settingsExported", new { path = dialog.FileName });
                        LogService.Info($"Settings exported to {dialog.FileName}");
                    }
                    catch (Exception ex)
                    {
                        LogService.Error("Settings export failed", ex);
                        Bridge.SendToJs("onError", new { message = $"Settings export failed: {ex.Message}" });
                    }
                });
                break;
            }

            case "importSettings":
            {
                Bridge.InvokeOnUiThread(() =>
                {
                    using var dialog = new OpenFileDialog
                    {
                        Filter = "JSON|*.json|All files|*.*"
                    };
                    if (dialog.ShowDialog() != DialogResult.OK) return;
                    try
                    {
                        var json = File.ReadAllText(dialog.FileName);
                        var imported = JsonSerializer.Deserialize<AppSettings>(json, JsonHelpers.IndentedOpts);
                        if (imported == null)
                        {
                            Bridge.SendToJs("onError", new { message = "Invalid settings file." });
                            return;
                        }
                        imported.ProxyAddress = Validation.SanitizeProxy(imported.ProxyAddress);
                        SettingsService.Save(imported);
                        AppServices.Metadata.ConfigureProxies(imported.ProxyAddress);
                        SendSettings();
                        Bridge.SendToJs("settingsImported", new { ok = true });
                        LogService.Info($"Settings imported from {dialog.FileName}");
                    }
                    catch (Exception ex)
                    {
                        LogService.Error("Settings import failed", ex);
                        Bridge.SendToJs("onError", new { message = $"Settings import failed: {ex.Message}" });
                    }
                });
                break;
            }
        }
        return Task.CompletedTask;
    }

    private static void SendSettings()
    {
        var settings = SettingsService.Load();
        settings.DbPath = AppDb.DbPath;
        var coversDir = AppPaths.CoversDir;
        Bridge.SendToJs("receiveSettings", new
        {
            settings.Theme,
            settings.DefaultFolder,
            settings.Language,
            settings.DbPath,
            settings.VndbEnabled,
            settings.AutoStart,
            settings.MinimizeToTray,
            settings.StartMinimized,
            settings.MaxBackups,
            settings.BackupInterval,
            settings.Shortcuts,
            settings.ProxyAddress,
            settings.SortBy,
            settings.SortDir,
            settings.GridSize,
            settings.WindowX,
            settings.WindowY,
            settings.WindowWidth,
            settings.WindowHeight,
            settings.WindowMaximized,
            settings.ScanBlacklistExe,
            settings.ScanBlacklistDirs,
            settings.ScanSortBy,
            settings.ScanSortDir,
            settings.ScanSkipExisting,
            settings.ScanRecursive,
            settings.Customization,
            settings.MetadataProvider,
            settings.IgdbClientId,
            igdbClientSecret = SettingsService.MaskSecret(settings.IgdbClientSecret),
            rawgApiKey = SettingsService.MaskSecret(settings.RawgApiKey),
            coversPath = coversDir,
            logsPath = LogService.GetLogDir(),
            appVersion = typeof(SettingsHandler).Assembly
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "1.0.0"
        });
    }
}
