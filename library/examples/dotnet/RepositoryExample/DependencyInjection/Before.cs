using RepositoryExample.DependencyInjection.Infrastructure;

namespace RepositoryExample.DependencyInjection.Before;

public sealed class WelcomeUser
{
    // The use case chooses, constructs, and depends on a concrete adapter.
    private readonly ConsoleNotifier notifier = new();

    public void Execute(string name)
    {
        name = name.Trim();
        if (name.Length == 0) throw new ArgumentException("Name is required", nameof(name));
        notifier.Send($"Welcome, {name}!");
    }
}
