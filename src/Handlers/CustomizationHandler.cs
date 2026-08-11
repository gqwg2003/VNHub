using System.Text.Json;
using VnHub.Common;
using VnHub.Services;

namespace VnHub.Handlers;

public static class CustomizationHandler
{
    private static readonly string[] FontExtensions = { ".ttf", ".otf", ".woff", ".woff2" };
    private static readonly string[] ImageExtensions = { ".png", ".jpg", ".jpeg", ".webp", ".bmp" };

    public static Task Handle(string action, JsonElement? payload)
    {
        switch (action)
        {
            case "pickFont":
            {
                FileDialogHelper.PickFile(FileDialogHelper.FontFilter, fileName =>
                {
                    try
                    {
                        var copied = CopyToDir(fileName, AppPaths.EnsureFontsDir(), FontExtensions);
                        if (copied != null)
                        {
                            var settings = SettingsService.Load();
                            if (!settings.Customization.Fonts.Contains(copied))
                                settings.Customization.Fonts.Add(copied);
                            settings.Customization.ActiveFont = copied;
                            SettingsService.Save(settings);
                            Bridge.SendToJs("fontAdded", new
                            {
                                fileName = copied,
                                fonts = settings.Customization.Fonts,
                                activeFont = copied
                            });
                        }
                        else
                        {
                            Bridge.SendToJs("onError", new { message = "Unsupported font format." });
                        }
                    }
                    catch (Exception ex)
                    {
                        LogService.Error("pickFont failed", ex);
                        Bridge.SendToJs("onError", new { message = $"Font import failed: {ex.Message}" });
                    }
                });
                break;
            }

            case "removeFont":
            {
                var p = Bridge.Deserialize<FileNamePayload>(payload);
                if (p == null) break;
                if (!PathGuard.IsSafeFileName(p.FileName, FontExtensions))
                {
                    Bridge.SendToJs("onError", new { message = "Invalid font name." });
                    break;
                }
                try
                {
                    var path = Path.Combine(AppPaths.FontsDir, p.FileName);
                    var safe = PathGuard.EnsureWithin(AppPaths.FontsDir, path);
                    if (safe != null && File.Exists(safe))
                        File.Delete(safe);

                    var settings = SettingsService.Load();
                    settings.Customization.Fonts.Remove(p.FileName);
                    if (settings.Customization.ActiveFont == p.FileName)
                        settings.Customization.ActiveFont = "";
                    SettingsService.Save(settings);
                    Bridge.SendToJs("fontRemoved", new
                    {
                        fonts = settings.Customization.Fonts,
                        activeFont = settings.Customization.ActiveFont
                    });
                }
                catch (Exception ex)
                {
                    LogService.Error("removeFont failed", ex);
                    Bridge.SendToJs("onError", new { message = $"Font removal failed: {ex.Message}" });
                }
                break;
            }

            case "listFonts":
            {
                try
                {
                    var dir = AppPaths.EnsureFontsDir();
                    var files = Directory.EnumerateFiles(dir)
                        .Select(Path.GetFileName)
                        .Where(n => n != null && FontExtensions.Contains(
                            Path.GetExtension(n)!.ToLowerInvariant()))
                        .ToList();
                    Bridge.SendToJs("fontsList", new { fonts = files });
                }
                catch (Exception ex)
                {
                    LogService.Error("listFonts failed", ex);
                }
                break;
            }

            case "pickBackground":
            {
                FileDialogHelper.PickFile(FileDialogHelper.ImageFilter, fileName =>
                {
                    try
                    {
                        var copied = CopyToDir(fileName, AppPaths.EnsureBackgroundsDir(), ImageExtensions);
                        if (copied != null)
                        {
                            CleanupOldBackgrounds(copied);
                            var settings = SettingsService.Load();
                            settings.Customization.BackgroundImage = copied;
                            SettingsService.Save(settings);
                            Bridge.SendToJs("backgroundPicked", new { fileName = copied });
                        }
                        else
                        {
                            Bridge.SendToJs("onError", new { message = "Unsupported image format." });
                        }
                    }
                    catch (Exception ex)
                    {
                        LogService.Error("pickBackground failed", ex);
                        Bridge.SendToJs("onError", new { message = $"Background import failed: {ex.Message}" });
                    }
                });
                break;
            }

            case "clearBackground":
            {
                try
                {
                    var settings = SettingsService.Load();
                    var current = settings.Customization.BackgroundImage;
                    settings.Customization.BackgroundImage = "";
                    SettingsService.Save(settings);

                    if (!string.IsNullOrEmpty(current)
                        && PathGuard.IsSafeFileName(current, ImageExtensions))
                    {
                        var path = Path.Combine(AppPaths.BackgroundsDir, current);
                        var safe = PathGuard.EnsureWithin(AppPaths.BackgroundsDir, path);
                        if (safe != null && File.Exists(safe))
                            File.Delete(safe);
                    }
                    Bridge.SendToJs("backgroundCleared", new { ok = true });
                }
                catch (Exception ex)
                {
                    LogService.Error("clearBackground failed", ex);
                    Bridge.SendToJs("onError", new { message = $"Clear background failed: {ex.Message}" });
                }
                break;
            }

            case "pickSidebarBackground":
            {
                FileDialogHelper.PickFile(FileDialogHelper.ImageFilter, fileName =>
                {
                    try
                    {
                        var copied = CopyPanelBackground(fileName, "sidebar", ImageExtensions);
                        if (copied != null)
                        {
                            var settings = SettingsService.Load();
                            settings.Customization.SidebarBackgroundImage = copied;
                            SettingsService.Save(settings);
                            Bridge.SendToJs("sidebarBackgroundPicked", new { fileName = copied });
                        }
                        else
                        {
                            Bridge.SendToJs("onError", new { message = "Unsupported image format." });
                        }
                    }
                    catch (Exception ex)
                    {
                        LogService.Error("pickSidebarBackground failed", ex);
                        Bridge.SendToJs("onError", new { message = $"Background import failed: {ex.Message}" });
                    }
                });
                break;
            }

            case "clearSidebarBackground":
            {
                try
                {
                    var settings = SettingsService.Load();
                    var current = settings.Customization.SidebarBackgroundImage;
                    settings.Customization.SidebarBackgroundImage = "";
                    SettingsService.Save(settings);
                    DeletePanelBgFile(current);
                    Bridge.SendToJs("sidebarBackgroundCleared", new { ok = true });
                }
                catch (Exception ex)
                {
                    LogService.Error("clearSidebarBackground failed", ex);
                    Bridge.SendToJs("onError", new { message = $"Clear background failed: {ex.Message}" });
                }
                break;
            }

            case "pickTopbarBackground":
            {
                FileDialogHelper.PickFile(FileDialogHelper.ImageFilter, fileName =>
                {
                    try
                    {
                        var copied = CopyPanelBackground(fileName, "topbar", ImageExtensions);
                        if (copied != null)
                        {
                            var settings = SettingsService.Load();
                            settings.Customization.TopbarBackgroundImage = copied;
                            SettingsService.Save(settings);
                            Bridge.SendToJs("topbarBackgroundPicked", new { fileName = copied });
                        }
                        else
                        {
                            Bridge.SendToJs("onError", new { message = "Unsupported image format." });
                        }
                    }
                    catch (Exception ex)
                    {
                        LogService.Error("pickTopbarBackground failed", ex);
                        Bridge.SendToJs("onError", new { message = $"Background import failed: {ex.Message}" });
                    }
                });
                break;
            }

            case "clearTopbarBackground":
            {
                try
                {
                    var settings = SettingsService.Load();
                    var current = settings.Customization.TopbarBackgroundImage;
                    settings.Customization.TopbarBackgroundImage = "";
                    SettingsService.Save(settings);
                    DeletePanelBgFile(current);
                    Bridge.SendToJs("topbarBackgroundCleared", new { ok = true });
                }
                catch (Exception ex)
                {
                    LogService.Error("clearTopbarBackground failed", ex);
                    Bridge.SendToJs("onError", new { message = $"Clear background failed: {ex.Message}" });
                }
                break;
            }
        }
        return Task.CompletedTask;
    }

    private static string? CopyPanelBackground(string source, string slotPrefix, string[] allowedExtensions)
    {
        if (string.IsNullOrEmpty(source) || !File.Exists(source)) return null;
        var ext = Path.GetExtension(source).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext)) return null;

        var dir = AppPaths.EnsureBackgroundsDir();
        var fileName = slotPrefix + "_bg" + ext;
        var dest = Path.Combine(dir, fileName);
        var safeDest = PathGuard.EnsureWithin(dir, dest);
        if (safeDest == null) return null;

        foreach (var f in Directory.EnumerateFiles(dir))
        {
            var name = Path.GetFileName(f);
            if (name.StartsWith(slotPrefix + "_bg.", StringComparison.OrdinalIgnoreCase))
            {
                try { File.Delete(f); } catch (Exception ex) { LogService.Error($"Failed to delete stale background '{f}'", ex); }
            }
        }

        File.Copy(source, safeDest, false);
        return fileName;
    }

    private static void DeletePanelBgFile(string? fileName)
    {
        if (string.IsNullOrEmpty(fileName) || !PathGuard.IsSafeFileName(fileName, ImageExtensions)) return;
        try
        {
            var path = Path.Combine(AppPaths.BackgroundsDir, fileName);
            var safe = PathGuard.EnsureWithin(AppPaths.BackgroundsDir, path);
            if (safe != null && File.Exists(safe))
                File.Delete(safe);
        }
        catch { }
    }

    private static string? CopyToDir(string source, string destDir, string[] allowedExtensions)
    {
        if (string.IsNullOrEmpty(source) || !File.Exists(source)) return null;
        var ext = Path.GetExtension(source).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext)) return null;

        var baseName = SanitizeFileName(Path.GetFileNameWithoutExtension(source));
        if (string.IsNullOrEmpty(baseName)) baseName = "file";
        var fileName = baseName + ext;
        var dest = Path.Combine(destDir, fileName);
        var safeDest = PathGuard.EnsureWithin(destDir, dest);
        if (safeDest == null) return null;

        int i = 1;
        while (File.Exists(safeDest))
        {
            fileName = $"{baseName}_{i}{ext}";
            safeDest = PathGuard.EnsureWithin(destDir, Path.Combine(destDir, fileName));
            if (safeDest == null) return null;
            i++;
        }
        File.Copy(source, safeDest, false);
        return fileName;
    }

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var clean = new string(name.Where(c => !invalid.Contains(c) && c != ' ').ToArray());
        if (clean.Length > 80) clean = clean.Substring(0, 80);
        return clean;
    }

    private static void CleanupOldBackgrounds(string keepFileName)
    {
        try
        {
            var dir = AppPaths.BackgroundsDir;
            if (!Directory.Exists(dir)) return;
            foreach (var file in Directory.EnumerateFiles(dir))
            {
                var name = Path.GetFileName(file);
                if (string.Equals(name, keepFileName, StringComparison.Ordinal)) continue;
                if (name.StartsWith("sidebar_bg.", StringComparison.OrdinalIgnoreCase)) continue;
                if (name.StartsWith("topbar_bg.", StringComparison.OrdinalIgnoreCase)) continue;
                try { File.Delete(file); } catch { /* best effort */ }
            }
        }
        catch { /* best effort */ }
    }

    public class FileNamePayload
    {
        public string FileName { get; set; } = "";
    }
}
