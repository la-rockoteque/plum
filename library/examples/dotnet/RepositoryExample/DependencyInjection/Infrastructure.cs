using RepositoryExample.DependencyInjection.Application;

namespace RepositoryExample.DependencyInjection.Infrastructure;

public sealed class ConsoleNotifier : INotifier
{
    public void Send(string message) => Console.WriteLine(message);
}

public sealed class RecordingNotifier : INotifier
{
    public List<string> Messages { get; } = [];
    public void Send(string message) => Messages.Add(message);
}
