using System.Diagnostics;
using VnHub.Database;

namespace VnHub.Services;

public static class LauncherService
{
    private static readonly Dictionary<string, Process> _tracked = new();
    private static readonly Dictionary<string, DateTime> _startTimes = new();
    private static readonly Dictionary<string, string> _exeDirs = new();
    private static readonly Dictionary<string, string> _exeNames = new();
    private static readonly HashSet<string> _inGracePeriod = new();
    private static readonly object _lock = new();

    private const int GraceThresholdSeconds = 5;
    private const int GraceDelayMs = 2500;

    public static event Action<string>? GameExited;

    public static bool Launch(string vnId, string? exePath)
    {
        if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
            return false;

        var exeName = Path.GetFileNameWithoutExtension(exePath);

        lock (_lock)
        {
            if (_tracked.ContainsKey(vnId))
            {
                var existing = _tracked[vnId];
                try { if (!existing.HasExited) return true; }
                catch (Exception ex) { LogService.Error($"Failed to check process state for '{vnId}'", ex); }
            }
        }

        var dir = Path.GetDirectoryName(exePath) ?? "";
        Process? proc = null;

        try
        {
            proc = Process.Start(new ProcessStartInfo
            {
                FileName = exePath,
                WorkingDirectory = dir,
                UseShellExecute = true
            });
        }
        catch
        {
            try
            {
                proc = Process.Start(new ProcessStartInfo
                {
                    FileName = exePath,
                    WorkingDirectory = dir,
                    UseShellExecute = false
                });
            }
            catch (Exception ex)
            {
                LogService.Error($"Failed to launch {exePath}", ex);
                return false;
            }
        }

        if (proc == null) return false;

        lock (_lock)
        {
            _tracked[vnId] = proc;
            _startTimes[vnId] = DateTime.UtcNow;
            _exeDirs[vnId] = dir;
            _exeNames[vnId] = exeName;
        }

        try
        {
            proc.EnableRaisingEvents = true;
            proc.Exited += (_, _) => OnProcessExited(vnId);
        }
        catch
        {
            LogService.Warn($"Cannot subscribe to Exited event for {exeName}, relying on fallback poll");
        }

        LogService.Info($"Process started: {exeName} (PID {proc.Id}) for VN {vnId}");
        return true;
    }

    private static async void OnProcessExited(string vnId)
    {
        DateTime startTime;
        string? exeDir = null;
        string? exeName = null;

        lock (_lock)
        {
            if (!_tracked.ContainsKey(vnId)) return;
            if (!_startTimes.TryGetValue(vnId, out startTime))
            {
                FinishTracking(vnId);
                return;
            }
            _exeDirs.TryGetValue(vnId, out exeDir);
            _exeNames.TryGetValue(vnId, out exeName);
        }

        var elapsed = (DateTime.UtcNow - startTime).TotalSeconds;

        if (elapsed < GraceThresholdSeconds && exeDir != null)
        {
            lock (_lock) { _inGracePeriod.Add(vnId); }
            try
            {
                await Task.Delay(GraceDelayMs);

                var replacement = FindReplacementProcess(exeDir, exeName);
                if (replacement != null)
                {
                    lock (_lock)
                    {
                        _tracked[vnId] = replacement;
                        _inGracePeriod.Remove(vnId);
                    }

                    try
                    {
                        replacement.EnableRaisingEvents = true;
                        replacement.Exited += (_, _) => OnProcessExited(vnId);
                    }
                    catch
                    {
                        LogService.Warn($"Cannot subscribe to replacement process for VN {vnId}");
                    }

                    LogService.Info($"Switched to child process {replacement.ProcessName} (PID {replacement.Id}) for VN {vnId}");
                    return;
                }
            }
            finally
            {
                lock (_lock) { _inGracePeriod.Remove(vnId); }
            }
        }

        FinishTracking(vnId);
    }

    private static void FinishTracking(string vnId)
    {
        long seconds = 0;
        lock (_lock)
        {
            if (!_tracked.Remove(vnId)) return;
            _exeDirs.Remove(vnId);
            _exeNames.Remove(vnId);
            if (_startTimes.TryGetValue(vnId, out var start))
            {
                _startTimes.Remove(vnId);
                seconds = (long)(DateTime.UtcNow - start).TotalSeconds;
                if (seconds > 0)
                {
                    VnRepository.AddPlayTime(vnId, seconds);
                    Database.SessionRepository.Insert(vnId, start, DateTime.UtcNow, seconds);
                    LogService.Info($"Play time recorded: {seconds}s for VN {vnId}");
                }
            }
        }

        GameExited?.Invoke(vnId);
    }

    private static Process? FindReplacementProcess(string exeDir, string? expectedExeName = null)
    {
        try
        {
            var dirWithSep = exeDir.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            foreach (var p in Process.GetProcesses())
            {
                try
                {
                    if (p.HasExited) continue;
                    if (p.MainWindowHandle == IntPtr.Zero) continue;
                    var path = p.MainModule?.FileName;
                    if (path == null || !path.StartsWith(dirWithSep, StringComparison.OrdinalIgnoreCase))
                        continue;

                    if (!string.IsNullOrEmpty(expectedExeName)
                        && !p.ProcessName.StartsWith(expectedExeName, StringComparison.OrdinalIgnoreCase))
                        continue;

                    LogService.Info($"Adopting replacement process {p.ProcessName} (PID {p.Id}) from {exeDir}");
                    return p;
                }
                catch { /* access denied for some processes — skip */ }
            }
        }
        catch (Exception ex)
        {
            LogService.Warn($"FindReplacementProcess failed: {ex.Message}");
        }
        return null;
    }

    public static List<string> GetRunningIds()
    {
        var running = new List<string>();
        var exited = new List<string>();

        lock (_lock)
        {
            foreach (var kv in _tracked)
            {
                if (_inGracePeriod.Contains(kv.Key))
                {
                    running.Add(kv.Key);
                    continue;
                }

                bool alive;
                try { alive = !kv.Value.HasExited; }
                catch { alive = false; }

                if (alive)
                    running.Add(kv.Key);
                else
                    exited.Add(kv.Key);
            }
        }

        foreach (var vnId in exited)
            OnProcessExited(vnId);

        return running;
    }

    public static void SaveAllPlayTime()
    {
        lock (_lock)
        {
            foreach (var kvp in _tracked)
            {
                if (_startTimes.TryGetValue(kvp.Key, out var start))
                {
                    var now = DateTime.UtcNow;
                    var seconds = (long)(now - start).TotalSeconds;
                    if (seconds > 0)
                    {
                        try
                        {
                            VnRepository.AddPlayTime(kvp.Key, seconds);
                            Database.SessionRepository.Insert(kvp.Key, start, now, seconds);
                            LogService.Info($"Play time saved on exit: {seconds}s for VN {kvp.Key}");
                        }
                        catch (Exception ex)
                        {
                            LogService.Error($"Failed to save play time for {kvp.Key}", ex);
                        }
                    }
                }
            }
            _tracked.Clear();
            _startTimes.Clear();
            _exeDirs.Clear();
            _exeNames.Clear();
            _inGracePeriod.Clear();
        }
    }

    public static bool HasTrackedGames()
    {
        lock (_lock) { return _tracked.Count > 0 || _inGracePeriod.Count > 0; }
    }
}
