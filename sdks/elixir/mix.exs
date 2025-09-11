defmodule Untrace.MixProject do
  use Mix.Project

  @version "0.1.2"
  @source_url "https://github.com/untrace-dev/untrace-sdk"

  def project do
    [
      app: :untrace_sdk,
      version: @version,
      elixir: "~> 1.14",
      name: "Untrace SDK",
      description: "LLM observability SDK for Elixir",
      package: package(),
      deps: deps(),
      docs: docs(),
      test_coverage: [tool: ExCoveralls],
      preferred_cli_env: [
        coveralls: :test,
        "coveralls.detail": :test,
        "coveralls.post": :test,
        "coveralls.html": :test
      ]
    ]
  end

  def application do
    [
      extra_applications: [:logger, :crypto, :ssl],
      mod: {Untrace.Application, []}
    ]
  end

  defp deps do
    [
      # HTTP client
      {:req, "~> 0.4"},

      # JSON handling
      {:jason, "~> 1.4"},

      # Telemetry
      {:telemetry, "~> 1.0"},
      {:opentelemetry, "~> 1.0"},
      {:opentelemetry_api, "~> 1.0"},
      {:opentelemetry_exporter, "~> 1.0"},
      {:opentelemetry_semantic_conventions, "~> 0.2"},

      # Development dependencies
      {:ex_doc, "~> 0.30", only: :dev, runtime: false},
      {:excoveralls, "~> 0.18", only: :test},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.4", only: [:dev], runtime: false},
      {:mix_test_watch, "~> 1.0", only: :dev, runtime: false}
    ]
  end

  defp package do
    [
      maintainers: ["Untrace Team"],
      licenses: ["MIT"],
      links: %{
        "GitHub" => @source_url,
        "Documentation" => "https://docs.untrace.dev"
      },
      files: ~w(lib mix.exs README.md LICENSE)
    ]
  end

  defp docs do
    [
      main: "readme",
      source_url: @source_url,
      source_ref: "v#{@version}",
      extras: ["README.md", "LICENSE"]
    ]
  end
end
