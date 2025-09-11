package untrace

import (
	"context"
	"fmt"
	"log"
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// untraceClient implements the Client interface
type untraceClient struct {
	config     Config
	tracer     Tracer
	metrics    Metrics
	context    Context
	provider   *sdktrace.TracerProvider
	meter      metric.Meter
	mu         sync.RWMutex
	shutdown   bool
}

// Global state management
var (
	globalClient *untraceClient
	globalMu     sync.RWMutex
)

// Init initializes the Untrace SDK with the given configuration
func Init(config Config) (Client, error) {
	globalMu.Lock()
	defer globalMu.Unlock()

	if globalClient != nil {
		if config.Debug {
			log.Println("[Untrace] SDK already initialized. Returning existing instance.")
		}
		return globalClient, nil
	}

	// Validate configuration
	if err := config.Validate(); err != nil {
		return nil, err
	}

	// Create resource
	res := CreateResource(config)

	// Create OTLP exporter
	otlpClient, err := CreateOTLPExporter(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create exporter: %w", err)
	}

	// Create OTLP exporter
	exporter, err := otlptrace.New(context.Background(), otlpClient)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
	}

	// Create batch span processor
	bsp := sdktrace.NewBatchSpanProcessor(exporter,
		sdktrace.WithBatchTimeout(config.ExportInterval),
		sdktrace.WithMaxExportBatchSize(config.MaxBatchSize),
	)

	// Create tracer provider
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithSpanProcessor(bsp),
	)

	// Register global tracer provider
	otel.SetTracerProvider(provider)

	// Create meter
	meter := otel.Meter("untrace")

	// Create client
	client := &untraceClient{
		config:   config,
		provider: provider,
		meter:    meter,
	}

	// Initialize components
	client.tracer = NewTracer(provider.Tracer("untrace"))
	client.metrics = NewMetrics(meter)
	client.context = NewContext()

	// Store global instance
	globalClient = client

	if config.Debug {
		log.Println("[Untrace] SDK initialized successfully")
	}

	return client, nil
}

// GetInstance returns the current global Untrace instance
func GetInstance() Client {
	globalMu.RLock()
	defer globalMu.RUnlock()
	return globalClient
}

// Tracer returns the tracer instance
func (c *untraceClient) Tracer() Tracer {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.tracer
}

// Metrics returns the metrics instance
func (c *untraceClient) Metrics() Metrics {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.metrics
}

// Context returns the context instance
func (c *untraceClient) Context() Context {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.context
}

// Flush flushes all pending spans
func (c *untraceClient) Flush(ctx context.Context) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.shutdown {
		return fmt.Errorf("client is shutdown")
	}

	if c.config.Debug {
		log.Println("[Untrace] Flushing spans...")
	}

	if err := c.provider.ForceFlush(ctx); err != nil {
		return fmt.Errorf("failed to flush spans: %w", err)
	}

	if c.config.Debug {
		log.Println("[Untrace] Flush completed")
	}

	return nil
}

// Shutdown shuts down the client
func (c *untraceClient) Shutdown(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.shutdown {
		return nil
	}

	if c.config.Debug {
		log.Println("[Untrace] Shutting down SDK...")
	}

	// Flush before shutdown
	if err := c.provider.ForceFlush(ctx); err != nil {
		if c.config.Debug {
			log.Printf("[Untrace] Warning: failed to flush during shutdown: %v", err)
		}
	}

	// Shutdown provider
	if err := c.provider.Shutdown(ctx); err != nil {
		return fmt.Errorf("failed to shutdown provider: %w", err)
	}

	c.shutdown = true

	// Clear global instance
	globalMu.Lock()
	if globalClient == c {
		globalClient = nil
	}
	globalMu.Unlock()

	if c.config.Debug {
		log.Println("[Untrace] SDK shutdown complete")
	}

	return nil
}
