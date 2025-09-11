package untrace

import (
	"time"
)

// Config represents the configuration options for initializing the Untrace SDK
type Config struct {
	// Required
	APIKey string

	// Optional
	ServiceName        string
	Environment        string
	Version            string
	BaseURL            string
	Debug              bool
	SamplingRate       float64
	MaxBatchSize       int
	ExportInterval     time.Duration
	Headers            map[string]string
	ResourceAttributes map[string]interface{}
}

// DefaultConfig returns a config with sensible defaults
func DefaultConfig(apiKey string) Config {
	return Config{
		APIKey:            apiKey,
		ServiceName:       "untrace-app",
		Environment:       "production",
		Version:           "0.1.0",
		BaseURL:           "https://untrace.dev",
		Debug:             false,
		SamplingRate:      1.0,
		MaxBatchSize:      512,
		ExportInterval:    5 * time.Second,
		Headers:           make(map[string]string),
		ResourceAttributes: make(map[string]interface{}),
	}
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.APIKey == "" {
		return &ValidationError{Message: "API key is required"}
	}
	if c.SamplingRate < 0.0 || c.SamplingRate > 1.0 {
		return &ValidationError{Message: "sampling rate must be between 0.0 and 1.0"}
	}
	if c.MaxBatchSize <= 0 {
		return &ValidationError{Message: "max batch size must be positive"}
	}
	if c.ExportInterval <= 0 {
		return &ValidationError{Message: "export interval must be positive"}
	}
	return nil
}
