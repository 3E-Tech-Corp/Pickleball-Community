using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.Services;

/// <summary>
/// Generic result wrapper for service methods.
/// Encapsulates success/failure, data, message, and HTTP status code.
/// </summary>
public class ServiceResult<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }
    public int StatusCode { get; set; } = 200;
    public List<string>? Warnings { get; set; }

    public static ServiceResult<T> Ok(T data, string? message = null) =>
        new() { Success = true, Data = data, Message = message };

    public static ServiceResult<T> OkWithWarnings(T data, List<string>? warnings, string? message = null) =>
        new() { Success = true, Data = data, Message = message, Warnings = warnings?.Count > 0 ? warnings : null };

    public static ServiceResult<T> Fail(string message, int statusCode = 400) =>
        new() { Success = false, Message = message, StatusCode = statusCode };

    public static ServiceResult<T> NotFound(string message) => Fail(message, 404);
    public static ServiceResult<T> Unauthorized(string message = "Unauthorized") => Fail(message, 401);
    public static ServiceResult<T> Forbidden(string message = "Forbidden") => Fail(message, 403);
    public static ServiceResult<T> ServerError(string message) => Fail(message, 500);

    public ApiResponse<T> ToResponse() => new()
    {
        Success = Success,
        Message = Message ?? "",
        Data = Data,
        Warnings = Warnings
    };
}

/// <summary>
/// Non-generic service result for void operations
/// </summary>
public class ServiceResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int StatusCode { get; set; } = 200;
    public List<string>? Warnings { get; set; }

    public static ServiceResult Ok(string? message = null) =>
        new() { Success = true, Message = message };

    public static ServiceResult Fail(string message, int statusCode = 400) =>
        new() { Success = false, Message = message, StatusCode = statusCode };

    public static ServiceResult NotFound(string message) => Fail(message, 404);
    public static ServiceResult Unauthorized(string message = "Unauthorized") => Fail(message, 401);
    public static ServiceResult Forbidden(string message = "Forbidden") => Fail(message, 403);
}
