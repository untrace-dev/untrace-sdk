using System.Net;

namespace Untrace;

/// <summary>
/// Base exception for all Untrace SDK errors
/// </summary>
public class UntraceException : Exception
{
    /// <summary>
    /// Initializes a new instance of the UntraceException class
    /// </summary>
    public UntraceException() : base()
    {
    }

    /// <summary>
    /// Initializes a new instance of the UntraceException class with a specified error message
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    public UntraceException(string message) : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the UntraceException class with a specified error message and inner exception
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    /// <param name="innerException">The exception that is the cause of the current exception</param>
    public UntraceException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

/// <summary>
/// Exception thrown when API requests fail
/// </summary>
public class UntraceApiException : UntraceException
{
    /// <summary>
    /// HTTP status code of the failed request
    /// </summary>
    public HttpStatusCode? StatusCode { get; }

    /// <summary>
    /// Response content from the failed request
    /// </summary>
    public string? ResponseContent { get; }

    /// <summary>
    /// Initializes a new instance of the UntraceApiException class
    /// </summary>
    public UntraceApiException() : base()
    {
    }

    /// <summary>
    /// Initializes a new instance of the UntraceApiException class with a specified error message
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    public UntraceApiException(string message) : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the UntraceApiException class with a specified error message and HTTP status code
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    /// <param name="statusCode">HTTP status code of the failed request</param>
    public UntraceApiException(string message, HttpStatusCode statusCode) : base(message)
    {
        StatusCode = statusCode;
    }

    /// <summary>
    /// Initializes a new instance of the UntraceApiException class with a specified error message, HTTP status code, and response content
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    /// <param name="statusCode">HTTP status code of the failed request</param>
    /// <param name="responseContent">Response content from the failed request</param>
    public UntraceApiException(string message, HttpStatusCode statusCode, string responseContent) : base(message)
    {
        StatusCode = statusCode;
        ResponseContent = responseContent;
    }

    /// <summary>
    /// Initializes a new instance of the UntraceApiException class with a specified error message and inner exception
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    /// <param name="innerException">The exception that is the cause of the current exception</param>
    public UntraceApiException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

/// <summary>
/// Exception thrown when request validation fails
/// </summary>
public class UntraceValidationException : UntraceException
{
    /// <summary>
    /// Validation errors
    /// </summary>
    public Dictionary<string, string[]>? ValidationErrors { get; }

    /// <summary>
    /// Initializes a new instance of the UntraceValidationException class
    /// </summary>
    public UntraceValidationException() : base()
    {
    }

    /// <summary>
    /// Initializes a new instance of the UntraceValidationException class with a specified error message
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    public UntraceValidationException(string message) : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the UntraceValidationException class with a specified error message and validation errors
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    /// <param name="validationErrors">Validation errors</param>
    public UntraceValidationException(string message, Dictionary<string, string[]> validationErrors) : base(message)
    {
        ValidationErrors = validationErrors;
    }

    /// <summary>
    /// Initializes a new instance of the UntraceValidationException class with a specified error message and inner exception
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    /// <param name="innerException">The exception that is the cause of the current exception</param>
    public UntraceValidationException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
