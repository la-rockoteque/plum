using RepositoryExample.DependencyInjection.Infrastructure;

namespace RepositoryExample.DependencyInjection.InjectionOnly;

// Injection changes who constructs it, but this contract is still concrete.
public sealed class WelcomeUser(ConsoleNotifier notifier)
{
    public void Execute(string name)
    {
        name = name.Trim();
        if (name.Length == 0) throw new ArgumentException("Name is required", nameof(name));
        notifier.Send($"Welcome, {name}!");
    }
}
