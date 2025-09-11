package untrace

import "fmt"

// UntraceError represents a base error for all Untrace SDK errors
type UntraceError struct {
	Message string
	Err     error
}

func (e *UntraceError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *UntraceError) Unwrap() error {
	return e.Err
}

// APIError represents an API-related error
type APIError struct {
	UntraceError
	StatusCode int
	Response   string
}

func NewAPIError(message string, statusCode int, response string, err error) *APIError {
	return &APIError{
		UntraceError: UntraceError{
			Message: message,
			Err:     err,
		},
		StatusCode: statusCode,
		Response:   response,
	}
}

// ValidationError represents a validation error
type ValidationError struct {
	UntraceError
	Field string
}

func NewValidationError(message, field string) *ValidationError {
	return &ValidationError{
		UntraceError: UntraceError{
			Message: message,
		},
		Field: field,
	}
}

// ConfigurationError represents a configuration error
type ConfigurationError struct {
	UntraceError
}

func NewConfigurationError(message string, err error) *ConfigurationError {
	return &ConfigurationError{
		UntraceError: UntraceError{
			Message: message,
			Err:     err,
		},
	}
}

// InstrumentationError represents an instrumentation error
type InstrumentationError struct {
	UntraceError
	Provider string
}

func NewInstrumentationError(message, provider string, err error) *InstrumentationError {
	return &InstrumentationError{
		UntraceError: UntraceError{
			Message: message,
			Err:     err,
		},
		Provider: provider,
	}
}
