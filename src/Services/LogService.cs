namespace VnHub.Services;

public static class LogService
{
    private static readonly string LogDir = VnHub.Common.AppPaths.LogsDir;
    private static string _logPath = null!;
    private static readonly object _lock = new();

    public static void Initialize()
    {
        Directory.CreateDirectory(LogDir);
        _logPath = Path.Combine(LogDir, $"vnhub-{DateTime.Now:yyyy-MM-dd}.log");
        CleanOldLogs();
        Info("=== VN-Hub started ===");
    }

    public static void Info(string message) => Write("INFO", message);
    public static void Warn(string message) => Write("WARN", message);

    public static void Error(string message, Exception? ex = null)
    {
        var msg = ex != null ? $"{message} | {ex.GetType().Name}: {ex.Message}" : message;
        Write("ERROR", msg);
    }

    private static void Write(string level, string message)
    {
        try
        {
            lock (_lock)
            {
                File.AppendAllText(_logPath,
                    $"[{DateTime.Now:HH:mm:ss.fff}] [{level}] {message}{Environment.NewLine}");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"LogService.Write failed: {ex}");
        }
    }

    private static void CleanOldLogs()
    {
        try
        {
            foreach (var file in Directory.GetFiles(LogDir, "vnhub-*.log"))
            {
                if (File.GetCreationTime(file) < DateTime.Now.AddDays(-7))
                    File.Delete(file);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"LogService.CleanOldLogs failed: {ex}");
        }
    }

    public static string GetLogDir() => LogDir;

    public static string ReadRecentLog(int maxLines = 500)
    {
        try
        {
            lock (_lock)
            {
                if (!File.Exists(_logPath)) return string.Empty;
                var lines = File.ReadAllLines(_logPath);
                if (lines.Length <= maxLines) return string.Join('\n', lines);
                return string.Join('\n', lines[^maxLines..]);
            }
        }
        catch
        {
            return string.Empty;
        }
    }

    public static int ClearLogs()
    {
        int count = 0;
        try
        {
            foreach (var file in Directory.GetFiles(LogDir, "vnhub-*.log"))
            {
                if (file == _logPath) continue;
                File.Delete(file);
                count++;
            }
        }
        catch { }
        return count;
    }
}
