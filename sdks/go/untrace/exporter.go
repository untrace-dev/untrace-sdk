package untrace

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

// UntraceExporter represents a custom exporter for Untrace
type UntraceExporter struct {
	config     Config
	httpClient *http.Client
	baseURL    string
}

// NewUntraceExporter creates a new Untrace exporter
func NewUntraceExporter(config Config) (*UntraceExporter, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	return &UntraceExporter{
		config:     config,
		httpClient: client,
		baseURL:    config.BaseURL + "/v1/traces",
	}, nil
}

// ExportSpans exports spans to the Untrace API
func (e *UntraceExporter) ExportSpans(ctx context.Context, spans []sdktrace.ReadOnlySpan) error {
	if len(spans) == 0 {
		return nil
	}

	// Convert spans to the format expected by Untrace API
	payload, err := e.convertSpansToPayload(spans)
	if err != nil {
		return fmt.Errorf("failed to convert spans: %w", err)
	}

	// Send to Untrace API
	return e.sendToAPI(ctx, payload)
}

// Shutdown shuts down the exporter
func (e *UntraceExporter) Shutdown(ctx context.Context) error {
	// Nothing to shutdown for HTTP client
	return nil
}

// convertSpansToPayload converts OpenTelemetry spans to Untrace API format
func (e *UntraceExporter) convertSpansToPayload(spans []sdktrace.ReadOnlySpan) (map[string]interface{}, error) {
	// This is a simplified conversion - in a real implementation,
	// you would convert the spans to the exact format expected by Untrace API
	convertedSpans := make([]map[string]interface{}, 0, len(spans))

	for _, span := range spans {
		convertedSpan := map[string]interface{}{
			"trace_id":    span.SpanContext().TraceID().String(),
			"span_id":     span.SpanContext().SpanID().String(),
			"name":        span.Name(),
			"start_time":  span.StartTime().UnixNano(),
			"end_time":    span.EndTime().UnixNano(),
			"attributes":  span.Attributes(),
			"status":      span.Status(),
		}

		if span.Parent().SpanID().IsValid() {
			convertedSpan["parent_span_id"] = span.Parent().SpanID().String()
		}

		convertedSpans = append(convertedSpans, convertedSpan)
	}

	return map[string]interface{}{
		"spans": convertedSpans,
	}, nil
}

// sendToAPI sends the payload to the Untrace API
func (e *UntraceExporter) sendToAPI(ctx context.Context, payload map[string]interface{}) error {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", e.baseURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.config.APIKey)
	req.Header.Set("User-Agent", "untrace-sdk-go/0.1.0")

	// Add custom headers
	for key, value := range e.config.Headers {
		req.Header.Set(key, value)
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return &APIError{
			UntraceError: UntraceError{
				Message: "failed to send request to Untrace API",
				Err:     err,
			},
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return NewAPIError(
			fmt.Sprintf("API request failed with status %d", resp.StatusCode),
			resp.StatusCode,
			string(body),
			nil,
		)
	}

	return nil
}

// CreateOTLPExporter creates an OTLP exporter configured for Untrace
func CreateOTLPExporter(config Config) (otlptrace.Client, error) {
	// Create HTTP client with custom headers
	client := otlptracehttp.NewClient(
		otlptracehttp.WithEndpoint(config.BaseURL),
		otlptracehttp.WithHeaders(map[string]string{
			"Authorization": "Bearer " + config.APIKey,
			"User-Agent":    "untrace-sdk-go/0.1.0",
		}),
	)

	return client, nil
}

// CreateResource creates an OpenTelemetry resource for Untrace
func CreateResource(config Config) *resource.Resource {
	attrs := []attribute.KeyValue{
		semconv.ServiceNameKey.String(config.ServiceName),
		semconv.ServiceVersionKey.String(config.Version),
		semconv.DeploymentEnvironmentKey.String(config.Environment),
	}

	// Add custom resource attributes
	for key, value := range config.ResourceAttributes {
		if str, ok := value.(string); ok {
			attrs = append(attrs, attribute.String(key, str))
		} else if num, ok := value.(int); ok {
			attrs = append(attrs, attribute.Int(key, num))
		} else if num, ok := value.(float64); ok {
			attrs = append(attrs, attribute.Float64(key, num))
		} else if b, ok := value.(bool); ok {
			attrs = append(attrs, attribute.Bool(key, b))
		}
	}

	return resource.NewWithAttributes(
		semconv.SchemaURL,
		attrs...,
	)
}
