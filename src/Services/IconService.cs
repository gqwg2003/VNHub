using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using VnHub.Common;

namespace VnHub.Services;

public static class IconService
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int PrivateExtractIcons(
        string lpszFile, int nIconIndex, int cxIcon, int cyIcon,
        IntPtr[]? phicon, int[]? piconid, int nIcons, int flags);

    [DllImport("user32.dll")]
    private static extern bool DestroyIcon(IntPtr hIcon);

    public static string? ExtractIconFromExe(string exePath, string vnId)
    {
        if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
            return null;
        if (!Validation.IsValidVnId(vnId))
        {
            LogService.Warn($"ExtractIconFromExe: rejected invalid vnId '{vnId}'");
            return null;
        }

        var coversDir = AppPaths.EnsureCoversDir();
        var destName = $"{vnId}_icon.png";
        var destPath = PathGuard.EnsureWithin(coversDir, Path.Combine(coversDir, destName));
        if (destPath == null)
        {
            LogService.Warn($"ExtractIconFromExe: dest path traversal blocked for '{vnId}'");
            return null;
        }

        var gameDir = Path.GetDirectoryName(exePath);
        if (gameDir != null)
        {
            var found = FindBestImageInDir(gameDir);
            if (found != null)
            {
                try
                {
                    using var img = Image.FromFile(found);
                    img.Save(destPath, ImageFormat.Png);
                    return destName;
                }
                catch (Exception ex)
                {
                    LogService.Warn($"ExtractIconFromExe: failed to use image '{found}': {ex.Message}");
                }
            }
        }

        try
        {
            var hIcons = new IntPtr[1];
            int count = PrivateExtractIcons(exePath, 0, 256, 256, hIcons, null, 1, 0);
            if (count > 0 && hIcons[0] != IntPtr.Zero)
            {
                try
                {
                    using var icon = Icon.FromHandle(hIcons[0]);
                    using var bmp = icon.ToBitmap();
                    if (bmp.Width >= 64)
                    {
                        bmp.Save(destPath, ImageFormat.Png);
                        return destName;
                    }
                }
                finally
                {
                    DestroyIcon(hIcons[0]);
                }
            }
        }
        catch (Exception ex)
        {
            LogService.Warn($"ExtractIconFromExe: PrivateExtractIcons failed for '{exePath}': {ex.Message}");
        }

        try
        {
            using var icon = Icon.ExtractAssociatedIcon(exePath);
            if (icon == null) return null;

            using var bmp = icon.ToBitmap();
            using var scaled = new Bitmap(256, 256);
            using (var g = Graphics.FromImage(scaled))
            {
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                g.DrawImage(bmp, 0, 0, 256, 256);
            }
            scaled.Save(destPath, ImageFormat.Png);
            return destName;
        }
        catch (Exception ex)
        {
            LogService.Warn($"ExtractIconFromExe: ExtractAssociatedIcon failed for '{exePath}': {ex.Message}");
            return null;
        }
    }

    private static string? FindBestImageInDir(string directory)
    {
        var extensions = new[] { "*.png", "*.jpg", "*.jpeg", "*.ico", "*.bmp" };
        var nameKeywords = new[] { "icon", "logo", "cover", "game", "title", "poster", "thumb" };
        var candidates = new List<(string path, long size, bool hasKeyword)>();

        foreach (var ext in extensions)
        {
            try
            {
                foreach (var file in Directory.GetFiles(directory, ext, SearchOption.TopDirectoryOnly))
                {
                    var fi = new FileInfo(file);
                    if (fi.Length < 512 || fi.Length > 20 * 1024 * 1024) continue;
                    var name = Path.GetFileNameWithoutExtension(file).ToLowerInvariant();
                    bool hasKw = Array.Exists(nameKeywords, kw => name.Contains(kw));
                    candidates.Add((file, fi.Length, hasKw));
                }
            }
            catch (Exception ex)
            {
                LogService.Warn($"FindBestImageInDir: enumeration failed for '{directory}' ({ext}): {ex.Message}");
            }
        }

        var best = candidates
            .OrderByDescending(c => c.hasKeyword)
            .ThenByDescending(c => c.size)
            .FirstOrDefault();

        return best.path; 
    }

    public static string GetTitleFromExe(string exePath)
    {
        if (string.IsNullOrEmpty(exePath))
            return "";

        try
        {
            var versionInfo = System.Diagnostics.FileVersionInfo.GetVersionInfo(exePath);
            if (!string.IsNullOrWhiteSpace(versionInfo.FileDescription)
                && versionInfo.FileDescription != Path.GetFileNameWithoutExtension(exePath))
            {
                return versionInfo.FileDescription.Trim();
            }

            if (!string.IsNullOrWhiteSpace(versionInfo.ProductName))
            {
                return versionInfo.ProductName.Trim();
            }
        }
        catch (Exception ex)
        {
            LogService.Error($"Failed to read version info from '{exePath}'", ex);
        }

        var name = Path.GetFileNameWithoutExtension(exePath);
        foreach (var suffix in new[] { "_x64", "_x86", "-x64", "-x86", "_en", "_jp", " - Shortcut" })
            name = name.Replace(suffix, "", StringComparison.OrdinalIgnoreCase);

        return name.Replace('_', ' ').Replace('-', ' ').Trim();
    }
}
