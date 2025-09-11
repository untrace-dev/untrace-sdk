defmodule Untrace.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Add any global processes here if needed
    ]

    opts = [strategy: :one_for_one, name: Untrace.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
