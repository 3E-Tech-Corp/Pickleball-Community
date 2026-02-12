using System.Diagnostics;

namespace Pickleball.Community.Services;

public interface IVideoThumbnailService
{
    Task<(bool Success, string? ThumbnailPath, string? ErrorMessage)> GenerateThumbnailAsync(
        string videoPath, string outputPath, int seekSeconds = 1);
}

public class VideoThumbnailService : IVideoThumbnailService
{
    private readonly ILogger<VideoThumbnailService> _logger;
    private readonly IConfiguration _configuration;

    public VideoThumbnailService(ILogger<VideoThumbnailService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
    }

    public async Task<(bool Success, string? ThumbnailPath, string? ErrorMessage)> GenerateThumbnailAsync(
        string videoPath, string outputPath, int seekSeconds = 1)
    {
        try
        {
            // Get ffmpeg path from config or use default
            var ffmpegPath = _configuration["FFmpeg:Path"] ?? "ffmpeg";

            // Build ffmpeg command to extract a single frame
            // -ss: seek to position, -i: input, -vframes 1: extract 1 frame, -y: overwrite
            var arguments = $"-ss {seekSeconds} -i \"{videoPath}\" -vframes 1 -q:v 2 -y \"{outputPath}\"";

            _logger.LogInformation("Generating thumbnail: ffmpeg {Arguments}", arguments);

            var processInfo = new ProcessStartInfo
            {
                FileName = ffmpegPath,
                Arguments = arguments,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = new Process { StartInfo = processInfo };
            process.Start();

            var stderr = await process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();

            if (process.ExitCode != 0)
            {
                _logger.LogError("FFmpeg failed with exit code {ExitCode}: {Stderr}", process.ExitCode, stderr);
                return (false, null, $"FFmpeg failed: {stderr}");
            }

            if (!File.Exists(outputPath))
            {
                return (false, null, "Thumbnail file was not created");
            }

            _logger.LogInformation("Thumbnail generated successfully: {OutputPath}", outputPath);
            return (true, outputPath, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating thumbnail from video: {VideoPath}", videoPath);
            return (false, null, ex.Message);
        }
    }
}
